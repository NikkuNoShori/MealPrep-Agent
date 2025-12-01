-- Fix measurement_system column if it was created incorrectly
-- This migration is idempotent and handles both cases: column exists or doesn't exist

DO $$
BEGIN
    -- Check if column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_preferences' 
        AND column_name = 'measurement_system'
    ) THEN
        -- Column exists - check if it needs fixing
        
        -- Drop existing constraint if it exists (might have wrong name or format)
        -- IF EXISTS will generate a NOTICE if constraint doesn't exist, which is harmless
        ALTER TABLE user_preferences 
        DROP CONSTRAINT IF EXISTS measurement_system_check;
        
        ALTER TABLE user_preferences 
        DROP CONSTRAINT IF EXISTS user_preferences_measurement_system_check;
        
        -- Ensure column has correct type and default
        ALTER TABLE user_preferences 
        ALTER COLUMN measurement_system TYPE VARCHAR(20),
        ALTER COLUMN measurement_system SET DEFAULT 'metric';
        
        -- Update any NULL values
        UPDATE user_preferences 
        SET measurement_system = 'metric' 
        WHERE measurement_system IS NULL;
        
        -- Add check constraint with proper name
        ALTER TABLE user_preferences 
        ADD CONSTRAINT measurement_system_check 
        CHECK (measurement_system IN ('metric', 'imperial'));
        
    ELSE
        -- Column doesn't exist - create it properly
        ALTER TABLE user_preferences 
        ADD COLUMN measurement_system VARCHAR(20) DEFAULT 'metric';
        
        -- Update existing rows to have the default value
        UPDATE user_preferences 
        SET measurement_system = 'metric' 
        WHERE measurement_system IS NULL;
        
        -- Add check constraint
        ALTER TABLE user_preferences 
        ADD CONSTRAINT measurement_system_check 
        CHECK (measurement_system IN ('metric', 'imperial'));
    END IF;
    
    -- Add/update comment
    COMMENT ON COLUMN user_preferences.measurement_system IS 'User preference for measurement system: metric (g, kg, ml, l, C) or imperial (oz, lb, fl oz, cup, F)';
END $$;

