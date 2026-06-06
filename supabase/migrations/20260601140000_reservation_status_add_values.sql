-- Payment lifecycle statuses for reservations.
--   pending  -> created, awaiting payment at the Redsys gateway
--   rejected -> payment failed / refused (kept for the record, frees the slot)
-- NOTE: ALTER TYPE ... ADD VALUE must be committed before the new values can be
-- used in expressions (policies/indexes), so this lives in its own migration.
ALTER TYPE reservation_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE reservation_status ADD VALUE IF NOT EXISTS 'rejected';
