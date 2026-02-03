# MediTrack

Progressive Web App for medication management and doctor–patient collaboration with gamified adherence (XP, streaks, badges).

## Core Features

### Authentication & Security
- **Multi-factor Authentication (MFA/2FA)**: TOTP-based (Google Authenticator, Authy) with backup codes
- **Email/Password + Google OAuth**: Flexible authentication methods
- **Role-based Access Control**: Admin, Medic, Patient roles with specific permissions
- **Secure API**: Rate limiting, helmet, CORS, structured logging

### Doctor-Patient Collaboration
- **Invitations System**: Doctors can invite patients, patients can accept/reject
- **Treatment Plans**: Doctors create personalized medication schedules
- **Real-time Chat**: WebSocket-based messaging between doctors and patients
- **Collaboration Management**: View, manage, and terminate collaborations

### Medication Management
- **Dose Tracking**: Scheduled doses with status (pending, confirmed, missed)
- **Dose Confirmation**: Log doses with photo proof and notes
- **Snooze Functionality**: Postpone dose reminders
- **Treatment History**: Complete medication history and adherence tracking

### Gamification System
- **XP Points**: Earn experience for confirmed doses
- **Streaks**: Track consecutive days of adherence (current & longest)
- **Badges**: Bronze → Silver → Gold → Platinum → Diamond progression
- **Leaderboard**: Global, weekly, and monthly rankings

### Notifications
- **Push Notifications**: Browser push for dose reminders and alerts (VAPID)
- **Email Notifications**: Treatment updates and important alerts
- **Real-time Notifications**: In-app notification center with read/unread status
- **Notification Types**: Reminders, alerts, chat messages, invites, treatment updates

### Admin Panel
- **User Management**: View, activate, deactivate users
- **System Reports**: CSV export of user activity, treatments, doses
- **Platform Analytics**: Monitor system usage and health
- **Background Jobs**: Automated report generation with worker threads

### User Experience
- **Dashboard**: Personalized overview with stats, upcoming doses, recent activity
- **Profile Management**: View and edit profile, see statistics and badges
- **Settings**: Comprehensive settings page with:
  - Profile editing
  - Password change
  - MFA setup/disable
  - Push notification preferences
  - Accessibility options (text size, high contrast, reduce motion, reading mode)
  - Theme selection (light/dark/system)
  - Privacy controls (cookie preferences)
  - Account deletion
- **Accessibility**: WCAG-compliant with screen reader support, keyboard navigation

### PWA Capabilities
- **Installable**: Add to home screen on mobile and desktop
- **Offline Support**: Service worker caching for core functionality
- **Manifest**: Full PWA manifest with icons and theme colors

## Stack

**Frontend:**
- SvelteKit 2.47 (file-based routing, SSR/CSR)
- Svelte 5 (runes: $state, $derived, $effect)
- TailwindCSS 4 (utility-first styling)
- Chart.js (statistics visualization)
- Socket.IO client (real-time communication)
- Service Worker (offline support, push notifications)
- Lucide Icons

**Backend:**
- Node.js + Express (REST API)
- TypeScript (type safety)
- PostgreSQL 16 (relational database)
- Redis 7 (caching, session management)
- Socket.IO (WebSocket server)
- Passport.js (authentication strategies)
- node-cron (scheduled tasks for reminders and streaks)
- Multer (file uploads)
- Nodemailer (email sending)
- Winston (structured logging)

**Infrastructure:**
- Docker Compose (Postgres, Redis containers)
- VAPID (Web Push notifications)
- PWA-ready (manifest, service worker)

**Testing:**
- Vitest (unit tests)
- Playwright (E2E tests)
- Svelte Testing Library

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
NEW_SECRET=$(openssl rand -base64 32) && sed -i "s|generate_random_32_char_secret_with_openssl_rand_base64_32|$NEW_SECRET|" server/.env

# 4. Start infrastructure
docker compose up -d

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
- Web Push: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (auto-generated via script)
## Scripts

**Frontend:**
- `npm run dev` - Start development server (Vite HMR)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm test` - Run unit tests (Vitest)
- `npm run test:watch` - Run tests in watch mode
- `npm run test:e2e` - Run E2E tests (Playwright)
- `npm run check` - Type check with svelte-check
- `npm run lint` - Lint code with ESLint + Prettier

**Backend:**
- `npm run dev` - Start development server with tsx watch
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Start production server
- `npm test` - Run backend tests

**Database:**
- Reset: `docker exec -i meditrack-db psql -U meditrack -d meditrack < server/database/init.sql`
- Access: `docker exec -it meditrack-db psql -U meditrack -d meditrack`

## Implementation Details

### Cron Jobs (Automated Tasks)
- **Dose Reminders**: Every minute, checks for upcoming doses and sends notifications
- **Streak Calculation**: Daily at midnight, updates patient streaks based on adherence
- Both jobs use Redis locks to prevent duplicate execution

### Real-time Features
- **WebSocket Events**: `message`, `typing`, `online`, `dose-update`, `notification`
- **Socket Authentication**: JWT validation on connection
- **Room Management**: User-specific rooms for targeted messaging

### Caching Strategy
- **Leaderboard**: 5-minute Redis cache for performance
- **User Profiles**: Database queries with conditional caching
- **Toggle**: `ENABLE_CACHE` environment variable for development

### Gamification Mechanics
- **XP Calculation**: Base XP + bonus for on-time doses
- **Streak Rules**: Consecutive days with ≥1 confirmed dose
- **Badge Thresholds**: Bronze (0), Silver (100), Gold (500), Platinum (1000), Diamond (2500)

### Security Features
- **Rate Limiting**: Global (300 req/15min), Auth endpoints (20 req/15min)
- **Password Hashing**: bcrypt with salt rounds
- **JWT Expiration**: 24 hours, configurable
- **Input Sanitization**: DOMPurify for user-generated content
- **CSRF Protection**: SameSite cookies, secure headers

## Development Notes

### Database Schema
- **Users**: Core user data, authentication, MFA
- **Patient Profiles**: XP, streaks, badges
- **Doctor-Patient**: M:N relationship with invitation status
- **Treatment Plans**: Medication schedules with soft delete
- **Treatment Doses**: Individual dose instances with confirmations
- **Dose Confirmations**: Patient-logged dose data with XP earned
- **Messages**: Chat history with read/unread status
- **Notifications**: Multi-type notification system
- **Push Subscriptions**: Web Push endpoint storage

### Performance Optimizations
- Database indexes on foreign keys and frequently queried columns
- Redis caching for expensive queries
- Lazy loading of components
- Code splitting with SvelteKit
- Service worker caching for offline access

### Accessibility
- ARIA labels and roles throughout
- Keyboard navigation support
- Screen reader optimizations
- High contrast mode
- Reduced motion option
- Configurable text sizing