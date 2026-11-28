CREATE TABLE application_recordings (
 application_id TEXT PRIMARY KEY REFERENCES member_applications(id) ON DELETE CASCADE,
 data_base64 TEXT NOT NULL, mime_type TEXT NOT NULL, duration INTEGER NOT NULL CHECK(duration BETWEEN 1 AND 120), updated TEXT NOT NULL
);
ALTER TABLE member_applications ADD COLUMN recording_updated TEXT NOT NULL DEFAULT '';
ALTER TABLE member_applications ADD COLUMN oral_score INTEGER CHECK(oral_score BETWEEN 0 AND 100);
ALTER TABLE member_applications ADD COLUMN oral_reviewed_at TEXT NOT NULL DEFAULT '';
ALTER TABLE member_applications ADD COLUMN oral_reviewer TEXT NOT NULL DEFAULT '';
