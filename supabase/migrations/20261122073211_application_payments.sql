CREATE TABLE iriva.application_orders (
 id TEXT PRIMARY KEY, application_id TEXT NOT NULL REFERENCES iriva.member_applications(id),
 plan TEXT NOT NULL, language TEXT NOT NULL, amount_minor INTEGER NOT NULL CHECK(amount_minor>0),
 currency TEXT NOT NULL, created TEXT NOT NULL, UNIQUE(application_id,plan,language)
);
CREATE TABLE iriva.application_payments (
 stripe_session TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES iriva.application_orders(id),
 payment_intent TEXT NOT NULL UNIQUE, status TEXT NOT NULL CHECK(status IN ('paid','refunded')),
 amount_minor INTEGER NOT NULL, currency TEXT NOT NULL, refunded_minor INTEGER NOT NULL DEFAULT 0, updated TEXT NOT NULL
);
CREATE INDEX application_payments_order ON iriva.application_payments(order_id,status);
-- Refunds may arrive before checkout completion, or be retried out of order.
CREATE TABLE iriva.stripe_refunds (payment_intent TEXT PRIMARY KEY, amount_minor INTEGER NOT NULL, full_refund INTEGER NOT NULL DEFAULT 0, updated TEXT NOT NULL);
UPDATE iriva.member_applications SET status='awaiting_payment',revision=revision+1
 WHERE role='learner' AND household IS NULL AND status IN ('new','pending','contacted','shortlist','hold','interest');

ALTER TABLE iriva.application_orders ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON iriva.application_orders TO iriva_runtime;
CREATE POLICY server_access ON iriva.application_orders TO iriva_runtime USING (true) WITH CHECK (true);

ALTER TABLE iriva.application_payments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON iriva.application_payments TO iriva_runtime;
CREATE POLICY server_access ON iriva.application_payments TO iriva_runtime USING (true) WITH CHECK (true);

ALTER TABLE iriva.stripe_refunds ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON iriva.stripe_refunds TO iriva_runtime;
CREATE POLICY server_access ON iriva.stripe_refunds TO iriva_runtime USING (true) WITH CHECK (true);
