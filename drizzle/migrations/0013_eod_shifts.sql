-- Per-staff shift reconciliation: activated on login, closed by the cashier,
-- approved by a manager. Auto-closed into pending_approval at end of day.
CREATE TABLE IF NOT EXISTS eod_shift (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES store(id),
  staff_id uuid NOT NULL REFERENCES staff_profile(id),
  business_date date NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'in_progress',

  system_cash_total integer NOT NULL DEFAULT 0,
  system_momo_total integer NOT NULL DEFAULT 0,
  system_card_total integer NOT NULL DEFAULT 0,
  system_total integer NOT NULL DEFAULT 0,
  system_sale_count integer NOT NULL DEFAULT 0,
  system_refund_total integer NOT NULL DEFAULT 0,

  physical_cash_count integer NOT NULL DEFAULT 0,
  denominations jsonb DEFAULT '[]'::jsonb,
  momo_confirmed integer NOT NULL DEFAULT 0,

  cash_variance integer NOT NULL DEFAULT 0,
  momo_variance integer NOT NULL DEFAULT 0,
  variance_notes text,

  auto_closed boolean NOT NULL DEFAULT false,

  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_by_id uuid REFERENCES staff_profile(id),
  closed_at timestamptz,
  approved_by_id uuid REFERENCES staff_profile(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS eod_shift_store_staff_date_unique
  ON eod_shift (store_id, staff_id, business_date);
CREATE INDEX IF NOT EXISTS eod_shift_store_date_idx
  ON eod_shift (store_id, business_date);
CREATE INDEX IF NOT EXISTS eod_shift_staff_idx
  ON eod_shift (staff_id, business_date);
CREATE INDEX IF NOT EXISTS eod_shift_status_idx
  ON eod_shift (store_id, status);
