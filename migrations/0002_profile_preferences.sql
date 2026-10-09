CREATE TABLE IF NOT EXISTS profile_preferences (
  profile TEXT NOT NULL CHECK (profile IN ('emrys','hannah')),
  item_key TEXT NOT NULL,
  value TEXT NOT NULL CHECK (value IN ('want','maybe','skip')),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (profile, item_key)
);

INSERT INTO profile_preferences (profile, item_key, value, updated_at)
SELECT profiles.profile, preferences.item_key, preferences.value, preferences.updated_at
FROM preferences
JOIN profiles ON profiles.user_email = preferences.user_email
WHERE profiles.profile IN ('emrys','hannah')
ON CONFLICT(profile, item_key) DO NOTHING;
