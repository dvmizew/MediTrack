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

-- MFA Attempts (for rate limiting and security monitoring)
CREATE TABLE mfa_attempts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    ip_address VARCHAR(45),
    success BOOLEAN DEFAULT false,
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    code_length INTEGER
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

-- Create patient profiles first (with defaults)
INSERT INTO patient_profiles (patient_id)
SELECT user_id FROM users WHERE role = 'pacient'
ON CONFLICT (patient_id) DO NOTHING;

-- Update patient profiles with realistic XP, badges, and streaks
UPDATE patient_profiles
SET 
    nivel_xp = 150,
    current_badge = 'bronze',
    current_streak = 0,
    longest_streak = 3
WHERE patient_id = (SELECT user_id FROM users WHERE email = 'ion.vasile@example.com');

UPDATE patient_profiles
SET 
    nivel_xp = 875,
    current_badge = 'silver',
    current_streak = 12,
    longest_streak = 15
WHERE patient_id = (SELECT user_id FROM users WHERE email = 'ana.mihai@example.com');

UPDATE patient_profiles
SET 
    nivel_xp = 1650,
    current_badge = 'gold',
    current_streak = 8,
    longest_streak = 22
WHERE patient_id = (SELECT user_id FROM users WHERE email = 'george.popa@example.com');

UPDATE patient_profiles
SET 
    nivel_xp = 3200,
    current_badge = 'platinum',
    current_streak = 45,
    longest_streak = 67
WHERE patient_id = (SELECT user_id FROM users WHERE email = 'maria.tudor@example.com');

UPDATE patient_profiles
SET 
    nivel_xp = 5800,
    current_badge = 'diamond',
    current_streak = 52,
    longest_streak = 52
WHERE patient_id = (SELECT user_id FROM users WHERE email = 'alex.costa@example.com');

UPDATE patient_profiles
SET 
    nivel_xp = 420,
    current_badge = 'bronze',
    current_streak = 5,
    longest_streak = 8
WHERE patient_id = (SELECT user_id FROM users WHERE email = 'elena.dumitrescu@example.com');

UPDATE patient_profiles
SET 
    nivel_xp = 2100,
    current_badge = 'gold',
    current_streak = 18,
    longest_streak = 30
WHERE patient_id = (SELECT user_id FROM users WHERE email = 'cristian.ion@example.com');

UPDATE patient_profiles
SET 
    nivel_xp = 1890,
    current_badge = 'gold',
    current_streak = 14,
    longest_streak = 19
WHERE patient_id = (SELECT user_id FROM users WHERE email = 'diana.matei@example.com');

-- Create doctor-patient relationships
INSERT INTO doctor_patient (doctor_id, patient_id, status_invitatie, invited_at, responded_at)
SELECT 
    (SELECT user_id FROM users WHERE email = 'dr.ionescu@meditrack.com'),
    user_id,
    'accepted',
    CURRENT_TIMESTAMP - INTERVAL '30 days',
    CURRENT_TIMESTAMP - INTERVAL '29 days'
FROM users 
WHERE email IN ('ion.vasile@example.com', 'ana.mihai@example.com', 'george.popa@example.com')
ON CONFLICT (doctor_id, patient_id) DO UPDATE SET status_invitatie = 'accepted';

INSERT INTO doctor_patient (doctor_id, patient_id, status_invitatie, invited_at, responded_at)
SELECT 
    (SELECT user_id FROM users WHERE email = 'dr.popescu@meditrack.com'),
    user_id,
    'accepted',
    CURRENT_TIMESTAMP - INTERVAL '25 days',
    CURRENT_TIMESTAMP - INTERVAL '24 days'
FROM users 
WHERE email IN ('maria.tudor@example.com', 'alex.costa@example.com')
ON CONFLICT (doctor_id, patient_id) DO UPDATE SET status_invitatie = 'accepted';

INSERT INTO doctor_patient (doctor_id, patient_id, status_invitatie, invited_at, responded_at)
SELECT 
    (SELECT user_id FROM users WHERE email = 'dr.radu@meditrack.com'),
    user_id,
    'accepted',
    CURRENT_TIMESTAMP - INTERVAL '20 days',
    CURRENT_TIMESTAMP - INTERVAL '19 days'
FROM users 
WHERE email IN ('elena.dumitrescu@example.com', 'cristian.ion@example.com', 'diana.matei@example.com')
ON CONFLICT (doctor_id, patient_id) DO UPDATE SET status_invitatie = 'accepted';

-- Pending invitations
INSERT INTO doctor_patient (doctor_id, patient_id, status_invitatie, invited_at)
SELECT 
    (SELECT user_id FROM users WHERE email = 'dr.stan@meditrack.com'),
    (SELECT user_id FROM users WHERE email = 'ion.vasile@example.com'),
    'pending',
    CURRENT_TIMESTAMP - INTERVAL '2 days'
