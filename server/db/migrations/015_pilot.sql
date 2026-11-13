-- 青鸟 Pilot（iriva.life 交接版）所需的数据。
-- 沿用现有 users / auth_sessions / households / memberships / sessions，
-- 只在这些表上补列；Pilot 独有的概念放进新表。
ALTER TABLE households ADD COLUMN code TEXT;
ALTER TABLE households ADD COLUMN week INTEGER NOT NULL DEFAULT 1;
ALTER TABLE households ADD COLUMN duration INTEGER NOT NULL DEFAULT 4;
-- 已有的小组补一个邀请码，Host 和运营台都能看到它们。
UPDATE households SET code = lower(hex(randomblob(16))) WHERE code IS NULL;
CREATE UNIQUE INDEX households_code ON households(code);

ALTER TABLE memberships ADD COLUMN display_name TEXT NOT NULL DEFAULT '';
ALTER TABLE memberships ADD COLUMN timezone TEXT NOT NULL DEFAULT '';

-- kind: roundtable 小组圆桌 / one-to-one Host 一对一 / practice 指定伙伴练习
ALTER TABLE sessions ADD COLUMN kind TEXT NOT NULL DEFAULT 'roundtable';
ALTER TABLE sessions ADD COLUMN creator_id TEXT;
ALTER TABLE sessions ADD COLUMN pair_id TEXT;
ALTER TABLE sessions ADD COLUMN participant_id TEXT;

CREATE TABLE household_messages (id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id), author_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX household_messages_recent ON household_messages(household_id, created_at);

CREATE TABLE member_applications (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id), email TEXT NOT NULL, name TEXT NOT NULL,
  role TEXT NOT NULL, language TEXT NOT NULL, goal TEXT NOT NULL, level TEXT NOT NULL, timezone TEXT NOT NULL,
  availability TEXT NOT NULL, availability_slots TEXT NOT NULL DEFAULT '[]', contact_preference TEXT NOT NULL DEFAULT 'email',
  revision INTEGER NOT NULL DEFAULT 0, updated TEXT NOT NULL DEFAULT '', interests TEXT NOT NULL, contact TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'native', age_band TEXT NOT NULL DEFAULT '', life_stage TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '', mbti TEXT NOT NULL DEFAULT '', partner_preferences TEXT NOT NULL DEFAULT '',
  suggestion TEXT NOT NULL DEFAULT '', oral_level TEXT NOT NULL DEFAULT '', oral_notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new', notes TEXT NOT NULL DEFAULT '', household TEXT, created TEXT NOT NULL
);
CREATE INDEX member_applications_created ON member_applications(created);

CREATE TABLE placements (email TEXT PRIMARY KEY, household TEXT NOT NULL, role TEXT NOT NULL, name TEXT NOT NULL);
CREATE TABLE team_members (email TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE team_tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL, assignee TEXT NOT NULL, due TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, created TEXT NOT NULL);

CREATE TABLE practice_pairs (id TEXT PRIMARY KEY, household TEXT NOT NULL, first TEXT NOT NULL, second TEXT NOT NULL, url TEXT NOT NULL DEFAULT '', slot INTEGER NOT NULL DEFAULT 0);
CREATE UNIQUE INDEX practice_pair_slot ON practice_pairs(household, slot);

CREATE TABLE notifications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, session TEXT NOT NULL, kind TEXT NOT NULL, due TEXT NOT NULL, read INTEGER NOT NULL DEFAULT 0);
CREATE UNIQUE INDEX notification_once ON notifications(user_id, session, kind);

CREATE TABLE practice_invites (id TEXT PRIMARY KEY, household TEXT NOT NULL, pair TEXT NOT NULL, sender TEXT NOT NULL, recipient TEXT NOT NULL, topic TEXT NOT NULL, at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', version INTEGER NOT NULL DEFAULT 0, session TEXT, created TEXT NOT NULL, updated TEXT NOT NULL);
CREATE UNIQUE INDEX one_pending_per_pair ON practice_invites(pair) WHERE status = 'pending';

CREATE TABLE coach_drafts (id TEXT PRIMARY KEY, owner TEXT NOT NULL, household TEXT NOT NULL, topic TEXT NOT NULL, goal TEXT NOT NULL, story TEXT NOT NULL, outline TEXT NOT NULL, reflection TEXT NOT NULL, feedback TEXT NOT NULL, updated TEXT NOT NULL);
CREATE TABLE coach_usage (id TEXT PRIMARY KEY, count INTEGER NOT NULL);

-- “给青鸟的建议”；现有的 feedback 表是 Host 对练习的反馈，名字不能共用。
CREATE TABLE suggestions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, email TEXT NOT NULL, category TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new', created TEXT NOT NULL);
CREATE INDEX suggestions_user_created ON suggestions(user_id, created);
