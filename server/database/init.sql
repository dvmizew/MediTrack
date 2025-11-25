-- MediTrack Database Schema - Updated Structure

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
    google_id VARCHAR(255) UNIQUE,
    -- Profile data
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50),
    date_of_birth DATE,
    avatar_url TEXT,
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

-- Indexes for Performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_role ON users(role);

CREATE INDEX idx_doctor_patient_doctor ON doctor_patient(doctor_id);
CREATE INDEX idx_doctor_patient_patient ON doctor_patient(patient_id);
CREATE INDEX idx_doctor_patient_status ON doctor_patient(status_invitatie);

CREATE INDEX idx_treatment_plans_patient ON treatment_plans(patient_id);
CREATE INDEX idx_treatment_plans_doctor ON treatment_plans(doctor_id);
CREATE INDEX idx_treatment_plans_active ON treatment_plans(activ);

CREATE INDEX idx_treatment_doses_plan ON treatment_doses(plan_id);
CREATE INDEX idx_treatment_doses_status ON treatment_doses(status);

CREATE INDEX idx_dose_confirmations_dose ON dose_confirmations(dose_id);
CREATE INDEX idx_dose_confirmations_scheduled ON dose_confirmations(scheduled_for);

CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_receiver ON messages(receiver_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp_mesaj);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_status ON notifications(status_notif);
CREATE INDEX idx_notifications_type ON notifications(tip);

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

-- Initial admin user (password: admin123)
-- Note: This is a placeholder hash, replace with actual bcrypt hash
INSERT INTO users (email, password_hash, full_name, role, mfa_enabled) 
VALUES ('admin@meditrack.com', '$2b$10$rVqK4KKzqVqK4KKzqVqK4ufQJFGXh8fQJFGXh8fQJFGXh8fQJFGXh8', 'Admin User', 'admin', false)
ON CONFLICT (email) DO NOTHING;
