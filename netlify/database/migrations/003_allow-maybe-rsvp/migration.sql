ALTER TABLE guests DROP CONSTRAINT IF EXISTS guests_rsvp_status_check;
ALTER TABLE guests
  ADD CONSTRAINT guests_rsvp_status_check
  CHECK (rsvp_status IN ('pending','accepted','declined','maybe'));
