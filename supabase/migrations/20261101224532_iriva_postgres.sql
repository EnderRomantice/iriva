-- Application data is server-only. Never expose this schema through the Data API.
CREATE SCHEMA IF NOT EXISTS iriva;
REVOKE ALL ON SCHEMA iriva FROM PUBLIC;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='iriva_runtime') THEN
    CREATE ROLE iriva_runtime NOLOGIN;
  END IF;
END $$;
GRANT USAGE ON SCHEMA iriva TO iriva_runtime;

CREATE TABLE iriva.users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, timezone TEXT NOT NULL, avatar TEXT NOT NULL, version INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, city TEXT NOT NULL DEFAULT '', signature TEXT NOT NULL DEFAULT '', mbti TEXT NOT NULL DEFAULT '', zodiac TEXT NOT NULL DEFAULT '', birth_chart TEXT NOT NULL DEFAULT '', occupation TEXT NOT NULL DEFAULT '', plan TEXT NOT NULL DEFAULT 'free', country_code TEXT NOT NULL DEFAULT '', host_qualifications JSONB NOT NULL DEFAULT '[]', host_featured INTEGER NOT NULL DEFAULT 0 CHECK(host_featured IN (0,1)), host_full_time INTEGER NOT NULL DEFAULT 0 CHECK(host_full_time IN (0,1)));

CREATE TABLE iriva.terms (id TEXT PRIMARY KEY, name TEXT NOT NULL, starts_on TEXT NOT NULL, ends_on TEXT NOT NULL, version INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);

CREATE TABLE iriva.households (id TEXT PRIMARY KEY, name TEXT NOT NULL, term_id TEXT NOT NULL, host_id TEXT NOT NULL, timezone TEXT NOT NULL, capacity INTEGER NOT NULL CHECK(capacity > 0), theme TEXT NOT NULL, version INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, organization_id TEXT NOT NULL DEFAULT '10000000-0000-4000-8000-000000001001');

CREATE TABLE iriva.memberships (id TEXT PRIMARY KEY, household_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('learner','host')), version INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(household_id, user_id));

CREATE TABLE iriva.sessions (id TEXT PRIMARY KEY, household_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('scheduled','completed','cancelled')), meeting_url TEXT NOT NULL, version INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, CHECK(ends_at > starts_at));

CREATE TABLE iriva.assignments (id TEXT PRIMARY KEY, household_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL CHECK(category IN ('prepare','practice','reflect')), due_at TEXT NOT NULL, week INTEGER NOT NULL CHECK(week BETWEEN 0 AND 6), version INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);

CREATE TABLE iriva.submissions (id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL, learner_id TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('draft','submitted')), completed INTEGER NOT NULL CHECK(completed IN (0,1)), version INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(assignment_id, learner_id));

CREATE TABLE iriva.feedback (id TEXT PRIMARY KEY, submission_id TEXT NOT NULL, author_id TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('draft','published')), version INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(submission_id, author_id));

CREATE TABLE iriva.applications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, goal TEXT NOT NULL, availability TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('new','contacted','enrolled')), version INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, organization_id TEXT NOT NULL DEFAULT '10000000-0000-4000-8000-000000001001');

CREATE TABLE iriva.enrollments (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, term_id TEXT NOT NULL, household_id TEXT NOT NULL, plan TEXT NOT NULL, amount_minor INTEGER NOT NULL CHECK(amount_minor >= 0), currency TEXT NOT NULL, payment_status TEXT NOT NULL CHECK(payment_status IN ('pending','paid')), version INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(user_id,term_id));

CREATE TABLE iriva.mutation_receipts (actor_id TEXT NOT NULL, command_id TEXT NOT NULL, version INTEGER NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(actor_id,command_id));

CREATE TABLE iriva.audit_events (id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, kind TEXT NOT NULL, entity_id TEXT NOT NULL, created_at TEXT NOT NULL);

CREATE TABLE iriva.organizations (id TEXT PRIMARY KEY, name TEXT NOT NULL, initials TEXT NOT NULL, color TEXT NOT NULL, version INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'platform' CHECK(kind IN ('platform','personal','host')), owner_id TEXT, parent_id TEXT, is_primary INTEGER NOT NULL DEFAULT 0);

