CREATE TABLE IF NOT EXISTS profiles (
  user_email TEXT PRIMARY KEY,
  profile TEXT NOT NULL UNIQUE CHECK (profile IN ('emrys','hannah')),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS preferences (
  user_email TEXT NOT NULL,
  item_key TEXT NOT NULL,
  value TEXT NOT NULL CHECK (value IN ('want','maybe','skip')),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_email, item_key),
  FOREIGN KEY (user_email) REFERENCES profiles(user_email) ON DELETE CASCADE
);
