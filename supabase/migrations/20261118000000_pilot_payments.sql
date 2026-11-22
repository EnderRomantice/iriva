CREATE TABLE iriva.pilot_payments (household TEXT NOT NULL, user_id TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('paid','refunded')), amount_minor INTEGER NOT NULL DEFAULT 0, refunded_minor INTEGER NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT '', source TEXT NOT NULL CHECK(source IN ('stripe','manual')), stripe_session TEXT, payment_intent TEXT, updated TEXT NOT NULL, PRIMARY KEY (household, user_id));
CREATE INDEX pilot_payments_intent ON iriva.pilot_payments(payment_intent);

ALTER TABLE iriva.pilot_payments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON iriva.pilot_payments TO iriva_runtime;
CREATE POLICY server_access ON iriva.pilot_payments TO iriva_runtime USING (true) WITH CHECK (true);
