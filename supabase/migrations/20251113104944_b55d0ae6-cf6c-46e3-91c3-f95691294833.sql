-- Add school supervisor fields to students table
ALTER TABLE students
ADD COLUMN school_supervisor_name TEXT,
ADD COLUMN school_supervisor_email TEXT;

-- Create photos table for daily activity photos
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id UUID NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  day_of_week TEXT NOT NULL CHECK (day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday')),
  image_url TEXT NOT NULL,
  description TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('Africa/Lagos', now()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add rejection reason and forwarding status to weeks
ALTER TABLE weeks
ADD COLUMN rejection_reason TEXT,
ADD COLUMN forwarded_to_school BOOLEAN DEFAULT false,
ADD COLUMN school_supervisor_comments TEXT,
ADD COLUMN school_approved_at TIMESTAMP WITH TIME ZONE;

-- Update stamps table for approval tracking
ALTER TABLE stamps
ADD COLUMN forwarded_at TIMESTAMP WITH TIME ZONE;

-- Create storage bucket for photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('student-photos', 'student-photos', true);

-- Enable RLS on photos table
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for photos
CREATE POLICY "Students can manage their own photos"
ON photos
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM weeks w
    JOIN students s ON w.student_id = s.id
    WHERE w.id = photos.week_id AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Supervisors can view all photos"
ON photos
FOR SELECT
USING (
  has_role(auth.uid(), 'industry_supervisor') OR 
  has_role(auth.uid(), 'school_supervisor') OR 
  has_role(auth.uid(), 'admin')
);

-- Storage policies for student photos
CREATE POLICY "Students can upload their own photos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'student-photos' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Students can view their own photos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'student-photos' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Supervisors can view all student photos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'student-photos' AND
  (has_role(auth.uid(), 'industry_supervisor') OR 
   has_role(auth.uid(), 'school_supervisor') OR 
   has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Students can delete their own photos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'student-photos' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);