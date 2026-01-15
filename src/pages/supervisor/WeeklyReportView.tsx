import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ArrowLeft, Check, X, FileSignature, Printer, Download, Stamp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SignaturePad } from "@/components/SignaturePad";
import { toZonedTime } from "date-fns-tz";

// Interface for stamp/signature data
interface StampData {
  id: string;
  week_id: string;
  method: string;
  image_path: string | null;
  signed_at: string;
  supervisor_id: string | null;
}

interface WeekData {
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
  status: string;
  submitted_at: string | null;
  forwarded_to_school: boolean;
  school_approved_at: string | null;
  image_urls: string[] | null;
  industry_supervisor_comments: string | null;
  industry_supervisor_approved_at: string | null;
  school_supervisor_approved_at: string | null;
  score?: number | null;
  student: {
    id?: string;
    matric_no: string;
    department: string;
    faculty: string;
    period_of_training: string;
    organisation_name: string;
    user_id: string;
    profile_image_url?: string | null;
  };
  profile: {
    full_name: string;
  };
}

interface WeekDataFromDB {
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
  status: string;
  submitted_at: string | null;
  forwarded_to_school: boolean;
  school_approved_at: string | null;
  image_urls: string[] | null;
  industry_supervisor_comments: string | null;
  industry_supervisor_approved_at: string | null;
  school_supervisor_approved_at: string | null;
  score?: number | null;
  student_id: string;
  student: {
    id?: string;
    matric_no: string;
    department: string;
    faculty: string;
    period_of_training: string;
    organisation_name: string;
    user_id: string;
    profile_image_url?: string | null;
  };
  school_supervisor_comments?: string | null;
}

