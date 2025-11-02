// backend/routes/userRoutes.js
const router = require('express').Router();
const bcrypt = require('bcrypt');
const db = require('../config/db');              // mysql2/promise pool
const auth = require('../middlewares/auth');     // JWT -> req.user

// PATCH /api/user  (menja username/lozinku prijavljenog korisnika)
router.patch('/', auth, async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username && !password) {
      return res.status(400).json({ message: 'Nema polja za ažuriranje' });
    }

    const sets = [];
    const params = { id: req.user.id };

    if (username) {
      const u = String(username).trim();
      if (!u) return res.status(400).json({ message: 'Neispravno korisničko ime' });
      sets.push('username = :u');
      params.u = u;
    }

    if (password) {
      if (String(password).length < 6) {
        return res.status(400).json({ message: 'Lozinka mora imati bar 6 karaktera' });
      }
      const hash = await bcrypt.hash(password, 10);
      sets.push('password_hash = :p');
      params.p = hash;
    }

    const sql = `UPDATE users SET ${sets.join(', ')} WHERE id = :id`;
    const [result] = await db.execute(sql, params);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Korisnik nije pronađen' });
    }

    // (opciono) izdaj novi token ako se promeni username
    let token = null;
    if (username) {
      const jwt = require('jsonwebtoken');
      token = jwt.sign(
        { id: req.user.id, email: req.user.email, username, role: req.user.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
    }

    res.json({
      message: 'Podaci uspešno ažurirani',
      user: { id: req.user.id, email: req.user.email, username: username ?? req.user.username, role: req.user.role },
      token
    });
  } catch (err) {
    console.error('PATCH /api/user error:', err);
    res.status(500).json({ message: 'Greška pri ažuriranju' });
  }
});

module.exports = router;
