// backend/routes/authRoutes.js
const r = require('express').Router();
const c = require('../controllers/authController');

// signup/login vraćaju token i user (uklj. role)
r.post('/signup', c.signup);
r.post('/login', c.login);
r.post('/logout', c.logout);

// ko sam ja (za FE da povuče role nakon logina ako treba)
r.get('/me', require('../middlewares/auth'), (req, res) => {
  // req.user dolazi iz JWT-a (id, email, username, role)
  res.json(req.user);
});

module.exports = r;