ON CONFLICT (doctor_id, patient_id) DO NOTHING;

-- Create treatment plans
WITH plans AS (
    SELECT * FROM (VALUES
        ('ion.vasile@example.com', 'dr.ionescu@meditrack.com', 'Hipertensiune arterială', 'Plan de tratament pentru controlul tensiunii arteriale. Monitorizare zilnică.', true, CURRENT_TIMESTAMP - INTERVAL '28 days'),
        ('ana.mihai@example.com', 'dr.ionescu@meditrack.com', 'Diabet zaharat tip 2', 'Control glicemie și administrare insulină. Dietă strict controlată.', true, CURRENT_TIMESTAMP - INTERVAL '45 days'),
        ('george.popa@example.com', 'dr.ionescu@meditrack.com', 'Astm bronșic', 'Tratament cu corticosteroizi inhalatori pentru control astm.', true, CURRENT_TIMESTAMP - INTERVAL '60 days'),
        ('maria.tudor@example.com', 'dr.popescu@meditrack.com', 'Hipotiroidism', 'Substituție hormonală cu levotiroxină. Control TSH lunar.', true, CURRENT_TIMESTAMP - INTERVAL '90 days'),
        ('alex.costa@example.com', 'dr.popescu@meditrack.com', 'Alergie sezonieră', 'Antihistaminice pentru control alergii. Administrare în perioada martie-iunie.', true, CURRENT_TIMESTAMP - INTERVAL '15 days'),
        ('cristian.ion@example.com', 'dr.radu@meditrack.com', 'Reflux gastroesofagian', 'Inhibitori pompă de protoni pentru protecție gastrică.', true, CURRENT_TIMESTAMP - INTERVAL '40 days'),
        ('diana.matei@example.com', 'dr.radu@meditrack.com', 'Migrene cronice', 'Plan preventiv cu beta-blocante și tratament de criză.', true, CURRENT_TIMESTAMP - INTERVAL '35 days')
    ) AS v(patient_email, doctor_email, diagnoza, descriere, activ, data_creare)
)
INSERT INTO treatment_plans (patient_id, doctor_id, diagnoza, descriere, activ, data_creare)
SELECT
    (SELECT user_id FROM users WHERE email = plans.patient_email),
    (SELECT user_id FROM users WHERE email = plans.doctor_email),
    plans.diagnoza,
    plans.descriere,
    plans.activ,
    plans.data_creare
FROM plans
WHERE NOT EXISTS (
    SELECT 1
    FROM treatment_plans tp
    WHERE tp.patient_id = (SELECT user_id FROM users WHERE email = plans.patient_email)
      AND tp.doctor_id = (SELECT user_id FROM users WHERE email = plans.doctor_email)
      AND tp.diagnoza = plans.diagnoza
      AND tp.is_deleted = false
);

-- Create treatment doses for active plans
-- Ion Vasile - Hipertensiune (2x/zi)
INSERT INTO treatment_doses (plan_id, medication_name, detalii_medicament, cantitate, ora, start_date, end_date)
SELECT 
    plan_id,
    'Losartan 50mg',
    'Tratament pentru hipertensiune arterială',
    '1 comprimat',
    '08:00',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days'
FROM (
        SELECT plan_id
        FROM treatment_plans
        WHERE patient_id = (SELECT user_id FROM users WHERE email = 'ion.vasile@example.com')
            AND diagnoza = 'Hipertensiune arterială'
            AND activ = true
            AND is_deleted = false
        ORDER BY data_creare DESC
        LIMIT 1
) tp
WHERE NOT EXISTS (
        SELECT 1 FROM treatment_doses td
        WHERE td.plan_id = tp.plan_id
          AND td.medication_name = 'Losartan 50mg'
          AND td.ora = '08:00'
          AND td.is_deleted = false
    )
ON CONFLICT DO NOTHING;

INSERT INTO treatment_doses (plan_id, medication_name, detalii_medicament, cantitate, ora, start_date, end_date)
SELECT 
    plan_id,
    'Losartan 50mg',
    'Tratament pentru hipertensiune arterială',
    '1 comprimat',
    '20:00',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days'
FROM (
        SELECT plan_id
        FROM treatment_plans
        WHERE patient_id = (SELECT user_id FROM users WHERE email = 'ion.vasile@example.com')
            AND diagnoza = 'Hipertensiune arterială'
            AND activ = true
            AND is_deleted = false
        ORDER BY data_creare DESC
        LIMIT 1
) tp
WHERE NOT EXISTS (
        SELECT 1 FROM treatment_doses td
        WHERE td.plan_id = tp.plan_id
          AND td.medication_name = 'Losartan 50mg'
          AND td.ora = '20:00'
          AND td.is_deleted = false
    )
