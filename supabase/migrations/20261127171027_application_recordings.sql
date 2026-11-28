CREATE TABLE iriva.application_recordings (
 application_id TEXT PRIMARY KEY REFERENCES iriva.member_applications(id) ON DELETE CASCADE,
 data_base64 TEXT NOT NULL, mime_type TEXT NOT NULL, duration INTEGER NOT NULL CHECK(duration BETWEEN 1 AND 120), updated TEXT NOT NULL
);
ALTER TABLE iriva.member_applications ADD COLUMN recording_updated TEXT NOT NULL DEFAULT '';
ALTER TABLE iriva.member_applications ADD COLUMN oral_score INTEGER CHECK(oral_score BETWEEN 0 AND 100);
ALTER TABLE iriva.member_applications ADD COLUMN oral_reviewed_at TEXT NOT NULL DEFAULT '';
ALTER TABLE iriva.member_applications ADD COLUMN oral_reviewer TEXT NOT NULL DEFAULT '';

ALTER TABLE iriva.application_recordings ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON iriva.application_recordings TO iriva_runtime;
CREATE POLICY server_access ON iriva.application_recordings TO iriva_runtime USING (true) WITH CHECK (true);
