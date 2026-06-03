-- Data trust recovery: stop silent USD defaults for UK/GBP companies.
-- Explicit user-selected currencies still override these defaults.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'currency'
  ) THEN
    ALTER TABLE public.companies ALTER COLUMN currency SET DEFAULT 'GBP';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'company_settings' AND column_name = 'currency'
  ) THEN
    ALTER TABLE public.company_settings ALTER COLUMN currency SET DEFAULT 'GBP';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bank_accounts' AND column_name = 'currency'
  ) THEN
    ALTER TABLE public.bank_accounts ALTER COLUMN currency SET DEFAULT 'GBP';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'currency'
  ) THEN
    ALTER TABLE public.transactions ALTER COLUMN currency SET DEFAULT 'GBP';
  END IF;
END $$;