ON CONFLICT DO NOTHING;

-- Ana Mihai - Diabet (3x/zi before meals)
INSERT INTO treatment_doses (plan_id, medication_name, detalii_medicament, cantitate, ora, start_date, end_date)
SELECT 
    plan_id,
    'Metformin 850mg',
    'Control glicemie - administrare înainte de mese',
    '1 comprimat',
    time_val::TIME,
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '60 days'
FROM (
        SELECT plan_id
        FROM treatment_plans
        WHERE patient_id = (SELECT user_id FROM users WHERE email = 'ana.mihai@example.com')
            AND diagnoza = 'Diabet zaharat tip 2'
            AND activ = true
            AND is_deleted = false
        ORDER BY data_creare DESC
        LIMIT 1
) tp
CROSS JOIN (VALUES ('07:30'), ('12:30'), ('19:00')) AS t(time_val)
WHERE NOT EXISTS (
        SELECT 1 FROM treatment_doses td
        WHERE td.plan_id = tp.plan_id
          AND td.medication_name = 'Metformin 850mg'
          AND td.ora = time_val::TIME
          AND td.is_deleted = false
    )
ON CONFLICT DO NOTHING;

-- George Popa - Astm (2x/zi)
INSERT INTO treatment_doses (plan_id, medication_name, detalii_medicament, cantitate, ora, start_date, end_date)
SELECT 
    plan_id,
    'Budesonide inhaler',
    'Corticosteroid inhalator pentru control astm',
    '2 inhalații',
    time_val::TIME,
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '90 days'
FROM (
        SELECT plan_id
        FROM treatment_plans
        WHERE patient_id = (SELECT user_id FROM users WHERE email = 'george.popa@example.com')
            AND diagnoza = 'Astm bronșic'
            AND activ = true
            AND is_deleted = false
        ORDER BY data_creare DESC
        LIMIT 1
) tp
CROSS JOIN (VALUES ('07:00'), ('21:00')) AS t(time_val)
WHERE NOT EXISTS (
        SELECT 1 FROM treatment_doses td
        WHERE td.plan_id = tp.plan_id
          AND td.medication_name = 'Budesonide inhaler'
          AND td.ora = time_val::TIME
          AND td.is_deleted = false
    )
ON CONFLICT DO NOTHING;

-- Maria Tudor - Hipotiroidism (1x/zi dimineața)
INSERT INTO treatment_doses (plan_id, medication_name, detalii_medicament, cantitate, ora, start_date, end_date)
SELECT 
    plan_id,
    'Levotiroxină 75mcg',
    'Substituție hormonală tiroidă',
    '1 comprimat',
    '06:30',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '90 days'
FROM (
        SELECT plan_id
        FROM treatment_plans
        WHERE patient_id = (SELECT user_id FROM users WHERE email = 'maria.tudor@example.com')
            AND diagnoza = 'Hipotiroidism'
            AND activ = true
            AND is_deleted = false
        ORDER BY data_creare DESC
        LIMIT 1
) tp
WHERE NOT EXISTS (
        SELECT 1 FROM treatment_doses td
        WHERE td.plan_id = tp.plan_id
          AND td.medication_name = 'Levotiroxină 75mcg'
          AND td.ora = '06:30'
          AND td.is_deleted = false
    )
ON CONFLICT DO NOTHING;

-- Note: Dose confirmations will be generated as patients take their medication
-- Historical data would require application logic to generate scheduled doses

-- Create some chat messages between doctors and patients 
INSERT INTO messages (sender_id, receiver_id, continut, timestamp_mesaj, is_read)
SELECT m.sender_id, m.receiver_id, m.continut, m.timestamp_mesaj, m.is_read
FROM (
    VALUES
        (
            (SELECT user_id FROM users WHERE email = 'dr.ionescu@meditrack.com'),
            (SELECT user_id FROM users WHERE email = 'ion.vasile@example.com'),
            'Buna ziua! Cum va simtiti astazi? Tensiunea arteriala este in parametri normali?',
            CURRENT_TIMESTAMP - INTERVAL '2 hours',
            true
        ),
        (
            (SELECT user_id FROM users WHERE email = 'ion.vasile@example.com'),
            (SELECT user_id FROM users WHERE email = 'dr.ionescu@meditrack.com'),
            'Buna ziua, doctor! Ma simt bine, am masurat tensiunea dimineata si era 130/85.',
            CURRENT_TIMESTAMP - INTERVAL '1 hour 45 minutes',
            true
        ),
        (
            (SELECT user_id FROM users WHERE email = 'dr.ionescu@meditrack.com'),
            (SELECT user_id FROM users WHERE email = 'ion.vasile@example.com'),
            'Perfect. Va rog sa continuati tratamentul in acelasi mod. Ne auzim saptamana viitoare pentru control.',
            CURRENT_TIMESTAMP - INTERVAL '1 hour 30 minutes',
            false
        ),
        (
            (SELECT user_id FROM users WHERE email = 'ana.mihai@example.com'),
            (SELECT user_id FROM users WHERE email = 'dr.ionescu@meditrack.com'),
            'Doctor, glicemia in jejun a fost 110 mg/dl. Este in regula?',
            CURRENT_TIMESTAMP - INTERVAL '3 hours',
            true
        ),
        (
            (SELECT user_id FROM users WHERE email = 'dr.ionescu@meditrack.com'),
            (SELECT user_id FROM users WHERE email = 'ana.mihai@example.com'),
            'Da, este un nivel bun. Va rog sa continuati cu dieta si medicatia. Felicitari pentru consecventa din ultimele 12 zile.',
            CURRENT_TIMESTAMP - INTERVAL '2 hours 30 minutes',
            true
        )
) AS m(sender_id, receiver_id, continut, timestamp_mesaj, is_read)
WHERE NOT EXISTS (
    SELECT 1 FROM messages x
    WHERE x.sender_id = m.sender_id
      AND x.receiver_id = m.receiver_id
      AND x.continut = m.continut
);

