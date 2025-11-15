-- Fix search path for get_lagos_timestamp function
CREATE OR REPLACE FUNCTION get_lagos_timestamp()
RETURNS timestamp with time zone
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT TIMEZONE('Africa/Lagos', NOW());
$$;