const WeeklyReportView = () => {
  const { weekId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, userRole } = useAuth();
  const [weekData, setWeekData] = useState<WeekData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejectionReason, setRejectionReason] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [schoolComments, setSchoolComments] = useState("");
  const [industryComments, setIndustryComments] = useState("");
  const [score, setScore] = useState<number | "">("");
  const [stamps, setStamps] = useState<StampData[]>([]);

  const fetchWeekData = useCallback(async () => {
    if (!weekId) return;

    setLoading(true);
    try {
      // Fetch week data
      const { data, error } = await supabase
        .from("weeks")
        .select(`
          *,
          student:students(
            id,
            matric_no,
            department,
            faculty,
            period_of_training,
            organisation_name,
            user_id,
            profile_image_url
          )
        `)
        .eq("id", weekId)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        setLoading(false);
        return;
      }

      // Get student profile using the user_id from student record
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", data.student.user_id)
        .maybeSingle();

      // If profile not found, try getting from students table directly
      let studentName = profileData?.full_name;
      if (!studentName && data.student) {
        // Try to get from students table
        const { data: studentData } = await supabase
          .from("students")
          .select("full_name")
          .eq("id", (data.student as unknown as { id: string }).id || (data as unknown as WeekDataFromDB).student_id)
          .maybeSingle();
        studentName = studentData?.full_name || 'Unknown';
      }

      // Fetch stamps/signatures for this week
      const { data: stampData } = await supabase
        .from("stamps")
        .select("id, week_id, method, image_path, signed_at, supervisor_id")
        .eq("week_id", weekId)
        .order("signed_at", { ascending: false });
      
      setStamps(stampData || []);

      setWeekData({ 
        ...(data as unknown as WeekDataFromDB), 
        profile: { full_name: studentName || 'Unknown' },
        industry_supervisor_comments: (data as unknown as WeekDataFromDB).industry_supervisor_comments || "",
      });
      setIndustryComments((data as unknown as WeekDataFromDB).industry_supervisor_comments || "");
      setSchoolComments((data as unknown as WeekDataFromDB).school_supervisor_comments || "");
      setScore((data as unknown as WeekDataFromDB).score || "");
    } catch (error: unknown) {
      toast.error("Error loading week data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [weekId]);

  useEffect(() => {
    fetchWeekData();
  }, [fetchWeekData]);


  const handleIndustryStamp = async (file: File) => {
    if (!weekData || !user) return;

    setUploading(true);
    try {
      const lagosTime = toZonedTime(new Date(), 'Africa/Lagos');
      
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("student-photos")
        .upload(`stamps/${fileName}`, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("student-photos")
        .getPublicUrl(`stamps/${fileName}`);

      const { error: stampError } = await supabase
        .from("stamps")
        .insert([{
          week_id: weekData.id,
          supervisor_id: user.id,
          method: "upload",
          image_path: publicUrl,
          proof_hash: `hash-${Date.now()}`,
        }]);

      if (stampError) throw stampError;

      const { error: updateError } = await supabase
        .from("weeks")
        .update({ 
          status: "submitted",
          forwarded_to_school: true 
        })
        .eq("id", weekData.id);

      if (updateError) throw updateError;

      toast.success("Stamp applied and forwarded to school supervisor");
      setShowSignaturePad(false);
      navigate("/supervisor/dashboard");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to apply stamp";
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleIndustryApprove = async () => {
    if (!weekData || !user) return;

    setUploading(true);
    try {
      const lagosTime = toZonedTime(new Date(), 'Africa/Lagos');
      
      // Get supervisor ID
      const { data: supervisorData } = await supabase
        .from("supervisors")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const { error } = await supabase
        .from("weeks")
        .update({ 
          industry_supervisor_comments: industryComments || null,
          industry_supervisor_approved_at: lagosTime.toISOString(),
          industry_supervisor_id: supervisorData?.id || null,
          forwarded_to_school: true,
          status: "submitted" // Still submitted until school approves
        })
        .eq("id", weekData.id);

      if (error) throw error;

      toast.success("Week approved and forwarded to school supervisor");
      
      // Invalidate queries to ensure dashboard shows updated data
      queryClient.invalidateQueries({ queryKey: ["weeks"] });
      queryClient.invalidateQueries({ queryKey: ["student-weeks"] });
      
      navigate("/supervisor/dashboard");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to approve week";
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleIndustryReject = async () => {
    if (!weekData || !user) return;

    if (!rejectionReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    try {
      const { error } = await supabase
        .from("weeks")
        .update({ 
          status: "rejected",
          rejection_reason: rejectionReason,
          industry_supervisor_comments: industryComments || null
        })
        .eq("id", weekData.id);

      if (error) throw error;

      toast.success("Week rejected - student can resubmit");
      
      // Invalidate queries to ensure dashboard shows updated data
      queryClient.invalidateQueries({ queryKey: ["weeks"] });
      queryClient.invalidateQueries({ queryKey: ["student-weeks"] });
      
      navigate("/supervisor/dashboard");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to reject week";
      toast.error(errorMessage);
    }
  };

  const handleSchoolApprove = async () => {
    if (!weekData || !user) return;

    // Validate score if provided
    if (score !== "" && (Number(score) < 0 || Number(score) > 100)) {
      toast.error("Score must be between 0 and 100");
      return;
    }

    setUploading(true);
    try {
      const lagosTime = toZonedTime(new Date(), 'Africa/Lagos');
      
      // Get supervisor ID
      const { data: supervisorData } = await supabase
        .from("supervisors")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      
      const { error } = await supabase
        .from("weeks")
        .update({ 
          status: "approved",
          school_supervisor_approved_at: lagosTime.toISOString(),
          school_supervisor_id: supervisorData?.id || null,
          school_supervisor_comments: schoolComments || null,
          score: score === "" ? null : Number(score)
        })
        .eq("id", weekData.id);

      if (error) throw error;

      toast.success("Week approved by school supervisor");
      
      // Invalidate queries to ensure dashboard shows updated data
      queryClient.invalidateQueries({ queryKey: ["weeks"] });
      queryClient.invalidateQueries({ queryKey: ["student-weeks"] });
      
      // Log approval activity
      try {
        const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
        await fetch(`${API_BASE_URL}/api/auth/log-activity`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            userType: "school_supervisor",
            userEmail: user.email,
            activityType: "week_approve",
            activityDetails: {
              weekId: weekData.id,
              weekNumber: weekData.week_number,
              studentId: weekData.student?.id,
              score: score === "" ? null : Number(score),
            },
            success: true,
          }),
        }).catch(() => {}); // Don't block on logging failure
      } catch {
        // Ignore logging errors
      }
      
      navigate("/supervisor/school/dashboard");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to approve week";
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleSchoolReject = async () => {
    if (!weekData || !user) return;

    if (!rejectionReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    try {
      const lagosTime = toZonedTime(new Date(), 'Africa/Lagos');
      
      const { error } = await supabase
        .from("weeks")
        .update({ 
          status: "rejected",
          rejection_reason: rejectionReason,
          school_supervisor_comments: schoolComments || null,
          school_approved_at: lagosTime.toISOString()
        })
        .eq("id", weekData.id);

      if (error) throw error;

      toast.success("Week rejected");
      
      // Invalidate queries to ensure dashboard shows updated data
      queryClient.invalidateQueries({ queryKey: ["weeks"] });
      queryClient.invalidateQueries({ queryKey: ["student-weeks"] });
      
      // Log rejection activity
      try {
        const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
        await fetch(`${API_BASE_URL}/api/auth/log-activity`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            userType: "school_supervisor",
            userEmail: user.email,
            activityType: "week_reject",
            activityDetails: {
              weekId: weekData.id,
              weekNumber: weekData.week_number,
              studentId: weekData.student?.id,
              rejectionReason: rejectionReason,
            },
            success: true,
          }),
        }).catch(() => {}); // Don't block on logging failure
      } catch {
        // Ignore logging errors
      }
      
      navigate("/supervisor/school/dashboard");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to reject week";
      toast.error(errorMessage);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "submitted":
        return <Badge variant="default">Submitted</Badge>;
      case "approved":
        return <Badge className="bg-green-500">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!weekData) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Week not found</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const isSchoolSupervisor = userRole === "school_supervisor";
  // School supervisors can approve/reject submitted weeks directly (no industry supervisor step)
  const canSchoolAct = isSchoolSupervisor && weekData.status === "submitted" && !weekData.school_approved_at;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!weekData) return;
    
    try {
      toast.info("Generating PDF...");
      
      const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
      
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${API_BASE_URL}/api/pdf/generate-week-pdf`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({ weekId: weekData.id }),
      });
      
      if (!response.ok) {
        // Fallback to browser print if backend is unavailable
        console.warn("Backend PDF generation failed, using browser print fallback");
        const printContent = `
          <html>
            <head>
              <title>Weekly Report - Week ${weekData.week_number}</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1 { text-align: center; }
                .header { text-align: center; margin-bottom: 20px; }
                .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; padding: 15px; background: #f5f5f5; }
                .day { margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #ddd; }
                .day-title { font-weight: bold; margin-bottom: 5px; }
                .comments { margin-top: 20px; padding: 10px; background: #f9f9f9; }
                .status { text-align: center; padding: 10px; margin-top: 20px; }
                .images { margin-top: 20px; }
                .images img { max-width: 200px; margin: 5px; }
              </style>
            </head>
            <body>
              <div class="header">
                <h1>SIWES Weekly Report</h1>
                <h2>Week ${weekData.week_number}</h2>
                <p>${format(new Date(weekData.start_date), "MMM d")} - ${format(new Date(weekData.end_date), "MMM d, yyyy")}</p>
              </div>
              
              <div class="info-grid">
                <div><strong>Student:</strong> ${weekData.profile.full_name}</div>
                <div><strong>Matric No:</strong> ${weekData.student.matric_no}</div>
                <div><strong>Department:</strong> ${weekData.student.department}</div>
                <div><strong>Organisation:</strong> ${weekData.student.organisation_name}</div>
              </div>
              
              <h3>Daily Activities</h3>
              ${['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].map((day) => {
                const activity = weekData[`${day}_activity` as keyof WeekData] as string | null;
                return `
                  <div class="day">
                    <div class="day-title">${day.charAt(0).toUpperCase() + day.slice(1)}</div>
                    <p>${activity || 'No activity logged'}</p>
                  </div>
                `;
              }).join('')}
              
              ${weekData.comments ? `
                <div class="comments">
                  <strong>Student Comments:</strong>
                  <p>${weekData.comments}</p>
                </div>
              ` : ''}
              
              ${weekData.image_urls && weekData.image_urls.length > 0 ? `
                <div class="images">
                  <h3>Evidence Photos</h3>
                  ${weekData.image_urls.map((url: string) => `<img src="${url}" alt="Evidence" />`).join('')}
                </div>
              ` : ''}
              
              ${weekData.score !== null ? `
                <div class="status">
                  <strong>Score: ${weekData.score}/100</strong>
                </div>
              ` : ''}
              
              <div class="status">
                <strong>Status: ${weekData.status.toUpperCase()}</strong>
                ${weekData.school_supervisor_approved_at ? `<br>Approved on: ${format(new Date(weekData.school_supervisor_approved_at), "MMM d, yyyy")}` : ''}
              </div>
            </body>
          </html>
        `;
        
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(printContent);
          printWindow.document.close();
          printWindow.print();
        }
        return;
      }
      
      // Download the PDF blob
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Week_${weekData.week_number}_Report.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success("PDF downloaded successfully!");
    } catch (error) {
      toast.error("Failed to generate PDF");
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => navigate(userRole === "school_supervisor" ? "/supervisor/school/dashboard" : "/supervisor/dashboard")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <div className="flex gap-2 print:hidden">
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button variant="outline" onClick={handleDownloadPDF}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Week {weekData.week_number} - Weekly Report</CardTitle>
                  <CardDescription>
                    {format(new Date(weekData.start_date), "MMM d")} - {format(new Date(weekData.end_date), "MMM d, yyyy")}
                  </CardDescription>
                </div>
                {getStatusBadge(weekData.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Student Info with Profile Picture */}
              <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                {/* Profile Picture */}
                <Avatar className="h-20 w-20 border-2 border-primary/20 shadow-md flex-shrink-0">
                  <AvatarImage 
                    src={weekData.student.profile_image_url || undefined} 
                    alt={weekData.profile.full_name}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                    {weekData.profile.full_name
                      .split(" ")
                      .map(n => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                
                {/* Student Details */}
                <div className="grid grid-cols-2 gap-4 flex-1">
                  <div>
                    <p className="text-sm text-muted-foreground">Student Name</p>
                    <p className="font-medium">{weekData.profile.full_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Matric No.</p>
                    <p className="font-medium">{weekData.student.matric_no}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Department</p>
                    <p className="font-medium">{weekData.student.department}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Organisation</p>
                    <p className="font-medium">{weekData.student.organisation_name}</p>
                  </div>
                </div>
              </div>

              {weekData.submitted_at && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    Submitted on: {format(new Date(weekData.submitted_at), "MMMM d, yyyy 'at' h:mm a")} (Africa/Lagos time)
                  </p>
                </div>
              )}


              <div className="space-y-6">
                <h3 className="font-semibold text-lg">Daily Activities</h3>
                {days.map((day, index) => {
                  const activity = weekData[`${day}_activity` as keyof WeekData] as string | null;
                  
                  return (
                    <div key={day} className="space-y-3 pb-4 border-b last:border-0">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium capitalize">{day}</h4>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(weekData.start_date).setDate(new Date(weekData.start_date).getDate() + index), "MMM d, yyyy")}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">
                        {activity || <span className="text-muted-foreground">No activity logged</span>}
                      </p>
                    </div>
                  );
                })}

                {/* Weekly Report Images */}
                {weekData.image_urls && weekData.image_urls.length > 0 && (
                  <div className="space-y-2">
                    <Label>Weekly Report Images</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {weekData.image_urls.map((imageUrl, index) => (
                        <div key={index} className="group relative">
                          <img
                            src={imageUrl}
                            alt={`Weekly report image ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => window.open(imageUrl, '_blank')}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Digital Stamps & Signatures Section */}
              {stamps.length > 0 && (
                <div className="space-y-3 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Stamp className="h-5 w-5 text-green-600" />
                    <Label className="text-green-800 dark:text-green-200 font-semibold">Digital Stamps & Signatures</Label>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {stamps.map((stamp) => (
                      <div key={stamp.id} className="space-y-2">
                        {stamp.image_path ? (
                          <img
                            src={stamp.image_path}
                            alt={`${stamp.method === 'signature' ? 'Signature' : 'Stamp'}`}
                            className="max-h-24 max-w-full object-contain border border-green-300 rounded-md bg-white p-2 cursor-pointer hover:opacity-80"
                            onClick={() => window.open(stamp.image_path!, '_blank')}
                          />
                        ) : (
                          <div className="h-20 border border-dashed border-green-300 rounded-md flex items-center justify-center text-sm text-muted-foreground">
                            No image
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {stamp.method === 'signature' ? '✍️ Signature' : '🔖 Stamp'} • {format(new Date(stamp.signed_at), "MMM d, yyyy")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {weekData.comments && (
                <div className="space-y-2">
                  <Label>Student Comments</Label>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm whitespace-pre-wrap">{weekData.comments}</p>
                  </div>
                </div>
              )}

              {canSchoolAct && (
                <div className="flex flex-col space-y-4 pt-6 border-t">
                  <div className="space-y-2">
                    <Label>School Supervisor Comments (Optional)</Label>
                    <Textarea
                      value={schoolComments}
                      onChange={(e) => setSchoolComments(e.target.value)}
                      placeholder="Add your comments or feedback..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Assessment Score (0-100)</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={score}
                        onChange={(e) => setScore(e.target.value === "" ? "" : Number(e.target.value))}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 max-w-[150px]"
                        placeholder="Score"
                      />
                      <span className="text-sm text-muted-foreground">/ 100</span>
                    </div>
                  </div>
                  
                  <div className="flex space-x-4">
                    <Button onClick={handleSchoolApprove} className="flex-1" disabled={uploading}>
                      <Check className="h-4 w-4 mr-2" />
                      {uploading ? "Approving..." : "Approve & Grade"}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label>Rejection Reason (Required for rejection)</Label>
                    <Textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Provide feedback for rejection..."
                      rows={3}
                    />
                    <Button 
                      onClick={handleSchoolReject} 
                      variant="destructive" 
                      disabled={!rejectionReason.trim() || uploading}
                      className="w-full"
                    >
                      <X className="h-4 w-4 mr-2" />
                      {uploading ? "Rejecting..." : "Reject Submission"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default WeeklyReportView;