CREATE TABLE iriva.organization_memberships (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('learn','host','ops')), version INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(organization_id,user_id,role));

CREATE TABLE iriva.channels (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('public','private','direct')),
  direct_key TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE iriva.channel_participants (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(channel_id,user_id)
);

CREATE TABLE iriva.credentials (user_id TEXT PRIMARY KEY, password_hash TEXT NOT NULL);

CREATE TABLE iriva.auth_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at BIGINT NOT NULL);

CREATE TABLE iriva.bookings (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, learner_id TEXT NOT NULL, host_id TEXT NOT NULL, channel_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected')), created_at TEXT NOT NULL, UNIQUE(organization_id, learner_id, host_id));

CREATE TABLE iriva.plan_orders (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, plan TEXT NOT NULL CHECK(plan IN ('lite','pro','max')), frequency INTEGER NOT NULL CHECK(frequency IN (1,2)), amount_minor INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL);

CREATE TABLE iriva.email_challenges (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed INTEGER NOT NULL DEFAULT 0,
  delivered INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE iriva.email_identities (user_id TEXT PRIMARY KEY, verified_at BIGINT NOT NULL);

CREATE TABLE iriva.messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  body TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  reactions JSONB NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(reactions)='array'),
  cards JSONB NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(cards)='array' AND jsonb_typeof(cards)='array' AND jsonb_array_length(cards)<=5),
  CHECK(length(trim(body))>0 OR jsonb_array_length(cards)>0)
);

CREATE TABLE iriva.host_grants (
 id TEXT PRIMARY KEY, platform_id TEXT NOT NULL,
 email TEXT NOT NULL, user_id TEXT,
 created_by TEXT NOT NULL, created_at TEXT NOT NULL,
 UNIQUE(platform_id,email)
);

CREATE TABLE iriva.group_requests (
 id TEXT PRIMARY KEY, platform_id TEXT NOT NULL,
 host_id TEXT NOT NULL, name TEXT NOT NULL, reason TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 workspace_id TEXT, reviewed_by TEXT,
 review_note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, reviewed_at TEXT
);

CREATE INDEX sessions_household_start ON iriva.sessions(household_id,starts_at);
CREATE INDEX assignments_household_due ON iriva.assignments(household_id,due_at);
CREATE INDEX submissions_learner ON iriva.submissions(learner_id);
CREATE INDEX feedback_submission ON iriva.feedback(submission_id);
CREATE INDEX applications_status ON iriva.applications(status);
CREATE INDEX memberships_user ON iriva.memberships(user_id);
CREATE INDEX households_organization ON iriva.households(organization_id);
CREATE INDEX applications_organization ON iriva.applications(organization_id);
CREATE INDEX organization_memberships_user ON iriva.organization_memberships(user_id);
CREATE INDEX channels_organization ON iriva.channels(organization_id);
CREATE UNIQUE INDEX channels_direct_pair ON iriva.channels(organization_id,direct_key) WHERE kind='direct';
CREATE INDEX channel_participants_user ON iriva.channel_participants(user_id);
CREATE INDEX email_challenges_email_created ON iriva.email_challenges(email, created_at);
CREATE INDEX messages_channel_time ON iriva.messages(channel_id,created_at,id);
CREATE UNIQUE INDEX one_primary_workspace ON iriva.organizations(owner_id) WHERE is_primary=1;
CREATE UNIQUE INDEX one_pending_group_request ON iriva.group_requests(platform_id,host_id) WHERE status='pending';
CREATE UNIQUE INDEX users_email_normalized ON iriva.users(lower(email));
CREATE UNIQUE INDEX host_grants_email_normalized ON iriva.host_grants(platform_id,lower(email));

ALTER TABLE iriva.users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON iriva.users FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON iriva.users TO iriva_runtime;
CREATE POLICY server_access ON iriva.users TO iriva_runtime USING (true) WITH CHECK (true);

ALTER TABLE iriva.terms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON iriva.terms FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON iriva.terms TO iriva_runtime;
CREATE POLICY server_access ON iriva.terms TO iriva_runtime USING (true) WITH CHECK (true);

