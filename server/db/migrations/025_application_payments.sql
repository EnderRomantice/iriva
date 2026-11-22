CREATE TABLE application_orders (
 id TEXT PRIMARY KEY, application_id TEXT NOT NULL REFERENCES member_applications(id),
 plan TEXT NOT NULL, language TEXT NOT NULL, amount_minor INTEGER NOT NULL CHECK(amount_minor>0),
 currency TEXT NOT NULL, created TEXT NOT NULL, UNIQUE(application_id,plan,language)
);
CREATE TABLE application_payments (
 stripe_session TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES application_orders(id),
 payment_intent TEXT NOT NULL UNIQUE, status TEXT NOT NULL CHECK(status IN ('paid','refunded')),
 amount_minor INTEGER NOT NULL, currency TEXT NOT NULL, refunded_minor INTEGER NOT NULL DEFAULT 0, updated TEXT NOT NULL
);
CREATE INDEX application_payments_order ON application_payments(order_id,status);
-- Refunds may arrive before checkout completion, or be retried out of order.
CREATE TABLE stripe_refunds (payment_intent TEXT PRIMARY KEY, amount_minor INTEGER NOT NULL, full_refund INTEGER NOT NULL DEFAULT 0, updated TEXT NOT NULL);
UPDATE member_applications SET status='awaiting_payment',revision=revision+1
 WHERE role='learner' AND household IS NULL AND status IN ('new','pending','contacted','shortlist','hold','interest');
