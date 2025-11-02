const r = require('express').Router();
const c = require('../controllers/authController');

// signup/login vraćaju token i user
r.post('/signup', c.signup);
r.post('/login', c.login);
r.post('/logout', c.logout);


r.get('/me', require('../middlewares/auth'), (req, res) => {
  
  res.json(req.user);
});

module.exports = r;

