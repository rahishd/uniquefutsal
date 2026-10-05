-- Customer profile extras (location and preferred position) live next to the preferences.
ALTER TABLE "UserPrefs" ADD COLUMN IF NOT EXISTS "location" TEXT,
ADD COLUMN IF NOT EXISTS "position" TEXT;
