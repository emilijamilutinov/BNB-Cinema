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

// --- posle funkcije auth(...) dodaj:

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// opcioni helper za owner-only rute (koristićeš kad dodaš CRUD za filmove)
function checkRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Nisi prijavljen/a' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'Nedovoljna ovlašćenja' });
    next();
  };
}


// ===================== AUTH =====================
//Registracija korisnika
app.post("/api/auth/signup", async (req, res) => {
  const { username, email, password } = req.body || {};
  if (!username || !email || !password)
    return res.status(400).json({ message: "username, email, password su obavezni" });

  try {
    const emailNorm = normalizeEmail(email);
    const hash = await bcrypt.hash(password, 10);

    await pool.execute(
      `INSERT INTO users (username, email, password_hash)
       VALUES (:u, :e, :p)`,
      { u: username, e: emailNorm, p: hash }
    );
    // zadržavam isti response kao ranije (da ne moraš da menjaš FE)
    res.status(201).json({ ok: true });
  } catch (err) {
    if (err?.code === "ER_DUP_ENTRY")
      return res.status(409).json({ message: "Email već postoji" });
    console.error("signup error:", err);
    res.status(500).json({ message: "Greška pri registraciji" });
  }
});

//Prijava korisnika

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ message: "email i password su obavezni" });

  try {
    const emailNorm = normalizeEmail(email);

    const [rows] = await pool.execute(
      `SELECT id, username, email, password_hash, role
         FROM users
        WHERE LOWER(email) = :e
        LIMIT 1`,
      { e: emailNorm }
    );
    if (rows.length === 0) return res.status(401).json({ message: "Neispravni kredencijali" });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: "Neispravni kredencijali" });

    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, role: user.role },
      process.env.JWT_SECRET || "dev_secret_change_me",
      { expiresIn: "7d" }
    );

    // sada vraćamo i role radi UX-a (guardovi), ali BE već štiti rute preko tokena
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, role: user.role } });
  } catch (err) {
    console.error("login error:", err);
    res.status(500).json({ message: "Greška pri prijavi" });
  }
});
app.get("/api/auth/me", auth, (req, res) => {
  // req.user je payload iz tokena: { id, username, email, role }
  res.json(req.user);
});



// ================== REZERVACIJE ==================

// zauzeta sedišta za (film_title, datum)
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

// KREIRAJ rezervaciju (TRANSACKIJA!)
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
        sj: JSON.stringify(seats),
        tot: total ?? 0,
      }
    );

    await conn.commit();
    res.status(201).json({ id: r.insertId, ok: true });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    if (err?.code === "ER_DUP_ENTRY")
      return res.status(409).json({ message: "Neko sedište je zauzeto. Osvežite." });
    console.error("POST rezervacije error:", err);
    res.status(500).json({ message: "Greška pri potvrdi", detail: err?.sqlMessage || err?.message });
  } finally {
    conn.release();
  }
});

// moje rezervacije
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

// otkazivanje
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

    await conn.execute(`DELETE FROM reservations WHERE id = :id AND email = :e`, { id, e: email });

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
    try { await conn.rollback(); } catch {}
    console.error("DELETE rezervacije error:", err);
    res.status(500).json({ message: "Greška pri brisanju" });
  } finally {
    conn.release();
  }
});

