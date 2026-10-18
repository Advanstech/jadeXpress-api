-- Payment authorizations: manager/owner approval workflow for disbursements.
-- One row per payment request, with OCR receipt data and ledger linkage.
CREATE TABLE IF NOT EXISTS payment_authorization (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  authorization_number varchar(60) NOT NULL UNIQUE,
  store_id uuid NOT NULL REFERENCES store(id),
  title varchar(255) NOT NULL,
  category varchar(50) NOT NULL DEFAULT 'operational_expense',
  reference_type varchar(50),
  reference_id uuid,
  payee_name varchar(255) NOT NULL,
  amount_pesewas integer NOT NULL,
  currency_code varchar(10) NOT NULL DEFAULT 'GHS',
  payment_method varchar(50) NOT NULL DEFAULT 'momo',
  momo_phone_number varchar(30),
  momo_network varchar(50),
  bank_name varchar(100),
  bank_account_number varchar(100),
  status varchar(50) NOT NULL DEFAULT 'pending',
  requested_by_id uuid REFERENCES staff_profile(id),
  authorized_by_id uuid REFERENCES staff_profile(id),
  authorized_at timestamptz,
  rejection_reason text,
  notes text,
  receipt_url text,
  receipt_ocr_extracted boolean NOT NULL DEFAULT false,
  receipt_ocr_confidence double precision,
  receipt_ocr_data jsonb,
  receipt_uploaded_at timestamptz,
  disbursed_at timestamptz,
  disbursed_by_id uuid REFERENCES staff_profile(id),
  transaction_reference varchar(100),
  ledger_entry_id uuid REFERENCES ledger_entry(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_auth_store_idx
  ON payment_authorization (store_id);
CREATE INDEX IF NOT EXISTS payment_auth_status_idx
  ON payment_authorization (status);
CREATE INDEX IF NOT EXISTS payment_auth_created_idx
  ON payment_authorization (created_at);
CREATE INDEX IF NOT EXISTS payment_auth_number_idx
  ON payment_authorization (authorization_number);
CREATE INDEX IF NOT EXISTS payment_auth_category_idx
  ON payment_authorization (category);
