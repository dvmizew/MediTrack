# MediTrack

Progressive Web App for medication management and doctor–patient collaboration with gamified adherence (XP, streaks, badges).

## Core Features
- Doctor–patient invitations and treatment plans
- Medication doses with confirmation and snooze
- XP, streak, badge progression system
- Real-time chat and notifications
- Email/password + Google OAuth authentication
- Secure API (rate limiting, helmet, structured logging)
- **PWA: Installable on mobile/desktop, offline support**

## Stack
Frontend: SvelteKit 2.47, Svelte 5 (runes), TailwindCSS 4, Socket.IO client, Service Worker
Backend: Node.js, Express, TypeScript, PostgreSQL 16, Redis 7, Socket.IO, Passport, node-cron
Infrastructure: Docker Compose (Postgres, Redis), PWA-ready

## Quick Start

### Automated Setup (Recommended)
```bash
git clone https://github.com/dvmizew/MediTrack.git
cd MediTrack
./setup.sh
```

The script will:
- Install all dependencies (frontend + backend)
- Create `server/.env` with auto-generated JWT secret
- Start Postgres + Redis containers
- Auto-seed database with test users

Then start the servers:
```bash
# Terminal 1 - Backend
cd server && npm run dev

# Terminal 2 - Frontend
npm run dev
```

Open http://localhost:5173

### Manual Setup
```bash
# 1. Clone
git clone https://github.com/dvmizew/MediTrack.git
cd MediTrack

# 2. Install dependencies
npm install
cd server && npm install && cd ..

# 3. Setup environment
cp .env.example server/.env
sed -i "s/generate_random_32_char_secret_with_openssl_rand_base64_32/$(openssl rand -base64 32)/" server/.env

# 4. Start infrastructure
docker compose up -d
sleep 5

# 5. Start servers
cd server && npm run dev &
npm run dev
```

### Reset Database (if needed)
```bash
docker exec -i meditrack-db psql -U meditrack -d meditrack < server/database/init.sql
```

## Test Credentials
**Admin:**
- email: admin@meditrack.com
- password: admin123

**Sample Medics** (all with password: medic123):
- dr.ionescu@meditrack.com
- dr.popescu@meditrack.com
- dr.radu@meditrack.com

**Sample Patients** (all with password: pacient123):
- ion.vasile@example.com
- ana.mihai@example.com
- george.popa@example.com

## Environment Variables
All required variables have defaults in `.env.example` that work with `docker-compose.yml`:
- Database: `DB_HOST=localhost`, `DB_USER=meditrack`, `DB_PASSWORD=meditrack_dev_password`
- Redis: `REDIS_URL=redis://localhost:6379`
- JWT: `JWT_SECRET` (auto-generated in setup)
- Frontend: `FRONTEND_URL=http://localhost:5173`

Optional (leave empty to skip):
- Google OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- SMTP: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`
- Web Push: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`

## Scripts
Frontend: dev, build, preview, test
Backend: dev, build, start