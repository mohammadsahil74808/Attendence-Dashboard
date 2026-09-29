-- ==============================================================================
-- Follow-Up Management System (FMS) - Supabase / PostgreSQL Schema
-- ==============================================================================

-- 1. Create Enums if they do not exist
DO $$ BEGIN
    CREATE TYPE userrole AS ENUM ('admin', 'member');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE contactstatus AS ENUM (
        'not_contacted', 'contacted', 'no_response', 'call_back_later',
        'follow_up_required', 'interested', 'not_interested', 'registered', 'closed'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE contactmethod AS ENUM (
        'phone_call', 'whatsapp', 'email', 'in_person', 'other'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE attemptoutcome AS ENUM (
        'reached', 'no_answer', 'busy', 'wrong_number',
        'switched_off', 'requested_callback', 'declined', 'other'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE registrationstatus AS ENUM (
        'not_registered', 'registration_pending', 'registered', 'registration_cancelled'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE paymentstatus AS ENUM ('na', 'pending', 'paid', 'refunded');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE followupstatus AS ENUM ('scheduled', 'completed', 'superseded', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE reminderstatus AS ENUM ('not_sent', 'sent', 'acknowledged');
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- 2. Create Tables

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role userrole NOT NULL DEFAULT 'member',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS import_batches (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(500) NOT NULL,
    imported_by_id INTEGER NOT NULL REFERENCES users(id),
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    row_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    mapping_config JSONB
);

CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    organization VARCHAR(255),
    designation VARCHAR(255),
    phone VARCHAR(50),
    whatsapp VARCHAR(50),
    email VARCHAR(255),
    city VARCHAR(100),
    source VARCHAR(255),
    notes TEXT,
    custom_fields JSONB,
    contact_status contactstatus NOT NULL DEFAULT 'not_contacted',
    assigned_to_id INTEGER REFERENCES users(id),
    import_batch_id INTEGER REFERENCES import_batches(id),
    is_archived BOOLEAN NOT NULL DEFAULT false,
    archived_at TIMESTAMPTZ,
    archived_by_id INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts(organization);
CREATE INDEX IF NOT EXISTS idx_contacts_assigned ON contacts(assigned_to_id);

CREATE TABLE IF NOT EXISTS contact_attempts (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    method contactmethod NOT NULL,
    performed_by_id INTEGER NOT NULL REFERENCES users(id),
    outcome attemptoutcome NOT NULL,
    notes TEXT,
    is_voided BOOLEAN NOT NULL DEFAULT false,
    void_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attempts_contact ON contact_attempts(contact_id);

CREATE TABLE IF NOT EXISTS feedback (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    contact_attempt_id INTEGER REFERENCES contact_attempts(id) ON DELETE SET NULL,
    received_bool BOOLEAN NOT NULL DEFAULT false,
    feedback_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    category VARCHAR(100),
    details TEXT,
    followup_required_bool BOOLEAN NOT NULL DEFAULT false,
    next_followup_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_feedback_contact ON feedback(contact_id);

CREATE TABLE IF NOT EXISTS registrations (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    status registrationstatus NOT NULL DEFAULT 'not_registered',
    registration_date TIMESTAMPTZ,
    registration_id_external VARCHAR(255),
    registration_type VARCHAR(255),
    payment_status paymentstatus DEFAULT 'na',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_registrations_contact ON registrations(contact_id);

CREATE TABLE IF NOT EXISTS follow_ups (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    followup_date TIMESTAMPTZ NOT NULL,
    preferred_time VARCHAR(50),
    reason TEXT,
    assigned_to_id INTEGER REFERENCES users(id),
    status followupstatus NOT NULL DEFAULT 'scheduled',
    reminder_status reminderstatus NOT NULL DEFAULT 'not_sent',
    created_from_type VARCHAR(50),
    created_from_id INTEGER,
    priority VARCHAR(20) NOT NULL DEFAULT 'normal',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_followups_contact ON follow_ups(contact_id);

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER NOT NULL,
    changed_by_id INTEGER NOT NULL REFERENCES users(id),
    field_changed VARCHAR(100),
    old_value TEXT,
    new_value TEXT,
    action VARCHAR(50) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);


-- 3. Seed Users (Default admin, member & Sahil Ansari)
INSERT INTO users (id, name, email, password_hash, role, is_active)
VALUES
    (1, 'System Administrator', 'admin@fms.internal', '$2b$12$lfUAnN7h2E4ljuDkc2HGtexTYyB/73OFvl09XKmuXrEQLyF5yFBHW', 'admin', true),
    (2, 'Sarah Outreach', 'member@fms.internal', '$2b$12$ArXwwT201ZHM0nHSM7eYpeZ9rfCX9mqiXER.upA8JaUxvPKIrteL2', 'member', true),
    (3, 'Sahil Ansari', 'sahilansari74808@gmail.com', '$2b$12$lfUAnN7h2E4ljuDkc2HGtexTYyB/73OFvl09XKmuXrEQLyF5yFBHW', 'admin', true)
ON CONFLICT (email) DO NOTHING;


-- 4. Restore/Migrate Contacts (All 5 contacts set to active: is_archived = false)
INSERT INTO contacts (id, name, organization, designation, phone, email, city, contact_status, is_archived, created_at, updated_at)
VALUES
    (1, 'sahil', 'lingayas vidyapeeth', 'faridabad', '9289345249', 'sahilansari74808@gmail.com', 'faridabad', 'registered', false, '2026-09-25 14:32:59+00', '2026-09-25 16:05:33+00'),
    (2, 'Sahil Ansari', NULL, NULL, '9289345248', 'sahilansari73808@gmail.com', NULL, 'follow_up_required', false, '2026-09-25 14:39:56+00', '2026-09-25 16:05:33+00'),
    (3, 'Sahil Ansari', NULL, NULL, '9289345240', 'sahilnsari74808@gmail.com', NULL, 'interested', false, '2026-09-25 15:02:01+00', '2026-09-25 16:05:33+00'),
    (4, 'Sahil Ansari', NULL, 'faridabad', '9289345288', 'sahilansar74808@gmail.com', NULL, 'contacted', false, '2026-09-25 15:03:52+00', '2026-09-25 16:05:33+00'),
    (5, 'Sahil Ansari', 'lingayas vidyapeeth', 'faridabad', '9289345249', 'sahilansari74808@gmail.com', NULL, 'interested', false, '2026-09-25 16:06:35+00', '2026-09-25 16:06:35+00')
ON CONFLICT (id) DO NOTHING;


-- 5. Restore Follow-ups
INSERT INTO follow_ups (id, contact_id, followup_date, preferred_time, reason, assigned_to_id, status, reminder_status, created_from_type, priority, created_at, updated_at)
VALUES
    (1, 2, '2026-09-26 15:05:00+00', '10 am', 'Follow-up required', 1, 'scheduled', 'not_sent', 'manual', 'normal', '2026-09-25 14:50:16+00', '2026-09-25 15:05:36+00'),
    (2, 4, '2026-09-25 15:04:29+00', NULL, 'Follow-up required', 1, 'completed', 'not_sent', 'manual', 'normal', '2026-09-25 15:04:29+00', '2026-09-25 15:05:52+00')
ON CONFLICT (id) DO NOTHING;


-- 6. Sync Auto-Increment Sequences
SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id), 1) FROM users));
SELECT setval('contacts_id_seq', (SELECT COALESCE(MAX(id), 1) FROM contacts));
SELECT setval('follow_ups_id_seq', (SELECT COALESCE(MAX(id), 1) FROM follow_ups));
SELECT setval('import_batches_id_seq', (SELECT COALESCE(MAX(id), 1) FROM import_batches));
SELECT setval('contact_attempts_id_seq', (SELECT COALESCE(MAX(id), 1) FROM contact_attempts));
SELECT setval('feedback_id_seq', (SELECT COALESCE(MAX(id), 1) FROM feedback));
SELECT setval('registrations_id_seq', (SELECT COALESCE(MAX(id), 1) FROM registrations));
SELECT setval('audit_logs_id_seq', (SELECT COALESCE(MAX(id), 1) FROM audit_logs));
