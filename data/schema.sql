CREATE TABLE IF NOT EXISTS providers (
 id text PRIMARY KEY, name text NOT NULL, city text NOT NULL, category text NOT NULL CHECK(category IN ('Emergency','Urgent care','Specialty','General practice')),
 phone text, address text, website text, lat double precision, lng double precision,
 species text[] NOT NULL DEFAULT '{}', services text[] NOT NULL DEFAULT '{}', hours text NOT NULL DEFAULT 'Hours unknown',
 scope text NOT NULL DEFAULT '', cost_note text NOT NULL DEFAULT 'Cost information unavailable. Ask for an estimate.', exam_fee numeric CHECK(exam_fee >= 0),
 source_url text, source_checked timestamptz, source_kind text NOT NULL DEFAULT 'public', source_notes text NOT NULL DEFAULT '',
 partner boolean NOT NULL DEFAULT false, availability text NOT NULL DEFAULT 'Unknown' CHECK(availability IN ('Accepting','Limited','At capacity','Unknown')),
 availability_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1,
 field_overrides text[] NOT NULL DEFAULT '{}', simulated boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS interviews (source_id text PRIMARY KEY, provider_id text NOT NULL REFERENCES providers(id), raw jsonb NOT NULL, imported_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS intakes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider_id text NOT NULL REFERENCES providers(id), owner_session text NOT NULL,
 owner_name text NOT NULL, pet_name text NOT NULL, species text NOT NULL, concern text NOT NULL, duration text NOT NULL DEFAULT '', contact text NOT NULL,
 stage text NOT NULL DEFAULT 'New' CHECK(stage IN ('New','Reviewing','Expected','Arrived','In care','Discharged','Transferred')),
 urgency text NOT NULL DEFAULT 'Unassessed' CHECK(urgency IN ('Unassessed','Routine','Urgent','Critical')),
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), simulated boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS notes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), intake_id uuid NOT NULL REFERENCES intakes(id) ON DELETE CASCADE, body text NOT NULL, author text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), intake_id uuid NOT NULL REFERENCES intakes(id) ON DELETE CASCADE, body text NOT NULL, sender text NOT NULL CHECK(sender IN ('owner','clinic')), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS coverage (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider_id text NOT NULL REFERENCES providers(id), name text NOT NULL, role text NOT NULL, shift text NOT NULL, on_duty boolean NOT NULL DEFAULT true);
CREATE TABLE IF NOT EXISTS handoffs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), intake_id uuid NOT NULL REFERENCES intakes(id) ON DELETE CASCADE, from_provider text NOT NULL REFERENCES providers(id), to_provider text NOT NULL REFERENCES providers(id), summary text NOT NULL, status text NOT NULL DEFAULT 'Requested' CHECK(status IN ('Requested','Accepted','Declined')), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS events (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, kind text NOT NULL, provider_id text REFERENCES providers(id), metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS audit (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, entity text NOT NULL, entity_id text NOT NULL, action text NOT NULL, actor text NOT NULL, detail jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS imports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source text NOT NULL, rows_count integer NOT NULL, merged_count integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS conflicts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider_id text NOT NULL REFERENCES providers(id), field text NOT NULL, current_value jsonb, incoming_value jsonb, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','kept','applied')), created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS intake_provider_idx ON intakes(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS intake_session_idx ON intakes(owner_session);
CREATE INDEX IF NOT EXISTS event_time_idx ON events(created_at);
