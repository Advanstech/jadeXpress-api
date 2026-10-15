-- Web Push subscriptions: one row per browser/device per staff member.
CREATE TABLE IF NOT EXISTS push_subscription (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES store(id),
  staff_id uuid NOT NULL REFERENCES staff_profile(id),
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent varchar(255),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS push_subscription_endpoint_unique
  ON push_subscription (endpoint);
CREATE INDEX IF NOT EXISTS push_subscription_store_idx
  ON push_subscription (store_id);
CREATE INDEX IF NOT EXISTS push_subscription_staff_idx
  ON push_subscription (staff_id);
