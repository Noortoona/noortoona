-- Additive only. No historical prices, orders, bookings or catalog rows are rewritten.
ALTER TABLE bookings ADD COLUMN pricing_snapshot jsonb;
ALTER TABLE bookings ADD COLUMN tax_amount integer CHECK(tax_amount IS NULL OR tax_amount>=0);
ALTER TABLE bookings ADD COLUMN entry_status text NOT NULL DEFAULT 'not_requested'
 CHECK(entry_status IN ('not_requested','pending_review','available','unavailable','assigned','completed'));
ALTER TABLE bookings ADD COLUMN organizer_ids jsonb NOT NULL DEFAULT '[]';
ALTER TABLE leads ADD COLUMN requests_json jsonb NOT NULL DEFAULT '[]';
-- Extend the existing lifecycle without rewriting existing rows.
ALTER TABLE bookings DROP CONSTRAINT bookings_booking_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_booking_status_check CHECK(booking_status IN ('pre_booking_received','contacted','awaiting_confirmation','confirmed','cancelled','completed'));
CREATE INDEX bookings_package_count_idx ON bookings(package_code,guest_count,created_at DESC);
