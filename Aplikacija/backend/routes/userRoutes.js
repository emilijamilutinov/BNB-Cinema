// backend/routes/userRoutes.js
const router = require('express').Router();
const bcrypt = require('bcrypt');
const db = require('../config/db'); // koristim zajednički pool (mysql2/promise)

// PATCH jer su polja opcionalna
router.patch('/update', async (req, res) => {
  try {
    const { email, username, password } = req.body;
    if (!email) return res.status(400).json({ message: 'Email je obavezan' });

    const sets = [];
    const vals = [];

    if (username) {
      sets.push('username = ?');
      vals.push(username);
    }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      sets.push('password_hash = ?');
      vals.push(hash);
    }

    if (!sets.length) {
      return res.status(400).json({ message: 'Nema polja za ažuriranje' });
    }

    const sql = `UPDATE users SET ${sets.join(', ')} WHERE email = ?`;
    vals.push(email);

    const [result] = await db.execute(sql, vals);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Korisnik nije pronađen' });
    }

    res.json({ message: 'Podaci uspešno ažurirani' });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ message: 'Greška pri ažuriranju podataka' });
  }
});

module.exports = router;