// ================== RECENZIJE (jedna, final) ==================
app.post('/api/reviews', auth, async (req, res) => {
  try {
    let filmId = Number(req.body.filmId ?? req.body.id ?? req.body.movieId ?? req.body.tmdbId);
    const filmTitle = req.body.filmTitle ?? req.body.title ?? req.body.name ?? req.body.naslov;
    const rating = Number(req.body.rating ?? req.body.ocena);
    const comment = req.body.comment ?? req.body.komentar ?? null;

    console.log('POST /api/reviews body =', req.body);

    if (!filmTitle || Number.isNaN(rating)) return res.status(400).json({ message: 'Nedostaju filmTitle ili rating' });
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ message: 'rating mora biti 1–5' });

    function makeIdFromTitle(title) {
      const norm = (title || '').toLowerCase()
        .replace(/["'’‘“”\-.,:;(){}\[\]!?\s]/g, '')
        .replace(/č/g,'c').replace(/ć/g,'c').replace(/š/g,'s').replace(/ž/g,'z').replace(/đ/g,'dj');
      let h = 5381; for (let i = 0; i < norm.length; i++) h = ((h << 5) + h) + norm.charCodeAt(i);
      return Math.abs(h);
    }
    if (!filmId) filmId = makeIdFromTitle(filmTitle);

    // proveru gledanja uključi u (ENV)
    if (process.env.REVIEW_REQUIRE_RESERVATION !== 'false') {
      const norm = s => (s || '').toLowerCase()  //normalizator naziva filma
        .replace(/["'’‘“”\-.,:;(){}\[\]!?\s]/g, '')
        .replace(/č/g,'c').replace(/ć/g,'c').replace(/š/g,'s').replace(/ž/g,'z').replace(/đ/g,'dj');

      const want = norm(filmTitle);
      const [rs] = await pool.execute(
        `SELECT film_title FROM reservations WHERE email = :e ORDER BY created_at DESC LIMIT 100`,
        { e: req.user.email }
      );
      const ok = rs.some(r => { const t = norm(r.film_title); return t.includes(want) || want.includes(t); });
      if (!ok) return res.status(403).json({ message: 'Možeš oceniti samo film koji si gledao.' });
    }

    const [dupe] = await pool.execute(
      `SELECT id FROM reviews WHERE filmId = :fid AND email = :e LIMIT 1`,
      { fid: filmId, e: req.user.email }
    );
    if (dupe.length) return res.status(409).json({ message: 'Već si ostavio/la recenziju za ovaj film.' });

    await pool.execute(
      `INSERT INTO reviews (filmId, username, email, rating, comment)
       VALUES (:fid, :u, :e, :r, :c)`,
      { fid: filmId, u: req.user.username || 'Korisnik', e: req.user.email, r: rating, c: comment }
    );

    res.status(201).json({ message: 'Recenzija sačuvana.' });
  } catch (err) {
    console.error('POST /api/reviews error:', err);
    res.status(500).json({ message: 'Greška na serveru' });
  }
});

app.delete('/api/reviews/:filmId', auth, async (req, res) => {
  try {
    const filmId = Number(req.params.filmId);
    const [result] = await pool.execute(
      `DELETE FROM reviews WHERE filmId = :fid AND email = :e`,
      { fid: filmId, e: req.user.email }
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Nema tvoje recenzije za ovaj film.' });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/reviews/:filmId error:', err);
    res.status(500).json({ message: 'Greška na serveru' });
  }
});
// ===== PROFILE: promena username i/ili lozinke =====
app.patch('/api/user', auth, async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username && !password) {
      return res.status(400).json({ message: 'Nema polja za ažuriranje' });
    }

    const sets = [];
    const params = { id: req.user.id };

    if (username) {
      if (typeof username !== 'string' || !username.trim()) {
        return res.status(400).json({ message: 'Neispravno korisničko ime' });
      }
      sets.push('username = :u');
      params.u = username.trim();
    }

    if (password) {
      if (typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({ message: 'Lozinka mora imati bar 6 karaktera' });
      }
      const hash = await bcrypt.hash(password, 10);
      sets.push('password_hash = :p');
      params.p = hash;
    }

    const sql = `UPDATE users SET ${sets.join(', ')} WHERE id = :id`;
    const [result] = await pool.execute(sql, params);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Korisnik nije pronađen' });
    }

    // izdamo novi token ako se menja username
    let newToken = null;
    if (username) {
      newToken = jwt.sign(
        { id: req.user.id, email: req.user.email, username },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
    }
    res.json({
      message: 'Podaci uspešno ažurirani',
      user: { id: req.user.id, email: req.user.email, username: username ?? req.user.username },
      token: newToken,
    });
  } catch (err) {
    console.error('PATCH /api/user error:', err);
    res.status(500).json({ message: 'Greška pri ažuriranju' });
  }
});
// ================== FILMOVI (lokalna baza + owner CRUD + import) ==================

