-- Performance Optimization Indexes for MediTrack
-- These indexes optimize the most frequently used queries

-- 1. User lookups and filtering
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- 2. Doctor-Patient relationships (critical for collaboration lookups)
CREATE INDEX IF NOT EXISTS idx_doctor_patient_doctor_id ON doctor_patient(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_patient_patient_id ON doctor_patient(patient_id);
CREATE INDEX IF NOT EXISTS idx_doctor_patient_status ON doctor_patient(status_invitatie);
CREATE INDEX IF NOT EXISTS idx_doctor_patient_composite ON doctor_patient(doctor_id, status_invitatie);

-- 3. Treatment Plans (frequently filtered by patient/doctor and active status)
CREATE INDEX IF NOT EXISTS idx_treatment_plans_patient_id ON treatment_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatment_plans_doctor_id ON treatment_plans(doctor_id);
CREATE INDEX IF NOT EXISTS idx_treatment_plans_activ ON treatment_plans(activ);
CREATE INDEX IF NOT EXISTS idx_treatment_plans_is_deleted ON treatment_plans(is_deleted);
CREATE INDEX IF NOT EXISTS idx_treatment_plans_patient_activ ON treatment_plans(patient_id, activ) WHERE is_deleted = false;

-- 4. Treatment Doses (frequent adherence queries)
CREATE INDEX IF NOT EXISTS idx_treatment_doses_plan_id ON treatment_doses(plan_id);
CREATE INDEX IF NOT EXISTS idx_treatment_doses_is_active ON treatment_doses(is_active);
CREATE INDEX IF NOT EXISTS idx_treatment_doses_is_deleted ON treatment_doses(is_deleted);
CREATE INDEX IF NOT EXISTS idx_treatment_doses_start_date ON treatment_doses(start_date DESC);
CREATE INDEX IF NOT EXISTS idx_treatment_doses_plan_active ON treatment_doses(plan_id, is_active) WHERE is_deleted = false;

-- 5. Dose Confirmations (adherence tracking queries)
CREATE INDEX IF NOT EXISTS idx_dose_confirmations_scheduled_for ON dose_confirmations(scheduled_for DESC);
CREATE INDEX IF NOT EXISTS idx_dose_confirmations_dose_id ON dose_confirmations(dose_id);
CREATE INDEX IF NOT EXISTS idx_dose_confirmations_rezultat ON dose_confirmations(rezultat);
CREATE INDEX IF NOT EXISTS idx_dose_confirmations_recent ON dose_confirmations(scheduled_for DESC) WHERE rezultat = 'pozitiv';

-- 6. Patient Profiles (gamification stats lookups)
CREATE INDEX IF NOT EXISTS idx_patient_profiles_nivel_xp ON patient_profiles(nivel_xp DESC);
CREATE INDEX IF NOT EXISTS idx_patient_profiles_current_streak ON patient_profiles(current_streak DESC);
CREATE INDEX IF NOT EXISTS idx_patient_profiles_current_badge ON patient_profiles(current_badge);

-- 7. Messages (chat queries)
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(sender_id, receiver_id, created_at DESC);

-- 8. Notifications (user notification queries)
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(tip_notificare);
CREATE INDEX IF NOT EXISTS idx_notifications_user_recent ON notifications(user_id, created_at DESC) WHERE stare = 'sent';

-- 9. Leaderboard queries (frequently sorted by XP)
-- (patient_profiles already has nivel_xp index above)

-- 10. Admin reports queries - complex queries on multiple tables
-- Already covered above, but adding composite index for common admin report patterns
CREATE INDEX IF NOT EXISTS idx_treatment_plans_admin_report ON treatment_plans(patient_id, doctor_id, activ, is_deleted);

-- 11. Performance: ANALYZE tables for query optimizer
ANALYZE users;
ANALYZE doctor_patient;
ANALYZE treatment_plans;
ANALYZE treatment_doses;
ANALYZE dose_confirmations;
ANALYZE patient_profiles;
ANALYZE messages;
ANALYZE notifications;
