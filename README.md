# MediTrack

A gamified medication management platform for doctor-patient collaboration, built with SvelteKit.

## Features

- 🏥 **Doctor-Patient Collaboration** - Secure invitations and treatment management
- 💊 **Medication Tracking** - Schedule doses with reminders and confirmations
- 🎮 **Gamification** - XP points, badges, and streak system to boost adherence
- 💬 **Real-time Chat** - Direct messaging between doctors and patients
- 🔔 **Smart Notifications** - Medication reminders with snooze functionality
- 🔐 **Authentication** - JWT + OAuth2.0 Google login with MFA support

## Tech Stack

**Frontend:**
- SvelteKit 2.47 + Svelte 5
- TailwindCSS 4
- Socket.IO Client
- TypeScript

**Backend:**
- Node.js + Express + TypeScript
- PostgreSQL 16 (Docker)
- Redis 7 (Docker)
- Socket.IO for real-time features
- Node-cron for scheduled tasks
- Passport.js for OAuth

### Quick Start

1. **Clone repository**
```bash
git clone https://github.com/dvmizew/MediTrack.git
cd MediTrack
```

2. **Setup environment variables**
```bash
# Root directory
cp .env.example .env

# Server directory
cp server/.env.example server/.env
```

Edit `.env` files with your configuration:
- Database credentials
- JWT secret
- Google OAuth credentials (optional)

3. **Start Docker containers**
```bash
docker-compose up -d
```

4. **Install dependencies**
```bash
# Frontend
npm install

# Backend
cd server
npm install
```

5. **Run application**
```bash
# Terminal 1 - Backend (port 3000)
cd server
npm run dev

# Terminal 2 - Frontend (port 5173)
npm run dev
```

Visit `http://localhost:5173`

## Test Accounts

The following test accounts are pre-configured for immediate use:

| Role | Email | Password | Description |
|------|-------|----------|-------------|
| **Admin** | `admin@meditrack.com` | `admin123` | Full system access, user management |
| **Medic** | `medic@test.com` | `medic123` | Can accept invites, create treatment plans |
| **Pacient** | `pacient@test.com` | `pacient123` | Can send invites, confirm doses, earn XP |

### Testing Workflow

1. Login as **Pacient** → Send invite to `medic@test.com`
2. Login as **Medic** → Accept invitation
3. As **Medic** → Create treatment plan with diagnosis
4. As **Medic** → Add medication doses to plan
5. As **Pacient** → Confirm doses and earn XP/badges!

## Database Schema

8 main tables:
- **users** - User accounts (user_id, email, role, mfa_enabled)
- **patient_profiles** - Patient stats (nivel_xp, current_streak, badges)
- **doctor_patient** - Doctor-patient relationships
- **treatment_plans** - Medical treatment plans (diagnoza, descriere)
- **treatment_doses** - Medication schedules (ora, cantitate, frecventa)
- **dose_confirmations** - Medication intake logs (rezultat, xp_earned)
- **messages** - 1:1 user chat (sender_id, receiver_id, continut)
- **notifications** - Alerts with status (sent/snoozed/ignored/read)

## API Endpoints

- `POST /auth/register` - Create account
- `POST /auth/login` - Login
- `GET /auth/google` - OAuth login
- `GET /users/profile` - Get profile
- `POST /collaborations/invite` - Send doctor-patient invite
- `POST /treatments` - Create treatment plan
- `POST /doses` - Add medication to plan
- `POST /confirmations/confirm` - Confirm dose taken
- `GET /messages/conversation/:userId` - Get chat history

## Scripts

```bash
# Frontend
npm run dev          # Development server
npm run build        # Production build
npm run preview      # Preview production build
npm run check        # Type checking

# Backend
npm run dev          # Development with hot reload
npm run build        # Compile TypeScript
npm start            # Production server
```