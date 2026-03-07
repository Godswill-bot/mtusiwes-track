DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('student', 'industry_supervisor', 'school_supervisor', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.location_size AS ENUM ('small', 'medium', 'large');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.submission_status AS ENUM ('draft', 'submitted', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.stamp_method AS ENUM ('upload', 'signature_pad', 'qr', 'otp');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  full_name TEXT NOT NULL,
  role app_role NOT NULL,
--   ON public.profiles FOR UPDATE
--   USING (auth.uid() = id);

-- Create user_roles table for role management
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
RETURNS BOOLEAN
LANGUAGE SQL
    WHERE user_id = _user_id AND role = _role
$$;

-- Policies for user_roles
-- CREATE POLICY "Users can view their own roles"
--   ON public.user_roles FOR SELECT
--   USING (auth.uid() = user_id);

-- Create students table
CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  matric_no TEXT NOT NULL UNIQUE,
  department TEXT NOT NULL,
  faculty TEXT NOT NULL,
  organisation_name TEXT NOT NULL,
  organisation_address TEXT NOT NULL,
  nature_of_business TEXT NOT NULL,
  location_size location_size NOT NULL,
  products_services TEXT NOT NULL,
  industry_supervisor_name TEXT NOT NULL,
  industry_supervisor_phone TEXT,
  period_of_training TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on students
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Policies for students

-- CREATE POLICY "Students can insert their own data"
--   ON public.students FOR INSERT
--   WITH CHECK (auth.uid() = user_id);


--   ON public.students FOR SELECT
--   USING (
    public.has_role(auth.uid(), 'industry_supervisor') OR
    public.has_role(auth.uid(), 'school_supervisor') OR
    public.has_role(auth.uid(), 'admin')
  );

-- Create supervisors table
CREATE TABLE IF NOT EXISTS public.supervisors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  supervisor_type app_role NOT NULL CHECK (supervisor_type IN ('industry_supervisor', 'school_supervisor')),
);

-- CREATE POLICY "Supervisors can view their own data"
--   ON public.supervisors FOR SELECT
--   USING (auth.uid() = user_id);

-- CREATE POLICY "Admins can view all supervisors"
--   ON public.supervisors FOR SELECT
--   USING (public.has_role(auth.uid(), 'admin'));

  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  monday_activity TEXT,
  tuesday_activity TEXT,
  wednesday_activity TEXT,
  thursday_activity TEXT,
  friday_activity TEXT,
  saturday_activity TEXT,
  comments TEXT,
  status submission_status NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
);

-- CREATE POLICY "Students can manage their own weeks"
--   ON public.weeks FOR ALL
--   USING (
    EXISTS (
      SELECT 1 FROM public.students
      WHERE students.id = weeks.student_id
      AND students.user_id = auth.uid()
-- CREATE POLICY "Supervisors can view all weeks"
--   ON public.weeks FOR SELECT
--   USING (
    public.has_role(auth.uid(), 'industry_supervisor') OR
    public.has_role(auth.uid(), 'school_supervisor') OR
  );

-- CREATE POLICY "Industry supervisors can update weeks"
--   ON public.weeks FOR UPDATE
--   USING (public.has_role(auth.uid(), 'industry_supervisor'));

-- Create stamps table
CREATE TABLE IF NOT EXISTS public.stamps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id UUID REFERENCES public.weeks(id) ON DELETE CASCADE NOT NULL,
  supervisor_id UUID REFERENCES public.supervisors(id) ON DELETE SET NULL,
  method stamp_method NOT NULL,
  image_path TEXT,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latitude NUMERIC,
  longitude NUMERIC,
  ip_address TEXT,
  proof_hash TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on stamps
ALTER TABLE public.stamps ENABLE ROW LEVEL SECURITY;

-- Policies for stamps
-- CREATE POLICY "Anyone can view stamps for their weeks"
--   ON public.stamps FOR SELECT
--   USING (
    EXISTS (
      SELECT 1 FROM public.weeks w
      JOIN public.students s ON w.student_id = s.id
      WHERE w.id = stamps.week_id
      AND (s.user_id = auth.uid() OR public.has_role(auth.uid(), 'industry_supervisor') OR public.has_role(auth.uid(), 'school_supervisor') OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- CREATE POLICY "Supervisors can create stamps"
--   ON public.stamps FOR INSERT
--   WITH CHECK (public.has_role(auth.uid(), 'industry_supervisor'));

-- Create attendance table
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  check_in_time TIME,
  check_out_time TIME,
  latitude NUMERIC,
  longitude NUMERIC,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, date)
);

-- Enable RLS on attendance
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Policies for attendance
-- CREATE POLICY "Students can manage their own attendance"
--   ON public.attendance FOR ALL
--   USING (
    EXISTS (
      SELECT 1 FROM public.students
      WHERE students.id = attendance.student_id
      AND students.user_id = auth.uid()
    )
  );

-- CREATE POLICY "Supervisors can view all attendance"
--   ON public.attendance FOR SELECT
--   USING (
    public.has_role(auth.uid(), 'industry_supervisor') OR
    public.has_role(auth.uid(), 'school_supervisor') OR
    public.has_role(auth.uid(), 'admin')
  );

-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'student')
  );
  
  -- Also insert into user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'student')
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_weeks_updated_at
  BEFORE UPDATE ON public.weeks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- The following policies are commented out to prevent migration errors if they already exist:
-- CREATE POLICY "Users can view their own profile"
--   ON public.profiles FOR SELECT
--   USING (auth.uid() = id);
-- CREATE POLICY "Users can update their own profile"
--   ON public.profiles FOR UPDATE
--   USING (auth.uid() = id);