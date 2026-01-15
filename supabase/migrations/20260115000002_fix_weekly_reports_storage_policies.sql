-- =============================================================================
-- Fix Weekly Reports Storage Bucket Policies
-- =============================================================================
-- This migration fixes the storage policies for the weekly-reports bucket
-- to ensure supervisors can view images uploaded by students.

-- 1. Drop existing conflicting policies
DO $$
BEGIN
  -- Drop all existing policies for weekly-reports bucket
  DROP POLICY IF EXISTS "Students can upload their weekly report images" ON storage.objects;
  DROP POLICY IF EXISTS "Students can view their weekly report images" ON storage.objects;
  DROP POLICY IF EXISTS "Supervisors can view all weekly report images" ON storage.objects;
  DROP POLICY IF EXISTS "Students can delete their weekly report images" ON storage.objects;
  DROP POLICY IF EXISTS "Admins can view all weekly report images" ON storage.objects;
  
  -- Also drop any variant names
  DROP POLICY IF EXISTS "weekly_reports_insert" ON storage.objects;
  DROP POLICY IF EXISTS "weekly_reports_select" ON storage.objects;
  DROP POLICY IF EXISTS "weekly_reports_delete" ON storage.objects;
  DROP POLICY IF EXISTS "Anyone can view weekly report images" ON storage.objects;
  DROP POLICY IF EXISTS "Public can view weekly report images" ON storage.objects;
EXCEPTION
  WHEN OTHERS THEN
    NULL; -- Ignore if policies don't exist
END $$;

-- 2. Ensure bucket exists and is public
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'weekly-reports',
    'weekly-reports',
    true, -- Public bucket so images can be displayed
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  )
  ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    
  RAISE NOTICE 'Updated weekly-reports bucket to be public';
END $$;

-- 3. Create proper storage policies

-- Policy: Authenticated users (students) can upload to their own folder
-- File path format: {user_id}/{week_id}/{filename}
CREATE POLICY "Students can upload weekly report images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'weekly-reports'
  AND auth.uid()::text = (string_to_array(name, '/'))[1]
);

-- Policy: Anyone can view weekly report images (since bucket is public)
-- This allows supervisors and admins to view all uploaded images
CREATE POLICY "Anyone can view weekly report images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'weekly-reports');

-- Policy: Users can update their own images
CREATE POLICY "Students can update own weekly report images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'weekly-reports'
  AND auth.uid()::text = (string_to_array(name, '/'))[1]
)
WITH CHECK (
  bucket_id = 'weekly-reports'
  AND auth.uid()::text = (string_to_array(name, '/'))[1]
);

-- Policy: Users can delete their own images
CREATE POLICY "Students can delete own weekly report images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'weekly-reports'
  AND auth.uid()::text = (string_to_array(name, '/'))[1]
);

-- =============================================================================
-- Also fix student-photos bucket (used for daily activity photos)
-- =============================================================================
DO $$
BEGIN
  DROP POLICY IF EXISTS "Students can manage their own photos" ON storage.objects;
  DROP POLICY IF EXISTS "Supervisors can view all photos" ON storage.objects;
  DROP POLICY IF EXISTS "Students can upload their own photos" ON storage.objects;
  DROP POLICY IF EXISTS "Students can view their own photos" ON storage.objects;
  DROP POLICY IF EXISTS "Supervisors can view all student photos" ON storage.objects;
  DROP POLICY IF EXISTS "Students can delete their own photos" ON storage.objects;
  DROP POLICY IF EXISTS "Anyone can view student photos" ON storage.objects;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- Ensure student-photos bucket is public
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'student-photos',
    'student-photos',
    true, -- Public so supervisors can view
    3145728, -- 3MB limit
    ARRAY['image/jpeg', 'image/jpg', 'image/png']
  )
  ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 3145728,
    allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png'];
    
  RAISE NOTICE 'Updated student-photos bucket to be public';
END $$;

-- Student-photos policies
CREATE POLICY "Students can upload their photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'student-photos'
  AND auth.uid()::text = (string_to_array(name, '/'))[1]
);

CREATE POLICY "Anyone can view student photos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'student-photos');

CREATE POLICY "Students can delete their photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'student-photos'
  AND auth.uid()::text = (string_to_array(name, '/'))[1]
);

-- =============================================================================
-- Verification
-- =============================================================================
-- Run these to verify:
-- SELECT * FROM storage.buckets WHERE id IN ('weekly-reports', 'student-photos');
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%weekly%';
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%student%photo%';
