-- MediTrack Database Schema

-- ENUM Types
CREATE TYPE user_role AS ENUM ('admin', 'medic', 'pacient');
CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'rejected');
CREATE TYPE dose_status AS ENUM ('pending', 'confirmed', 'missed');
CREATE TYPE notification_type AS ENUM ('reminder', 'alert', 'chat', 'invite', 'treatment_update');
CREATE TYPE notification_status AS ENUM ('sent', 'snoozed', 'ignored', 'read');
CREATE TYPE badge_type AS ENUM ('bronze', 'silver', 'gold', 'platinum', 'diamond');

-- 1. User Table
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    role user_role NOT NULL DEFAULT 'pacient',
    mfa_enabled BOOLEAN DEFAULT false,
    mfa_secret VARCHAR(255),
    mfa_backup_codes TEXT[],
    mfa_verified_at TIMESTAMP,
    google_id VARCHAR(255) UNIQUE,
    -- Profile data
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50),
    date_of_birth DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. PatientProfile Table
CREATE TABLE patient_profiles (
    patient_id INTEGER PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    nivel_xp INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    progres_total INTEGER DEFAULT 0,
    current_badge badge_type,
    last_activity TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. DoctorPatient Table (M:N relationship)
CREATE TABLE doctor_patient (
    id SERIAL PRIMARY KEY,
    doctor_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    patient_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    status_invitatie invite_status DEFAULT 'pending',
    invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP,
    UNIQUE(doctor_id, patient_id),
    CHECK (doctor_id != patient_id)
);

-- 4. TreatmentPlan Table
CREATE TABLE treatment_plans (
    plan_id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    doctor_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    diagnoza TEXT NOT NULL,
    descriere TEXT,
    data_creare TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activ BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. TreatmentDose Table
CREATE TABLE treatment_doses (
    dose_id SERIAL PRIMARY KEY,
    plan_id INTEGER NOT NULL REFERENCES treatment_plans(plan_id) ON DELETE CASCADE,
    ora TIME NOT NULL,
    cantitate VARCHAR(100) NOT NULL,
    detalii_medicament TEXT NOT NULL,
    medication_name VARCHAR(255) NOT NULL,
    frecventa VARCHAR(100),
    instructiuni TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    status dose_status DEFAULT 'pending',
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. DoseConfirmation Table
CREATE TABLE dose_confirmations (
    confirm_id SERIAL PRIMARY KEY,
    dose_id INTEGER NOT NULL REFERENCES treatment_doses(dose_id) ON DELETE CASCADE,
    timestamp_confirmare TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    rezultat VARCHAR(20) CHECK (rezultat IN ('pozitiv', 'negativ')),
    scheduled_for TIMESTAMP NOT NULL,
    snoozed_until TIMESTAMP,
    xp_earned INTEGER DEFAULT 0,
    notes TEXT
);

-- Create unique index for dose confirmations per day instead of constraint
CREATE UNIQUE INDEX idx_dose_confirmations_unique_per_day ON dose_confirmations(dose_id, DATE(scheduled_for));

-- 7. Message Table (Chat)
CREATE TABLE messages (
    message_id SERIAL PRIMARY KEY,
    sender_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    receiver_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    continut TEXT NOT NULL,
    timestamp_mesaj TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_read BOOLEAN DEFAULT false,
    CHECK (sender_id != receiver_id)
);

-- 8. Notification Table
CREATE TABLE notifications (
    notif_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    tip notification_type NOT NULL,
    status_notif notification_status DEFAULT 'sent',
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    reference_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP
);

-- Push Notifications Subscriptions
CREATE TABLE push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    endpoint VARCHAR(500) NOT NULL,
    auth VARCHAR(100) NOT NULL,
    p256dh VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, endpoint)
);

-- ==================== TRIGGERS & FUNCTIONS ====================

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patient_profiles_updated_at BEFORE UPDATE ON patient_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_treatment_plans_updated_at BEFORE UPDATE ON treatment_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_treatment_doses_updated_at BEFORE UPDATE ON treatment_doses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Report Jobs Table (for async report generation)
CREATE TYPE report_type AS ENUM ('users', 'treatments', 'doses', 'adherence', 'full_system');
CREATE TYPE job_status AS ENUM ('pending', 'processing', 'completed', 'failed');

CREATE TABLE report_jobs (
    job_id SERIAL PRIMARY KEY,
    report_type report_type NOT NULL,
    requested_by INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    status job_status DEFAULT 'pending',
    file_path TEXT,
    file_size INTEGER,
    error_message TEXT,
    is_anonymous BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    expires_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '24 hours'
);

-- ==================== SEED DATA ====================

-- Initial admin user (password: admin123)
INSERT INTO users (email, password_hash, full_name, role, mfa_enabled) 
VALUES ('admin@meditrack.com', '$2b$10$IEHnky61cn5S91TjmW1icuIhhpAeRuUGxct9aoy1BCEfVmTQF3cti', 'Admin User', 'admin', false)
ON CONFLICT (email) DO NOTHING;

-- Sample doctors (password for all: medic123)
INSERT INTO users (email, password_hash, full_name, role, phone_number, date_of_birth, mfa_enabled) VALUES
('dr.ionescu@meditrack.com', '$2b$10$6fmynm8rzot7UDz/sxFckeJio3grIwnpjmJFlgr7pXPIzosR.P3ru', 'Dr. Alexandru Ionescu', 'medic', '+40721234567', '1975-03-15', false),
('dr.popescu@meditrack.com', '$2b$10$6fmynm8rzot7UDz/sxFckeJio3grIwnpjmJFlgr7pXPIzosR.P3ru', 'Dr. Maria Popescu', 'medic', '+40722345678', '1980-07-22', false),
('dr.radu@meditrack.com', '$2b$10$6fmynm8rzot7UDz/sxFckeJio3grIwnpjmJFlgr7pXPIzosR.P3ru', 'Dr. Andrei Radu', 'medic', '+40723456789', '1978-11-08', false),
('dr.stan@meditrack.com', '$2b$10$6fmynm8rzot7UDz/sxFckeJio3grIwnpjmJFlgr7pXPIzosR.P3ru', 'Dr. Elena Stan', 'medic', '+40724567890', '1982-05-30', false),
('dr.gheorghe@meditrack.com', '$2b$10$6fmynm8rzot7UDz/sxFckeJio3grIwnpjmJFlgr7pXPIzosR.P3ru', 'Dr. Mihai Gheorghe', 'medic', '+40725678901', '1976-09-12', false),
('dr.marinescu@meditrack.com', '$2b$10$6fmynm8rzot7UDz/sxFckeJio3grIwnpjmJFlgr7pXPIzosR.P3ru', 'Dr. Ioana Marinescu', 'medic', '+40726789012', '1985-02-18', false)
ON CONFLICT (email) DO NOTHING;

-- Sample patients (password for all: pacient123)
INSERT INTO users (email, password_hash, full_name, role, phone_number, date_of_birth, mfa_enabled) VALUES
('ion.vasile@example.com', '$2b$10$Ev6rrNO/Hxm.SPg2jMHnq.HDCWh9LYaj9FN5h.CdHpwd41tN9tBE6', 'Ion Vasile', 'pacient', '+40731234567', '1990-06-15', false),
('ana.mihai@example.com', '$2b$10$Ev6rrNO/Hxm.SPg2jMHnq.HDCWh9LYaj9FN5h.CdHpwd41tN9tBE6', 'Ana Mihai', 'pacient', '+40732345678', '1985-09-22', false),
('george.popa@example.com', '$2b$10$Ev6rrNO/Hxm.SPg2jMHnq.HDCWh9LYaj9FN5h.CdHpwd41tN9tBE6', 'George Popa', 'pacient', '+40733456789', '1992-03-10', false),
('maria.tudor@example.com', '$2b$10$Ev6rrNO/Hxm.SPg2jMHnq.HDCWh9LYaj9FN5h.CdHpwd41tN9tBE6', 'Maria Tudor', 'pacient', '+40734567890', '1988-12-05', false),
('alex.costa@example.com', '$2b$10$Ev6rrNO/Hxm.SPg2jMHnq.HDCWh9LYaj9FN5h.CdHpwd41tN9tBE6', 'Alexandru Costa', 'pacient', '+40735678901', '1995-07-18', false),
('elena.dumitrescu@example.com', '$2b$10$Ev6rrNO/Hxm.SPg2jMHnq.HDCWh9LYaj9FN5h.CdHpwd41tN9tBE6', 'Elena Dumitrescu', 'pacient', '+40736789012', '1991-11-25', false),
('cristian.ion@example.com', '$2b$10$Ev6rrNO/Hxm.SPg2jMHnq.HDCWh9LYaj9FN5h.CdHpwd41tN9tBE6', 'Cristian Ion', 'pacient', '+40737890123', '1987-04-08', false),
('diana.matei@example.com', '$2b$10$Ev6rrNO/Hxm.SPg2jMHnq.HDCWh9LYaj9FN5h.CdHpwd41tN9tBE6', 'Diana Matei', 'pacient', '+40738901234', '1993-08-14', false)
ON CONFLICT (email) DO NOTHING;

-- Ensure all patients have an empty patient_profile (defaults: 0/bronze)
INSERT INTO patient_profiles (patient_id)
SELECT user_id FROM users WHERE role = 'pacient'
ON CONFLICT (patient_id) DO NOTHING;