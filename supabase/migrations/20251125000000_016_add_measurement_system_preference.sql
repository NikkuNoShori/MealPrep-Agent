-- Add measurement_system column to user_preferences table
ALTER TABLE user_preferences 
ADD COLUMN IF NOT EXISTS measurement_system VARCHAR(10) DEFAULT 'metric' CHECK (measurement_system IN ('metric', 'imperial'));

-- Add comment
COMMENT ON COLUMN user_preferences.measurement_system IS 'User preference for measurement system: metric (g, kg, ml, l, C) or imperial (oz, lb, fl oz, cup, F)';