ALTER TABLE iriva.households ADD CONSTRAINT households_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES iriva.organizations(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE iriva.households ADD CONSTRAINT households_host_id_fkey FOREIGN KEY (host_id) REFERENCES iriva.users(id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX households_host_id_idx ON iriva.households(host_id);
ALTER TABLE iriva.households ADD CONSTRAINT households_term_id_fkey FOREIGN KEY (term_id) REFERENCES iriva.terms(id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX households_term_id_idx ON iriva.households(term_id);
ALTER TABLE iriva.households ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON iriva.households FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON iriva.households TO iriva_runtime;
CREATE POLICY server_access ON iriva.households TO iriva_runtime USING (true) WITH CHECK (true);

ALTER TABLE iriva.memberships ADD CONSTRAINT memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES iriva.users(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE iriva.memberships ADD CONSTRAINT memberships_household_id_fkey FOREIGN KEY (household_id) REFERENCES iriva.households(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE iriva.memberships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON iriva.memberships FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON iriva.memberships TO iriva_runtime;
CREATE POLICY server_access ON iriva.memberships TO iriva_runtime USING (true) WITH CHECK (true);

ALTER TABLE iriva.sessions ADD CONSTRAINT sessions_household_id_fkey FOREIGN KEY (household_id) REFERENCES iriva.households(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE iriva.sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON iriva.sessions FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON iriva.sessions TO iriva_runtime;
CREATE POLICY server_access ON iriva.sessions TO iriva_runtime USING (true) WITH CHECK (true);

ALTER TABLE iriva.assignments ADD CONSTRAINT assignments_household_id_fkey FOREIGN KEY (household_id) REFERENCES iriva.households(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE iriva.assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON iriva.assignments FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON iriva.assignments TO iriva_runtime;
CREATE POLICY server_access ON iriva.assignments TO iriva_runtime USING (true) WITH CHECK (true);

ALTER TABLE iriva.submissions ADD CONSTRAINT submissions_learner_id_fkey FOREIGN KEY (learner_id) REFERENCES iriva.users(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE iriva.submissions ADD CONSTRAINT submissions_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES iriva.assignments(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE iriva.submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON iriva.submissions FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON iriva.submissions TO iriva_runtime;
CREATE POLICY server_access ON iriva.submissions TO iriva_runtime USING (true) WITH CHECK (true);

ALTER TABLE iriva.feedback ADD CONSTRAINT feedback_author_id_fkey FOREIGN KEY (author_id) REFERENCES iriva.users(id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX feedback_author_id_idx ON iriva.feedback(author_id);
ALTER TABLE iriva.feedback ADD CONSTRAINT feedback_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES iriva.submissions(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE iriva.feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON iriva.feedback FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON iriva.feedback TO iriva_runtime;
CREATE POLICY server_access ON iriva.feedback TO iriva_runtime USING (true) WITH CHECK (true);

ALTER TABLE iriva.applications ADD CONSTRAINT applications_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES iriva.organizations(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE iriva.applications ADD CONSTRAINT applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES iriva.users(id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX applications_user_id_idx ON iriva.applications(user_id);
ALTER TABLE iriva.applications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON iriva.applications FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON iriva.applications TO iriva_runtime;
CREATE POLICY server_access ON iriva.applications TO iriva_runtime USING (true) WITH CHECK (true);

ALTER TABLE iriva.enrollments ADD CONSTRAINT enrollments_household_id_fkey FOREIGN KEY (household_id) REFERENCES iriva.households(id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX enrollments_household_id_idx ON iriva.enrollments(household_id);
ALTER TABLE iriva.enrollments ADD CONSTRAINT enrollments_term_id_fkey FOREIGN KEY (term_id) REFERENCES iriva.terms(id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX enrollments_term_id_idx ON iriva.enrollments(term_id);
ALTER TABLE iriva.enrollments ADD CONSTRAINT enrollments_user_id_fkey FOREIGN KEY (user_id) REFERENCES iriva.users(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE iriva.enrollments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON iriva.enrollments FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON iriva.enrollments TO iriva_runtime;
CREATE POLICY server_access ON iriva.enrollments TO iriva_runtime USING (true) WITH CHECK (true);

ALTER TABLE iriva.mutation_receipts ADD CONSTRAINT mutation_receipts_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES iriva.users(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE iriva.mutation_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON iriva.mutation_receipts FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON iriva.mutation_receipts TO iriva_runtime;
CREATE POLICY server_access ON iriva.mutation_receipts TO iriva_runtime USING (true) WITH CHECK (true);

ALTER TABLE iriva.audit_events ADD CONSTRAINT audit_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES iriva.users(id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX audit_events_actor_id_idx ON iriva.audit_events(actor_id);
ALTER TABLE iriva.audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON iriva.audit_events FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON iriva.audit_events TO iriva_runtime;
CREATE POLICY server_access ON iriva.audit_events TO iriva_runtime USING (true) WITH CHECK (true);

ALTER TABLE iriva.organizations ADD CONSTRAINT organizations_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES iriva.organizations(id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX organizations_parent_id_idx ON iriva.organizations(parent_id);
ALTER TABLE iriva.organizations ADD CONSTRAINT organizations_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES iriva.users(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE iriva.organizations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON iriva.organizations FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON iriva.organizations TO iriva_runtime;
CREATE POLICY server_access ON iriva.organizations TO iriva_runtime USING (true) WITH CHECK (true);

ALTER TABLE iriva.organization_memberships ADD CONSTRAINT organization_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES iriva.users(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE iriva.organization_memberships ADD CONSTRAINT organization_memberships_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES iriva.organizations(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE iriva.organization_memberships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON iriva.organization_memberships FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON iriva.organization_memberships TO iriva_runtime;
CREATE POLICY server_access ON iriva.organization_memberships TO iriva_runtime USING (true) WITH CHECK (true);

ALTER TABLE iriva.channels ADD CONSTRAINT channels_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES iriva.users(id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX channels_owner_id_idx ON iriva.channels(owner_id);
ALTER TABLE iriva.channels ADD CONSTRAINT channels_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES iriva.organizations(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE iriva.channels ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON iriva.channels FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON iriva.channels TO iriva_runtime;
CREATE POLICY server_access ON iriva.channels TO iriva_runtime USING (true) WITH CHECK (true);

ALTER TABLE iriva.channel_participants ADD CONSTRAINT channel_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES iriva.users(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE iriva.channel_participants ADD CONSTRAINT channel_participants_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES iriva.channels(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE iriva.channel_participants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON iriva.channel_participants FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON iriva.channel_participants TO iriva_runtime;
CREATE POLICY server_access ON iriva.channel_participants TO iriva_runtime USING (true) WITH CHECK (true);

ALTER TABLE iriva.credentials ADD CONSTRAINT credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES iriva.users(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE iriva.credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON iriva.credentials FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON iriva.credentials TO iriva_runtime;
CREATE POLICY server_access ON iriva.credentials TO iriva_runtime USING (true) WITH CHECK (true);

ALTER TABLE iriva.auth_sessions ADD CONSTRAINT auth_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES iriva.users(id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX auth_sessions_user_id_idx ON iriva.auth_sessions(user_id);
ALTER TABLE iriva.auth_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON iriva.auth_sessions FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON iriva.auth_sessions TO iriva_runtime;
CREATE POLICY server_access ON iriva.auth_sessions TO iriva_runtime USING (true) WITH CHECK (true);

ALTER TABLE iriva.bookings ADD CONSTRAINT bookings_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES iriva.channels(id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX bookings_channel_id_idx ON iriva.bookings(channel_id);
ALTER TABLE iriva.bookings ADD CONSTRAINT bookings_host_id_fkey FOREIGN KEY (host_id) REFERENCES iriva.users(id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX bookings_host_id_idx ON iriva.bookings(host_id);
ALTER TABLE iriva.bookings ADD CONSTRAINT bookings_learner_id_fkey FOREIGN KEY (learner_id) REFERENCES iriva.users(id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX bookings_learner_id_idx ON iriva.bookings(learner_id);
ALTER TABLE iriva.bookings ADD CONSTRAINT bookings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES iriva.organizations(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE iriva.bookings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON iriva.bookings FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON iriva.bookings TO iriva_runtime;
CREATE POLICY server_access ON iriva.bookings TO iriva_runtime USING (true) WITH CHECK (true);

ALTER TABLE iriva.plan_orders ADD CONSTRAINT plan_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES iriva.users(id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX plan_orders_user_id_idx ON iriva.plan_orders(user_id);
ALTER TABLE iriva.plan_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON iriva.plan_orders FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON iriva.plan_orders TO iriva_runtime;
CREATE POLICY server_access ON iriva.plan_orders TO iriva_runtime USING (true) WITH CHECK (true);

ALTER TABLE iriva.email_challenges ADD CONSTRAINT email_challenges_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES iriva.organizations(id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX email_challenges_organization_id_idx ON iriva.email_challenges(organization_id);
ALTER TABLE iriva.email_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON iriva.email_challenges FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON iriva.email_challenges TO iriva_runtime;
CREATE POLICY server_access ON iriva.email_challenges TO iriva_runtime USING (true) WITH CHECK (true);

ALTER TABLE iriva.email_identities ADD CONSTRAINT email_identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES iriva.users(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE iriva.email_identities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON iriva.email_identities FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON iriva.email_identities TO iriva_runtime;
CREATE POLICY server_access ON iriva.email_identities TO iriva_runtime USING (true) WITH CHECK (true);

ALTER TABLE iriva.messages ADD CONSTRAINT messages_author_id_fkey FOREIGN KEY (author_id) REFERENCES iriva.users(id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX messages_author_id_idx ON iriva.messages(author_id);
ALTER TABLE iriva.messages ADD CONSTRAINT messages_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES iriva.channels(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE iriva.messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON iriva.messages FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON iriva.messages TO iriva_runtime;
CREATE POLICY server_access ON iriva.messages TO iriva_runtime USING (true) WITH CHECK (true);

ALTER TABLE iriva.host_grants ADD CONSTRAINT host_grants_created_by_fkey FOREIGN KEY (created_by) REFERENCES iriva.users(id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX host_grants_created_by_idx ON iriva.host_grants(created_by);
ALTER TABLE iriva.host_grants ADD CONSTRAINT host_grants_user_id_fkey FOREIGN KEY (user_id) REFERENCES iriva.users(id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX host_grants_user_id_idx ON iriva.host_grants(user_id);
ALTER TABLE iriva.host_grants ADD CONSTRAINT host_grants_platform_id_fkey FOREIGN KEY (platform_id) REFERENCES iriva.organizations(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE iriva.host_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON iriva.host_grants FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON iriva.host_grants TO iriva_runtime;
CREATE POLICY server_access ON iriva.host_grants TO iriva_runtime USING (true) WITH CHECK (true);

ALTER TABLE iriva.group_requests ADD CONSTRAINT group_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES iriva.users(id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX group_requests_reviewed_by_idx ON iriva.group_requests(reviewed_by);
ALTER TABLE iriva.group_requests ADD CONSTRAINT group_requests_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES iriva.organizations(id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX group_requests_workspace_id_idx ON iriva.group_requests(workspace_id);
ALTER TABLE iriva.group_requests ADD CONSTRAINT group_requests_host_id_fkey FOREIGN KEY (host_id) REFERENCES iriva.users(id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX group_requests_host_id_idx ON iriva.group_requests(host_id);
ALTER TABLE iriva.group_requests ADD CONSTRAINT group_requests_platform_id_fkey FOREIGN KEY (platform_id) REFERENCES iriva.organizations(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE iriva.group_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON iriva.group_requests FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON iriva.group_requests TO iriva_runtime;
CREATE POLICY server_access ON iriva.group_requests TO iriva_runtime USING (true) WITH CHECK (true);

-- Serializing on the organization also covers concurrent attempts to add groups.
CREATE FUNCTION iriva.enforce_owned_group() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE workspace_kind text;
BEGIN
  SELECT kind INTO workspace_kind FROM iriva.organizations WHERE id=NEW.organization_id FOR UPDATE;
  IF workspace_kind <> 'platform' AND EXISTS (SELECT FROM iriva.households WHERE organization_id=NEW.organization_id AND id<>NEW.id) THEN
    RAISE EXCEPTION 'A workspace already has a group' USING ERRCODE='23505';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION iriva.enforce_owned_group() FROM PUBLIC;
CREATE TRIGGER one_group_per_owned_workspace BEFORE INSERT OR UPDATE OF organization_id ON iriva.households FOR EACH ROW EXECUTE FUNCTION iriva.enforce_owned_group();
