CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  owner_token TEXT NOT NULL,
  title TEXT NOT NULL,
  occasion TEXT NOT NULL,
  name1 TEXT,
  name2 TEXT,
  event_date DATE,
  event_time TIME,
  location TEXT,
  maps_url TEXT,
  message TEXT,
  template TEXT NOT NULL DEFAULT 'لؤلؤة',
  package_name TEXT NOT NULL DEFAULT 'الأساسية',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS guests (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  code TEXT NOT NULL UNIQUE,
  viewed_at TIMESTAMPTZ,
  rsvp_status TEXT NOT NULL DEFAULT 'pending' CHECK (rsvp_status IN ('pending','accepted','declined')),
  companion_count INTEGER NOT NULL DEFAULT 0,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS guests_event_id_idx ON guests(event_id);
CREATE INDEX IF NOT EXISTS guests_code_idx ON guests(code);
