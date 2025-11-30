-- Add measurement_system column to user_preferences table
DO $$
BEGIN
    -- Add column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_preferences' 
        AND column_name = 'measurement_system'
    ) THEN
        ALTER TABLE user_preferences 
        ADD COLUMN measurement_system VARCHAR(20) DEFAULT 'metric';
        
        -- Update existing rows to have the default value
        UPDATE user_preferences 
        SET measurement_system = 'metric' 
        WHERE measurement_system IS NULL;
        
        -- Add check constraint separately
        ALTER TABLE user_preferences 
        ADD CONSTRAINT measurement_system_check 
        CHECK (measurement_system IN ('metric', 'imperial'));
        
        -- Add comment
        COMMENT ON COLUMN user_preferences.measurement_system IS 'User preference for measurement system: metric (g, kg, ml, l, C) or imperial (oz, lb, fl oz, cup, F)';
    END IF;
END $$;

