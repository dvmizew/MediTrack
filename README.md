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

1. Clone
```bash
git clone https://github.com/dvmizew/MediTrack.git
cd MediTrack
```
2. Install dependencies
```bash
# Frontend
npm install

# Backend
cd server
npm install
```
3. Start infrastructure (Postgres + Redis with auto-seed)
```bash
docker compose up -d
```
4. Environment variables
```bash
cp server/.env.example server/.env
```
Edit `server/.env` as needed: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, REDIS_URL, JWT_SECRET, FRONTEND_URL, optional Google OAuth vars.

5. Run servers
```bash
# Backend (port 3000)
cd server
npm run dev
# Frontend (port 5173) in another terminal
cd ..
npm run dev
```

## Test Credentials
Admin account:
email: admin@meditrack.com
password: admin123

## Important Env Vars
DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
REDIS_URL
JWT_SECRET, JWT_EXPIRES_IN
FRONTEND_URL
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL (optional)

## Scripts
Frontend: dev, build, preview, test
Backend: dev, build, start

## Production Notes
- Replace placeholder admin password hash in `init.sql` with a real bcrypt hash before deploying.
- Ensure HTTPS for PWA to work (required for service workers)
- Update `SOCKET_URL` and `API_URL` in `src/lib/config.ts`
- Set strong JWT_SECRET.
- Configure HTTPS and a reverse proxy (e.g. nginx) for 3000/5173.
- Adjust rate limits in `server/src/index.ts` for expected traffic.