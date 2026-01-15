-- =============================================================================
-- Create Profile Pictures Storage Bucket and Policies
-- =============================================================================
-- This migration creates the profile_pictures bucket and sets up proper
-- RLS policies for students to upload their profile pictures.

-- 1. Create the profile_pictures bucket
DO $$
BEGIN
  -- Create bucket if it doesn't exist
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'profile_pictures',
    'profile_pictures',
    true, -- Public so profile images can be displayed
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  )
  ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    
  RAISE NOTICE 'Created/updated profile_pictures bucket';
END $$;

-- 2. Create storage policies for profile_pictures bucket
-- First, drop any existing policies to avoid conflicts
DO $$
BEGIN
  DROP POLICY IF EXISTS "Students can upload profile pictures" ON storage.objects;
  DROP POLICY IF EXISTS "Profile pictures are publicly accessible" ON storage.objects;
  DROP POLICY IF EXISTS "Students can update own profile pictures" ON storage.objects;
  DROP POLICY IF EXISTS "Students can delete own profile pictures" ON storage.objects;
  
  -- Also drop any variant names that might exist
  DROP POLICY IF EXISTS "Users can upload profile pictures" ON storage.objects;
  DROP POLICY IF EXISTS "Anyone can view profile pictures" ON storage.objects;
  DROP POLICY IF EXISTS "Users can update own profile pictures" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete own profile pictures" ON storage.objects;
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore if policies don't exist
    NULL;
END $$;

-- 3. Create new storage policies

-- Policy: Authenticated users can upload their own profile pictures
-- The file path must start with the user's ID (e.g., "user-uuid/filename.jpg")
CREATE POLICY "Users can upload profile pictures" 
ON storage.objects 
FOR INSERT 
TO authenticated
WITH CHECK (
  bucket_id = 'profile_pictures' 
  AND auth.uid()::text = (string_to_array(name, '/'))[1]
);

-- Policy: Anyone can view profile pictures (they're public for display)
CREATE POLICY "Anyone can view profile pictures" 
ON storage.objects 
FOR SELECT 
TO public
USING (bucket_id = 'profile_pictures');

-- Policy: Users can update their own profile pictures
CREATE POLICY "Users can update own profile pictures" 
ON storage.objects 
FOR UPDATE 
TO authenticated
USING (
  bucket_id = 'profile_pictures' 
  AND auth.uid()::text = (string_to_array(name, '/'))[1]
)
WITH CHECK (
  bucket_id = 'profile_pictures' 
  AND auth.uid()::text = (string_to_array(name, '/'))[1]
);

-- Policy: Users can delete their own profile pictures
CREATE POLICY "Users can delete own profile pictures" 
ON storage.objects 
FOR DELETE 
TO authenticated
USING (
  bucket_id = 'profile_pictures' 
  AND auth.uid()::text = (string_to_array(name, '/'))[1]
);

-- =============================================================================
-- Verification queries (for testing)
-- =============================================================================
-- Run these to verify the bucket and policies were created:
-- SELECT * FROM storage.buckets WHERE id = 'profile_pictures';
-- SELECT policyname FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%profile%';
