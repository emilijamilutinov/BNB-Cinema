import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import mysql from "mysql2/promise";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = await mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "auth_db",
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
});

// --- JWT auth middleware
function auth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ message: "No token" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
}

app.get("/api/health", (req, res) => res.json({ ok: true }));

// ===================== AUTH =====================

app.post("/api/auth/signup", async (req, res) => {
  const { username, email, password } = req.body || {};
  if (!username || !email || !password)
    return res.status(400).json({ message: "username, email, password su obavezni" });

  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.execute(
      `INSERT INTO users (username, email, password_hash)
       VALUES (:u, :e, :p)`,
      { u: username, e: email, p: hash }
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    if (err?.code === "ER_DUP_ENTRY")
      return res.status(409).json({ message: "Email već postoji" });
    console.error("signup error:", err);
    res.status(500).json({ message: "Greška pri registraciji" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ message: "email i password su obavezni" });

  try {
    const [rows] = await pool.execute(
      `SELECT id, username, email, password_hash FROM users WHERE email = :e`,
      { e: email }
    );
    if (rows.length === 0) return res.status(401).json({ message: "Neispravni kredencijali" });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: "Neispravni kredencijali" });

    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.json({ token });
  } catch (err) {
    console.error("login error:", err);
    res.status(500).json({ message: "Greška pri prijavi" });
  }
});

// ================== REZERVACIJE ==================

app.get("/api/taken-seats", async (req, res) => {
  const { film_title, datum } = req.query;
  if (!film_title || !datum) return res.status(400).json({ message: "Parametri?" });
  try {
    const [rows] = await pool.execute(
      `SELECT seat_code FROM taken_seats
       WHERE film_title = :t AND datum = :d`,
      { t: film_title, d: datum }
    );
    res.json(rows.map(r => r.seat_code));
  } catch (err) {
    console.error("taken-seats error:", err);
    res.status(500).json({ message: "Greška" });
  }
});

// body: { film_title, datum, seats:[{row,num,type,price}], total }
app.post("/api/rezervacije", auth, async (req, res) => {
  const { film_title, datum, seats, total } = req.body || {};
  if (!film_title || !datum || !Array.isArray(seats) || seats.length === 0)
    return res.status(400).json({ message: "Nedostaju podaci" });

  const email = req.user.email;
  const username = req.user.username || "Korisnik";

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    for (const s of seats) {
      const seat_code = `${s.row}${s.num}`;
      await conn.execute(
        `INSERT INTO taken_seats (film_title, datum, seat_code, email)
         VALUES (:t, :d, :c, :e)`,
        { t: film_title, d: datum, c: seat_code, e: email }
      );
    }

    const [r] = await conn.execute(
      `INSERT INTO reservations
       (username, email, film_title, datum, seats_json, total_eur)
       VALUES (:u, :e, :t, :d, :sj, :tot)`,
      {
        u: username,
        e: email,
        t: film_title,
        d: datum,
        sj: JSON.stringify(seats), // bez CAST; JSON kolona u MariaDB je alias i prihvata string
        tot: total ?? 0,
      }
    );

    await conn.commit();
    res.status(201).json({ id: r.insertId, ok: true });
  } catch (err) {
    await conn.rollback();
    if (err?.code === "ER_DUP_ENTRY")
      return res.status(409).json({ message: "Neko sedište je zauzeto. Osvežite." });
    console.error("POST rezervacije error:", err);
    res.status(500).json({ message: "Greška pri potvrdi" });
  } finally {
    conn.release();
  }
});

app.get("/api/rezervacije", auth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, film_title, datum, seats_json, total_eur, created_at
       FROM reservations
       WHERE email = :e
       ORDER BY created_at DESC`,
      { e: req.user.email }
    );
    res.json(rows);
  } catch (err) {
    console.error("GET rezervacije error:", err);
    res.status(500).json({ message: "Greška pri čitanju" });
  }
});

app.delete("/api/rezervacije/:id", auth, async (req, res) => {
  const id = Number(req.params.id);
  const email = req.user.email;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute(
      `SELECT film_title, datum, seats_json
       FROM reservations
       WHERE id = :id AND email = :e`,
      { id, e: email }
    );
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: "Nije pronađeno" });
    }

    const { film_title, datum, seats_json } = rows[0];
    const seats = JSON.parse(seats_json || "[]");

    await conn.execute(
      `DELETE FROM reservations WHERE id = :id AND email = :e`,
      { id, e: email }
    );

    for (const s of seats) {
      const seat_code = `${s.row}${s.num}`;
      await conn.execute(
        `DELETE FROM taken_seats
         WHERE film_title = :t AND datum = :d AND seat_code = :c AND email = :e`,
        { t: film_title, d: datum, c: seat_code, e: email }
      );
    }

    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    console.error("DELETE rezervacije error:", err);
    res.status(500).json({ message: "Greška pri brisanju" });
  } finally {
    conn.release();
  }
});

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
