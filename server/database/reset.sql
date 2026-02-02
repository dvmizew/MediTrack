-- MediTrack Database Reset Script
-- This script drops all tables, types, and functions, then recreates everything

-- Drop all tables (in reverse dependency order)
DROP TABLE IF EXISTS report_jobs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS dose_confirmations CASCADE;
DROP TABLE IF EXISTS treatment_doses CASCADE;
DROP TABLE IF EXISTS treatment_plans CASCADE;
DROP TABLE IF EXISTS doctor_patient CASCADE;
DROP TABLE IF EXISTS patient_profiles CASCADE;
DROP TABLE IF EXISTS mfa_attempts CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop all ENUM types
DROP TYPE IF EXISTS job_status CASCADE;
DROP TYPE IF EXISTS report_type CASCADE;
DROP TYPE IF EXISTS badge_type CASCADE;
DROP TYPE IF EXISTS notification_status CASCADE;
DROP TYPE IF EXISTS notification_type CASCADE;
DROP TYPE IF EXISTS dose_status CASCADE;
DROP TYPE IF EXISTS invite_status CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Now recreate everything from init.sql
\i init.sql

-- Load sample data
\i sample-data.sql
