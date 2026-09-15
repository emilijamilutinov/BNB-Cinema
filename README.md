# BNB Cinema

Veb aplikacija za pregled filmova i rezervaciju bioskopskih termina.

## Tehnologije

- **Frontend:** Angular
- **Backend:** Node.js / Express
- **Baza podataka:** MySQL

## Funkcionalnosti

- Registracija i prijava korisnika (JWT autentifikacija)
- Pregled liste filmova
- Rezervacija termina za projekcije
- Korisnički profil
- Stranica "O nama"

## Struktura projekta

```
si.25.54.bnb/
├── Aplikacija/
│   ├── src/                # Angular frontend
│   └── backend/            # Node/Express backend
└── Dokumentacija/           # Projektna dokumentacija (Word)
```

## Pokretanje projekta

### Backend

```bash
cd Aplikacija/backend
npm install
npm start
```

Backend očekuje `.env` fajl sa sledećim promenljivama (primer u `.env.example`):

```
PORT=4000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=auth_db
JWT_SECRET=
JWT_EXPIRES_IN=7d
```

Šemu baze pronađi u `Aplikacija/backend/db/schema.sql`.

### Frontend

```bash
cd Aplikacija
npm install
ng serve
```

Aplikacija je dostupna na `http://localhost:4200`.

## Dokumentacija

Projektna dokumentacija (vizija sistema, specifikacija zahteva, arhitektura, plan testiranja, korisničko uputstvo) nalazi se u folderu `Dokumentacija/`.


