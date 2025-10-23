// backend/routes/authRoutes.js
const r = require('express').Router();
const c = require('../controllers/authController');

r.post('/signup', c.signup);
r.post('/login', c.login);
r.post('/logout', c.logout);

module.exports = r;
