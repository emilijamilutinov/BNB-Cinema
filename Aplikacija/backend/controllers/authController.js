
const db = require('../config/db');   // mysql2/promise pool
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'; // duži rok za UX; promeni po potrebi

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

exports.signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'username, email i password su obavezni' });
    }

    const emailNorm = normalizeEmail(email);

    // 1) provera emaila (case-insensitive)
    const [exists] = await db.execute(
      'SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1',
      [emailNorm]
    );
    if (exists.length) {
      return res.status(409).json({ message: 'Email je već registrovan' });
    }

    // 2) hash lozinke
    const hash = await bcrypt.hash(password, 10);

    // 3) insert (role se podrazumevano čuva kao 'user' po šemi baze)
    const [result] = await db.execute(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, emailNorm, hash]
    );

    // 4) pročitaj novog korisnika (sa rolom)
    const [rows] = await db.execute(
      'SELECT id, username, email, role FROM users WHERE id = ?',
      [result.insertId]
    );
    const user = rows[0];

    // 5) napravi token (uključuje role)
    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(201).json({
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({
      message: 'Greška pri registraciji',
      code: err.code,
      detail: err.sqlMessage || err.message
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const emailNorm = normalizeEmail(email);

    const [rows] = await db.execute(
      'SELECT id, username, email, password_hash, role FROM users WHERE LOWER(email) = ? LIMIT 1',
      [emailNorm]
    );
    if (!rows.length) {
      return res.status(401).json({ message: 'Neispravan email ili lozinka' });
    }

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ message: 'Neispravan email ili lozinka' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Greška na serveru' });
  }
};

exports.logout = (_req, res) => {
  
  res.json({ message: 'Uspešno ste se odjavili' });
};
