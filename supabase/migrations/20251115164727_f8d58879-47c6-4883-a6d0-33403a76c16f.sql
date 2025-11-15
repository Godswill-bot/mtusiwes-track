-- Add function to get Africa/Lagos timezone timestamp
CREATE OR REPLACE FUNCTION get_lagos_timestamp()
RETURNS timestamp with time zone
LANGUAGE sql
STABLE
AS $$
  SELECT TIMEZONE('Africa/Lagos', NOW());
$$;

-- Update weeks table to use Lagos timezone for timestamps
ALTER TABLE weeks 
  ALTER COLUMN created_at SET DEFAULT TIMEZONE('Africa/Lagos', NOW()),
  ALTER COLUMN updated_at SET DEFAULT TIMEZONE('Africa/Lagos', NOW());

-- Update stamps table signed_at default
ALTER TABLE stamps
  ALTER COLUMN signed_at SET DEFAULT TIMEZONE('Africa/Lagos', NOW()),
  ALTER COLUMN created_at SET DEFAULT TIMEZONE('Africa/Lagos', NOW());

-- Update photos uploaded_at default  
ALTER TABLE photos
  ALTER COLUMN uploaded_at SET DEFAULT TIMEZONE('Africa/Lagos', NOW());

-- Update attendance created_at default
ALTER TABLE attendance
  ALTER COLUMN created_at SET DEFAULT TIMEZONE('Africa/Lagos', NOW());