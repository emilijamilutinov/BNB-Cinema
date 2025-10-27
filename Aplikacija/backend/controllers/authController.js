// backend/controllers/authController.js
const db = require('../config/db');   // mysql2/promise pool
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');     

exports.signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'username, email i password su obavezni' });
    }

    // 1) provera emaila
    const [exists] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (exists.length) {
      return res.status(409).json({ message: 'Email je već registrovan' });
    }

    // 2) hash lozinke
    const hash = await bcrypt.hash(password, 10);

    // 3) insert
    const [result] = await db.execute(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, hash]
    );

    return res.status(201).json({ id: result.insertId, username, email });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ message: 'Greška pri registraciji', code: err.code,
    detail: err.sqlMessage || err.message  });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const [rows] = await db.execute(
      'SELECT id, username, email, password_hash FROM users WHERE email = ?',
      [email]
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
      { id: user.id, email: user.email, username: user.username },
      process.env.JWT_SECRET || 'dev_secret_change_me',
      { expiresIn: '1h' }
    );

    return res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Greška na serveru' });
  }
};

exports.logout = (req, res) => {
  // kod stateless JWT "logout" je klijent-side (brisanje tokena).
  // ovde samo vraćamo poruku; 
  res.json({ message: 'Uspešno ste se odjavili' });
};
