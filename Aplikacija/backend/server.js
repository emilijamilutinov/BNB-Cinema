const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), debug: true, });

console.log('ENV check:', { DB_USER: process.env.DB_USER, DB_NAME: process.env.DB_NAME });

require('./config/db'); // tek POSLE učitavanja env

// Aplikacija/backend/server.js
require('dotenv').config();
console.log('ENV check:', {
  DB_USER: process.env.DB_USER,
  DB_NAME: process.env.DB_NAME
});

require('./config/db'); // inicijalizuje MySQL pool (db.js)

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));



// health-check
app.get('/api/health', (_, res) => res.json({ ok: true }));

// rute (dodaj svoje po potrebi)
// app.use('/api/auth', require('./routes/authRoutes'));
// app.use('/api/users', require('./routes/userRoutes'));

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});