-- Create notifications 
INSERT INTO notifications (user_id, tip, status_notif, title, message, created_at, read_at)
SELECT n.user_id, n.tip::notification_type, n.status_notif::notification_status, n.title, n.message, n.created_at, n.read_at
FROM (
    VALUES
        (
            (SELECT user_id FROM users WHERE email = 'ion.vasile@example.com'),
            'reminder',
            'sent',
            'Reminder medicament',
            'Este timpul sa iei Losartan 50mg - 1 comprimat',
            CURRENT_TIMESTAMP + INTERVAL '30 minutes',
            NULL
        ),
        (
            (SELECT user_id FROM users WHERE email = 'ana.mihai@example.com'),
            'alert',
            'sent',
            'Felicitari pentru consecventa',
            'Ai atins 12 zile consecutive de respectare a tratamentului. Continua in acelasi ritm.',
            CURRENT_TIMESTAMP - INTERVAL '1 day',
            CURRENT_TIMESTAMP - INTERVAL '1 day' + INTERVAL '10 minutes'
        ),
        (
            (SELECT user_id FROM users WHERE email = 'george.popa@example.com'),
            'alert',
            'sent',
            'Badge nou: Gold',
            'Felicitari! Ai deblocat badge-ul Gold pentru 1500 XP.',
            CURRENT_TIMESTAMP - INTERVAL '3 days',
            CURRENT_TIMESTAMP - INTERVAL '3 days' + INTERVAL '5 minutes'
        ),
        (
            (SELECT user_id FROM users WHERE email = 'maria.tudor@example.com'),
            'alert',
            'sent',
            'Prag atins: 250 doze confirmate',
            'Ai confirmat 250 de doze de medicament. Iti multumim pentru consecventa.',
            CURRENT_TIMESTAMP - INTERVAL '1 week',
            CURRENT_TIMESTAMP - INTERVAL '1 week' + INTERVAL '15 minutes'
        ),
        (
            (SELECT user_id FROM users WHERE email = 'alex.costa@example.com'),
            'chat',
            'sent',
            'Mesaj nou de la Dr. Popescu',
            'Aveti un mesaj nou in chat',
            CURRENT_TIMESTAMP - INTERVAL '2 hours',
            NULL
        )
) AS n(user_id, tip, status_notif, title, message, created_at, read_at)
WHERE NOT EXISTS (
    SELECT 1 FROM notifications x
    WHERE x.user_id = n.user_id
    AND x.tip = n.tip::notification_type
      AND x.title = n.title
      AND x.message = n.message
);

-- Report success
DO $$
BEGIN
    RAISE NOTICE 'Database initialized successfully!';
    RAISE NOTICE ' Schema created with all tables and indexes';
    RAISE NOTICE ' Basic seed data (admin, doctors, patients)';
    RAISE NOTICE ' Demo data loaded:';
    RAISE NOTICE '  - Patient profiles with varying XP (150-5800) and badges (Bronze-Diamond)';
    RAISE NOTICE '  - Doctor-patient relationships';
    RAISE NOTICE '  - 7 active treatment plans with realistic diagnoses';
    RAISE NOTICE '  - Treatment doses (recurring schedules)';
    RAISE NOTICE '  - Chat messages and notifications';
    RAISE NOTICE '';
    RAISE NOTICE 'Test credentials:';
    RAISE NOTICE '  Admin:   admin@meditrack.com / admin123';
    RAISE NOTICE '  Doctor:  dr.ionescu@meditrack.com / medic123';
    RAISE NOTICE '  Patient: ion.vasile@example.com / pacient123';
END $$;