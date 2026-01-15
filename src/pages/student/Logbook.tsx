import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays, startOfWeek } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { ChevronLeft, ChevronRight, Save, Send, ArrowLeft, Clock, Download, AlertCircle, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PhotoUpload } from "@/components/PhotoUpload";
import { usePortalStatus } from "@/hooks/usePortalStatus";
import PortalClosed from "./PortalClosed";
import { apiRequest } from "@/utils/api";
import { getOrCreateStudent, isStudentProfileComplete, StudentRecord } from "@/utils/studentUtils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Week {
  id: string;
  week_number: number;
  start_date: string;
  end_date: string;
  monday_activity: string | null;
  tuesday_activity: string | null;
  wednesday_activity: string | null;
  thursday_activity: string | null;
  friday_activity: string | null;
  saturday_activity: string | null;
  comments: string | null;
  status: "draft" | "submitted" | "approved" | "rejected";
  image_urls: string[] | null;
  industry_supervisor_comments: string | null;
  industry_supervisor_approved_at: string | null;
  school_supervisor_approved_at: string | null;
}

interface Photo {
  id: string;
  image_url: string;
  description: string | null;
  day_of_week?: string;
}

interface WeekWithPhotos extends Week {
  photos?: Photo[];
}

const Logbook = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { portalOpen, loading: portalLoading } = usePortalStatus();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [studentRecord, setStudentRecord] = useState<StudentRecord | null>(null);
  const [studentError, setStudentError] = useState<string | null>(null);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [weekData, setWeekData] = useState<Week | null>(null);
  const [photos, setPhotos] = useState<Record<string, Photo[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [siwesLocked, setSiwesLocked] = useState(false);

  const initializeStudent = useCallback(async () => {
    if (!user?.id || !user?.email) {
      setStudentError("User session not found. Please log in again.");
      setLoading(false);
      return;
    }
    
    try {
      // Use getOrCreateStudent to ensure student record exists
      const { student, error, created } = await getOrCreateStudent(
        user.id,
        user.email,
        profile?.full_name
      );

      if (error) {
        console.error("Failed to get/create student:", error);
        setStudentError(error);
        setLoading(false);
        return;
      }

      if (!student) {
        setStudentError("Could not initialize student profile. Please contact support.");
        setLoading(false);
        return;
      }

      // Log if a new record was created
      if (created) {
        console.log("New student record created for user:", user.id);
        toast.info("Student profile initialized. Please complete your Pre-SIWES registration.");
      }

      setStudentId(student.id);
      setStudentRecord(student);
      setStudentError(null);

      // Check if SIWES is locked (graded)
      setSiwesLocked(student.siwes_locked === true);

      // Fetch pre-registration status separately
      const { data: preRegData } = await supabase
        .from("pre_registration")
        .select("status")
        .eq("student_id", student.id)
        .maybeSingle();

      setIsApproved(preRegData?.status === 'approved');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Error initializing student:", error);
      setStudentError(`Error loading student data: ${errorMessage}`);
      toast.error("Error loading student data");
      setLoading(false);
    }
  }, [user?.id, user?.email, profile?.full_name]);

  const fetchWeekData = useCallback(async () => {
    setLoading(true);
    try {
      // Optimized: Fetch week and photos in one go
      const { data, error } = await supabase
        .from("weeks")
        .select(`
          *,
          photos (*)
        `)
        .eq("student_id", studentId)
        .eq("week_number", currentWeek)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error("Error fetching week data:", {
          message: error.message,
          code: error.code,
          details: error.details,
        });
        throw error;
      }

      if (data) {
        setWeekData(data as unknown as Week);
        
        // Process photos from the joined data
        const photosByDay: Record<string, Photo[]> = {};
        // Check if photos is an array (it should be from the join)
        const photosList = (Array.isArray((data as unknown as WeekWithPhotos).photos) ? (data as unknown as WeekWithPhotos).photos : []) as Photo[];
        
        photosList.forEach((photo) => {
          if (!photosByDay[photo.day_of_week]) {
            photosByDay[photo.day_of_week] = [];
          }
          photosByDay[photo.day_of_week].push(photo);
        });
        setPhotos(photosByDay);
      } else {
        // Create new week - calculate dates based on student's SIWES start date
        let weekStart: Date;
        let weekEnd: Date;
        
        if (studentRecord?.start_date) {
          // Calculate week dates based on student's SIWES start date
          const siwesStartDate = new Date(studentRecord.start_date);
          weekStart = addDays(siwesStartDate, (currentWeek - 1) * 7);
          weekEnd = addDays(weekStart, 5); // Monday to Saturday
        } else {
          // Fallback to current date if no start_date set
          const lagosTime = toZonedTime(new Date(), 'Africa/Lagos');
          weekStart = startOfWeek(lagosTime, { weekStartsOn: 1 });
          weekEnd = addDays(weekStart, 5);
        }

        // Note: Only include fields that exist in the base weeks table
        const newWeekData = {
          student_id: studentId,
          week_number: currentWeek,
          start_date: format(weekStart, "yyyy-MM-dd"),
          end_date: format(weekEnd, "yyyy-MM-dd"),
          monday_activity: null,
          tuesday_activity: null,
          wednesday_activity: null,
          thursday_activity: null,
          friday_activity: null,
          saturday_activity: null,
          comments: null,
          status: "draft" as const,
        };

        console.log("Creating new week record:", { studentId, weekNumber: currentWeek });

        // Create the week record immediately so photos can be uploaded
        const { data: createdWeek, error: createError } = await supabase
          .from("weeks")
          .insert(newWeekData)
          .select()
          .single();

        if (createError) {
          console.error("Error creating week:", {
            message: createError.message,
            code: createError.code,
            details: createError.details,
            hint: createError.hint,
          });
          toast.error(`Failed to create week: ${createError.message}`);
          // Still set weekData so user can work, but without ID
          setWeekData({
            id: "",
            week_number: currentWeek,
            start_date: format(weekStart, "yyyy-MM-dd"),
            end_date: format(weekEnd, "yyyy-MM-dd"),
            monday_activity: null,
            tuesday_activity: null,
            wednesday_activity: null,
            thursday_activity: null,
            friday_activity: null,
            saturday_activity: null,
            comments: null,
            status: "draft",
            image_urls: null,
            industry_supervisor_comments: null,
            industry_supervisor_approved_at: null,
            school_supervisor_approved_at: null,
          });
          setPhotos({});
        } else {
          console.log("Week created successfully:", createdWeek?.id);
          setWeekData(createdWeek as unknown as Week);
          // No photos for a new week
          setPhotos({});
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Error loading week data:", error);
      toast.error(`Error loading week data: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [studentId, currentWeek, studentRecord]);

  useEffect(() => {
    initializeStudent();
  }, [initializeStudent]);

  useEffect(() => {
    if (studentId) {
      fetchWeekData();
    }
  }, [studentId, currentWeek, fetchWeekData]);

  const handleDownloadPDF = async () => {
    if (!studentId) return;
    
    setDownloading(true);
    toast.info("Generating your logbook PDF. This may take a moment...");
    
    try {
      const session = await supabase.auth.getSession();
      if (!session.data.session?.access_token) {
        toast.error("Session expired. Please log in again.");
        return;
      }

      const response = await apiRequest("/api/pdf/generate-student-pdf", {
        method: "POST",
        body: JSON.stringify({ studentId }),
        headers: {
          Authorization: `Bearer ${session.data.session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to generate PDF");
      }

      // Create blob from response
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `SIWES_Logbook_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success("Logbook downloaded successfully!");
    } catch (error: unknown) {
      console.error("PDF Download Error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to download logbook: ${errorMessage}`);
    } finally {
      setDownloading(false);
    }
  };

  const handleSave = async (submit: boolean = false) => {
    // Check if SIWES is locked
    if (siwesLocked) {
      toast.error("Your SIWES has been completed and graded. No further edits are allowed.");
      return;
    }

    // Defensive check: Ensure studentId exists
    if (!studentId) {
      console.error("handleSave called without studentId");
      toast.error("Student profile not initialized. Please refresh the page.");
      return;
    }

    if (!weekData) {
      console.error("handleSave called without weekData");
      toast.error("Week data not loaded. Please refresh the page.");
      return;
    }

    setSaving(true);
    try {
      const lagosTime = toZonedTime(new Date(), 'Africa/Lagos');
      
      // Build data object - only include fields that exist in the database
      const dataToSave = {
        student_id: studentId,
        week_number: currentWeek,
        start_date: weekData.start_date,
        end_date: weekData.end_date,
        monday_activity: weekData.monday_activity,
        tuesday_activity: weekData.tuesday_activity,
        wednesday_activity: weekData.wednesday_activity,
        thursday_activity: weekData.thursday_activity,
        friday_activity: weekData.friday_activity,
        saturday_activity: weekData.saturday_activity,
        comments: weekData.comments,
        status: submit ? ("submitted" as const) : ("draft" as const),
        submitted_at: submit ? lagosTime.toISOString() : null,
        forwarded_to_school: submit ? true : false, // Directly forward to school supervisor
      };

      console.log("Saving week data:", { weekId: weekData.id, studentId, submit });

      if (weekData.id) {
        // Update existing week
        const { error } = await supabase
          .from("weeks")
          .update(dataToSave)
          .eq("id", weekData.id);

        if (error) {
          console.error("Supabase UPDATE error:", { 
            message: error.message, 
            code: error.code, 
            details: error.details,
            hint: error.hint 
          });
          throw error;
        }
      } else {
        // Insert new week
        const { data, error } = await supabase
          .from("weeks")
          .insert(dataToSave)
          .select()
          .single();

        if (error) {
          console.error("Supabase INSERT error:", { 
            message: error.message, 
            code: error.code, 
            details: error.details,
            hint: error.hint 
          });
          throw error;
        }
        
        console.log("Week created successfully:", data?.id);
        setWeekData({ ...weekData, id: (data as unknown as Week).id });
      }

      toast.success(submit ? "Week submitted to your school supervisor" : "Week saved as draft");
      
      // Log activity for submissions (not drafts)
      if (submit && user) {
        try {
          const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
          await fetch(`${API_BASE_URL}/api/auth/log-activity`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: user.id,
              userType: "student",
              userEmail: user.email,
              activityType: "week_submit",
              activityDetails: {
                weekId: weekData.id,
                weekNumber: currentWeek,
                studentId: studentId,
              },
              success: true,
            }),
          }).catch(() => {}); // Don't block on logging failure
        } catch {
          // Ignore logging errors
        }
      }
      
      fetchWeekData();
    } catch (error: unknown) {
      // Enhanced error logging
      const supabaseError = error as { message?: string; code?: string; details?: string; hint?: string };
      console.error("Failed to save week:", {
        error,
        message: supabaseError?.message,
        code: supabaseError?.code,
        details: supabaseError?.details,
        hint: supabaseError?.hint,
        studentId,
        weekId: weekData?.id,
      });
      
      // User-friendly error message
      const errorMessage = supabaseError?.message || "Failed to save week";
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const updateActivity = (day: string, value: string) => {
    if (!weekData) return;
    setWeekData({ ...weekData, [`${day}_activity`]: value });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "secondary",
      submitted: "default",
      approved: "default",
      rejected: "destructive",
    };

    return (
      <Badge variant={variants[status] || "outline"} className="capitalize">
        {status}
      </Badge>
    );
  };

  if (portalLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  // Check portal status - redirect if closed
  if (portalOpen === false) {
    return <PortalClosed />;
  }

  // Show error if student profile could not be initialized
  if (studentError || !studentId) {
    return (
      <div className="min-h-screen bg-gradient-light">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Student Profile Error</AlertTitle>
              <AlertDescription>
                {studentError || "Could not load student profile. Please try logging out and back in."}
              </AlertDescription>
            </Alert>
            <div className="mt-4 flex gap-4">
              <Button onClick={() => window.location.reload()}>
                Refresh Page
              </Button>
              <Button variant="outline" onClick={() => navigate("/student/dashboard")}>
                Back to Dashboard
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Show message if profile is incomplete
  if (studentRecord && !isStudentProfileComplete(studentRecord)) {
    return (
      <div className="min-h-screen bg-gradient-light">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <Card className="shadow-elevated border-2 border-yellow-200 bg-yellow-50">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-yellow-800">
                  <AlertCircle className="h-6 w-6" />
                  <span>Complete Your Profile</span>
                </CardTitle>
                <CardDescription>
                  Please complete your Pre-SIWES registration before submitting weekly reports.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Your student profile needs to be completed with your matric number, department, and other required details.
                </p>
                <div className="flex gap-4">
                  <Button onClick={() => navigate("/student/pre-siwes")}>
                    Complete Pre-SIWES Form
                  </Button>
                  <Button variant="outline" onClick={() => navigate("/student/dashboard")}>
                    Back to Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  if (!isApproved) {
    return (
      <div className="min-h-screen bg-gradient-light">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <Card className="shadow-elevated border-2 border-yellow-200 bg-yellow-50">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-yellow-800">
                  <Clock className="h-6 w-6" />
                  <span>Pre-Registration Not Approved</span>
                </CardTitle>
                <CardDescription>
                  Your pre-registration form must be approved by your school supervisor before you can start weekly submissions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Please wait for your school supervisor to review and approve your pre-registration form. 
                  Once approved, you'll be able to access your weekly logbook.
                </p>
                <Button onClick={() => navigate("/student/dashboard")}>
                  Back to Dashboard
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  // canEdit: Draft or new week, AND not locked
  const canEdit = (weekData?.status === "draft" || !weekData?.id) && !siwesLocked;

  return (
    <div className="min-h-screen bg-gradient-light">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Locked Banner */}
          {siwesLocked && (
            <Alert className="border-purple-200 bg-purple-50">
              <Lock className="h-4 w-4 text-purple-600" />
              <AlertTitle className="text-purple-800">SIWES Completed - Read-Only Mode</AlertTitle>
              <AlertDescription className="text-purple-700">
                Your SIWES has been completed and graded. You can view your logbook entries but cannot make any changes.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between mb-6">
            <Button
              variant="ghost"
              onClick={() => navigate("/student/dashboard")}
              className="hover:bg-white/50"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>

            <Button 
              variant="outline" 
              onClick={handleDownloadPDF} 
              disabled={downloading}
              className="bg-white hover:bg-gray-50"
            >
              <Download className="h-4 w-4 mr-2" />
              {downloading ? "Generating PDF..." : "Download Logbook"}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-primary">Weekly Logbook</h1>
              <p className="text-muted-foreground">Week {currentWeek}</p>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentWeek(Math.max(1, currentWeek - 1))}
                disabled={currentWeek === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-semibold px-4">Week {currentWeek} of 24</span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentWeek(Math.min(24, currentWeek + 1))}
                disabled={currentWeek >= 24}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {weekData && (
            <Card className="shadow-elevated">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>
                      {format(new Date(weekData.start_date), "MMM dd")} -{" "}
                      {format(new Date(weekData.end_date), "MMM dd, yyyy")}
                    </CardTitle>
                    <CardDescription>Record your daily activities</CardDescription>
                  </div>
                  {getStatusBadge(weekData.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].map((day) => (
                  <div key={day} className="space-y-3 p-4 border border-border rounded-lg">
                    <div className="flex items-center justify-between">
                      <label className="font-medium capitalize text-lg">{day}</label>
                      <span className="text-sm text-muted-foreground">
                        {format(addDays(new Date(weekData.start_date), ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].indexOf(day)), "MMM dd")}
                      </span>
                    </div>
                    <Textarea
                      value={weekData[`${day}_activity` as keyof Week] as string || ""}
                      onChange={(e) => updateActivity(day, e.target.value)}
                      placeholder={`Describe your ${day} activities...`}
                      rows={3}
                      disabled={!canEdit}
                    />
                    {weekData.id && (
                      <PhotoUpload
                        weekId={weekData.id}
                        day={day}
                        photos={photos[day] || []}
                        onPhotosChange={() => fetchWeekData()}
                        disabled={!canEdit}
                      />
                    )}
                  </div>
                ))}

                <div className="space-y-2">
                  <label className="font-medium">Comments/Notes</label>
                  <Textarea
                    value={weekData.comments || ""}
                    onChange={(e) => setWeekData({ ...weekData, comments: e.target.value })}
                    placeholder="Additional comments or observations..."
                    rows={4}
                    disabled={!canEdit}
                  />
                </div>

                {canEdit && (
                  <div className="flex space-x-4 pt-4">
                    <Button onClick={() => handleSave(false)} disabled={saving} variant="outline">
                      <Save className="h-4 w-4 mr-2" />
                      Save Draft
                    </Button>
                    <Button onClick={() => handleSave(true)} disabled={saving}>
                      <Send className="h-4 w-4 mr-2" />
                      Submit for Approval
                    </Button>
                  </div>
                )}

                {weekData.status === "rejected" && (
                  <div className="p-4 bg-destructive/10 border border-destructive rounded-lg">
                    <p className="text-sm font-medium text-destructive">
                      This week has been rejected. Please review supervisor feedback and resubmit.
                    </p>
                  </div>
                )}

                {weekData.status === "approved" && (
                  <div className="p-4 bg-primary/10 border border-primary rounded-lg">
                    <p className="text-sm font-medium text-primary">
                      ✓ This week has been approved by your supervisor
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default Logbook;