// Helper: mapiranje eksternog objekta u naš model
function mapExternalMovieToFilm(ext) {
  return {
    title: ext?.title || ext?.name || null,
    description: ext?.overview || ext?.description || null,
    director: (ext?.director && (ext.director.name || ext.director)) || ext?.director || null,
    release_date: (ext?.release_date || ext?.date || ext?.startDate || null)?.slice?.(0, 10) || null,
    genre: Array.isArray(ext?.genres)
      ? ext.genres.join(', ')
      : (Array.isArray(ext?.movieGenres)
          ? ext.movieGenres.map(g => g?.genre?.name).filter(Boolean).join(', ')
          : (ext?.genre || null)),
    runtime_minutes: ext?.runtime || ext?.runtime_minutes || null,
    poster_url: ext?.poster || ext?.poster_url || null,
    backdrop_url: ext?.backdrop || ext?.backdrop_url || null,
  };
}

// PUBLIC: lista aktivnih filmova
app.get('/api/films', async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id,title,description,director,release_date,genre,runtime_minutes,poster_url,backdrop_url,active
       FROM films
       WHERE active=1
       ORDER BY title`
    );
    res.json(rows);
  } catch (e) {
    console.error('GET /api/films error:', e);
    res.status(500).json({ message: 'Greška' });
  }
});

// PUBLIC: jedan film po ID-u
app.get('/api/films/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.execute(`SELECT * FROM films WHERE id=:id`, { id });
    if (!rows.length) return res.status(404).json({ message: 'Film nije nađen' });
    res.json(rows[0]);
  } catch (e) {
    console.error('GET /api/films/:id error:', e);
    res.status(500).json({ message: 'Greška' });
  }
});

// OWNER: kreiranje filma ručno
app.post('/api/films', auth, checkRole('owner'), async (req, res) => {
  try {
    const {
      title, description=null, director=null, release_date=null, genre=null,
      runtime_minutes=null, poster_url=null, backdrop_url=null, active=1
    } = req.body || {};
    if (!title) return res.status(400).json({ message: 'Nedostaje title' });

    const [r] = await pool.execute(
      `INSERT INTO films
         (title,description,director,release_date,genre,runtime_minutes,poster_url,backdrop_url,active,is_overridden,last_synced_at)
       VALUES
         (:t,:d,:dir,:rd,:g,:rm,:p,:b,:a,1,NOW())`,
      { t:title, d:description, dir:director, rd:release_date, g:genre, rm:runtime_minutes, p:poster_url, b:backdrop_url, a: active ? 1 : 0 }
    );
    res.status(201).json({ id: r.insertId });
  } catch (e) {
    console.error('POST /api/films error:', e);
    res.status(500).json({ message: 'Greška pri kreiranju' });
  }
});

// OWNER: izmena
app.put('/api/films/:id', auth, checkRole('owner'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      title=null, description=null, director=null, release_date=null, genre=null,
      runtime_minutes=null, poster_url=null, backdrop_url=null, active=null
    } = req.body || {};

    const [r] = await pool.execute(
      `UPDATE films SET
         title=COALESCE(:t,title),
         description=COALESCE(:d,description),
         director=COALESCE(:dir,director),
         release_date=COALESCE(:rd,release_date),
         genre=COALESCE(:g,genre),
         runtime_minutes=COALESCE(:rm,runtime_minutes),
         poster_url=COALESCE(:p,poster_url),
         backdrop_url=COALESCE(:b,backdrop_url),
         active=COALESCE(:a,active),
         is_overridden=1
       WHERE id=:id`,
      { id, t:title, d:description, dir:director, rd:release_date, g:genre, rm:runtime_minutes, p:poster_url, b:backdrop_url, a:active }
    );
    if (!r.affectedRows) return res.status(404).json({ message: 'Film nije nađen' });
    res.json({ ok: true });
  } catch (e) {
    console.error('PUT /api/films/:id error:', e);
    res.status(500).json({ message: 'Greška pri izmeni' });
  }
});

// OWNER: brisanje
app.delete('/api/films/:id', auth, checkRole('owner'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [r] = await pool.execute(`DELETE FROM films WHERE id=:id`, { id });
    if (!r.affectedRows) return res.status(404).json({ message: 'Film nije nađen' });
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/films/:id error:', e);
    res.status(500).json({ message: 'Greška pri brisanju' });
  }
});

// OWNER: import po nazivu (search preko spoljnog API-ja)
app.post('/api/films/import', auth, checkRole('owner'), async (req, res) => {
  try {
    let q = String(req.body?.query || '').trim();
    if (!q) return res.status(400).json({ message: 'Nedostaje query' });

    // skini “pametne” navodnike i višak razmaka
    q = q.replace(/[“”„‟"']/g, '').replace(/\s+/g, ' ').trim();

    const base = process.env.EXT_API_BASE || 'https://movie.pequla.com';

    async function searchOnce(term) {
      const url = `${base}/api/movie?director=&actor=&search=${encodeURIComponent(term)}&genre=`;
      const r = await fetch(url);
      if (!r.ok) return null;
      const list = await r.json().catch(() => null);
      return (Array.isArray(list) && list.length) ? list : null;
    }

    // 1) pokušaj punog upita
    let list = await searchOnce(q);

    // 2) ako nema, probaj prvu ključnu reč (često pomaže)
    if (!list) {
      const firstWord = q.split(' ')[0];
      if (firstWord && firstWord.length >= 3) {
        list = await searchOnce(firstWord);
      }
    }

    if (!list) return res.status(404).json({ message: 'Nije nađen film na spoljnjem API-ju' });

    const ext = list[0];                 // uzmi prvi pogodak
    const f = mapExternalMovieToFilm(ext);
    if (!f.title) return res.status(400).json({ message: 'Nedostaje title iz API-ja' });

    const src = process.env.EXT_API_SOURCE || 'pequla';
    const eid = ext.id ?? ext.movieId ?? f.title; // fallback kada nema ID

    await pool.execute(
      `INSERT INTO films
         (title,description,director,release_date,genre,runtime_minutes,poster_url,backdrop_url,
          active, external_source, external_id, last_synced_at, is_overridden)
       VALUES
         (:t,:d,:dir,:rd,:g,:rm,:p,:b, 1, :src, :eid, NOW(), 0)
       ON DUPLICATE KEY UPDATE
         title=IF(is_overridden=1,title,VALUES(title)),
         description=IF(is_overridden=1,description,VALUES(description)),
         director=IF(is_overridden=1,director,VALUES(director)),
         release_date=IF(is_overridden=1,release_date,VALUES(release_date)),
         genre=IF(is_overridden=1,genre,VALUES(genre)),
         runtime_minutes=IF(is_overridden=1,runtime_minutes,VALUES(runtime_minutes)),
         poster_url=IF(is_overridden=1,poster_url,VALUES(poster_url)),
         backdrop_url=IF(is_overridden=1,backdrop_url,VALUES(backdrop_url)),
         last_synced_at=NOW(), active=1`,
      { t:f.title, d:f.description, dir:f.director, rd:f.release_date, g:f.genre, rm:f.runtime_minutes,
        p:f.poster_url, b:f.backdrop_url, src, eid }
    );

    const [rows] = await pool.execute(
      `SELECT id FROM films WHERE external_source=:s AND external_id=:e`,
      { s: src, e: eid }
    );
    res.status(201).json({ id: rows[0]?.id, imported: true, title: f.title });
  } catch (e) {
    console.error('POST /api/films/import error:', e);
    res.status(500).json({ message: 'Greška pri importu' });
  }
});




// ====== START ======
const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
