CREATE TABLE activity_reflections (
 session_id TEXT NOT NULL REFERENCES sessions(id), learner_id TEXT NOT NULL REFERENCES users(id),
 moment TEXT NOT NULL, support TEXT NOT NULL, comfort INTEGER NOT NULL CHECK(comfort BETWEEN 1 AND 5),
 goal TEXT NOT NULL, expression TEXT NOT NULL DEFAULT '', submitted_at TEXT NOT NULL,
 PRIMARY KEY(session_id,learner_id)
);
CREATE INDEX reflections_learner ON activity_reflections(learner_id,submitted_at);
CREATE TABLE activity_observations (
 session_id TEXT NOT NULL REFERENCES sessions(id), learner_id TEXT NOT NULL REFERENCES users(id), host_id TEXT NOT NULL REFERENCES users(id),
 attendance TEXT NOT NULL CHECK(attendance IN ('present','absent','unknown')),
 moment TEXT NOT NULL DEFAULT '', invitation TEXT NOT NULL DEFAULT '', status TEXT NOT NULL CHECK(status IN ('draft','submitted')),
 version INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL,
 PRIMARY KEY(session_id,learner_id)
);
CREATE INDEX observations_learner ON activity_observations(learner_id);
CREATE INDEX observations_host ON activity_observations(host_id);
CREATE TABLE activity_cards (
 session_id TEXT NOT NULL REFERENCES sessions(id), learner_id TEXT NOT NULL REFERENCES users(id), editor_id TEXT NOT NULL REFERENCES users(id),
 noticed TEXT NOT NULL DEFAULT '', expression TEXT NOT NULL DEFAULT '', next_step TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL CHECK(status IN ('draft','published')), version INTEGER NOT NULL DEFAULT 1,
 published_at TEXT, updated_at TEXT NOT NULL,
 usefulness TEXT CHECK(usefulness IN ('yes','partly','no')), return_intent TEXT CHECK(return_intent IN ('yes','unsure','no')), responded_at TEXT,
 PRIMARY KEY(session_id,learner_id)
);
CREATE INDEX cards_learner ON activity_cards(learner_id,published_at);
CREATE INDEX cards_editor ON activity_cards(editor_id);
