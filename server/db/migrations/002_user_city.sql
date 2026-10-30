-- City is independent from IANA timezone; missing location stays unknown.
ALTER TABLE users ADD COLUMN city TEXT NOT NULL DEFAULT '';
