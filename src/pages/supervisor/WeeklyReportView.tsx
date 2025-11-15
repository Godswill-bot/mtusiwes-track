import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ArrowLeft, Check, X, FileSignature } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SignaturePad } from "@/components/SignaturePad";
import { toZonedTime } from "date-fns-tz";

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
  student: {
    matric_no: string;
    department: string;
    faculty: string;
    period_of_training: string;
    organisation_name: string;
    user_id: string;
  };
  profile: {
    full_name: string;
  };
}

const WeeklyReportView = () => {
  const { weekId } = useParams();
  const navigate = useNavigate();
  const { user, userRole } = useAuth();
  const [weekData, setWeekData] = useState<WeekData | null>(null);
  const [photos, setPhotos] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [rejectionReason, setRejectionReason] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [schoolComments, setSchoolComments] = useState("");

  useEffect(() => {
    fetchWeekData();
  }, [weekId]);

  const fetchWeekData = async () => {
    if (!weekId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("weeks")
        .select(`
          *,
          student:students!inner(
            matric_no,
            department,
            faculty,
            period_of_training,
            organisation_name,
            user_id
          )
        `)
        .eq("id", weekId)
        .single();

      if (error) throw error;

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", data.student.user_id)
        .single();

      if (profileError) throw profileError;

      setWeekData({ ...data, profile: profileData });
      fetchPhotos(weekId);
    } catch (error: any) {
      toast.error("Error loading week data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPhotos = async (wkId: string) => {
    try {
      const { data, error } = await supabase
        .from("photos")
        .select("*")
        .eq("week_id", wkId)
        .order("uploaded_at", { ascending: true });

      if (error) throw error;

      const photosByDay: Record<string, any[]> = {};
      data?.forEach((photo) => {
        if (!photosByDay[photo.day_of_week]) {
          photosByDay[photo.day_of_week] = [];
        }
        photosByDay[photo.day_of_week].push(photo);
      });
      setPhotos(photosByDay);
    } catch (error) {
      console.error("Error fetching photos:", error);
    }
  };

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
    } catch (error: any) {
      toast.error(error.message || "Failed to apply stamp");
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
          rejection_reason: rejectionReason 
        })
        .eq("id", weekData.id);

      if (error) throw error;

      toast.success("Week rejected - student can resubmit");
      navigate("/supervisor/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Failed to reject week");
    }
  };

  const handleSchoolApprove = async () => {
    if (!weekData || !user) return;

    try {
      const lagosTime = toZonedTime(new Date(), 'Africa/Lagos');
      
      const { error } = await supabase
        .from("weeks")
        .update({ 
          status: "approved",
          school_approved_at: lagosTime.toISOString(),
          school_supervisor_comments: schoolComments || null
        })
        .eq("id", weekData.id);

      if (error) throw error;

      toast.success("Week approved by school supervisor");
      navigate("/supervisor/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Failed to approve week");
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
      navigate("/supervisor/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Failed to reject week");
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
  const isIndustrySupervisor = userRole === "industry_supervisor";
  const isSchoolSupervisor = userRole === "school_supervisor";
  const canIndustryAct = isIndustrySupervisor && weekData.status === "submitted" && !weekData.forwarded_to_school;
  const canSchoolAct = isSchoolSupervisor && weekData.forwarded_to_school && !weekData.school_approved_at;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/supervisor/dashboard")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>

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
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
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

              {weekData.submitted_at && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    Submitted on: {format(new Date(weekData.submitted_at), "MMMM d, yyyy 'at' h:mm a")} (Africa/Lagos time)
                  </p>
                </div>
              )}

              {weekData.forwarded_to_school && (
                <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-sm text-green-900 dark:text-green-100">
                    ✓ Stamped and forwarded to school supervisor
                  </p>
                </div>
              )}

              <div className="space-y-6">
                <h3 className="font-semibold text-lg">Daily Activities</h3>
                {days.map((day, index) => {
                  const activity = weekData[`${day}_activity` as keyof WeekData] as string | null;
                  const dayPhotos = photos[day] || [];
                  
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
                      {dayPhotos.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                          {dayPhotos.map((photo) => (
                            <div key={photo.id} className="group relative">
                              <img
                                src={photo.image_url}
                                alt={photo.description || "Work photo"}
                                className="w-full h-32 object-cover rounded-lg border"
                              />
                              {photo.description && (
                                <p className="text-xs text-muted-foreground mt-1">{photo.description}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {weekData.comments && (
                <div className="space-y-2">
                  <Label>Student Comments</Label>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm whitespace-pre-wrap">{weekData.comments}</p>
                  </div>
                </div>
              )}

              {canIndustryAct && (
                <div className="flex flex-col space-y-4 pt-6 border-t">
                  <div className="flex space-x-4">
                    <Dialog open={showSignaturePad} onOpenChange={setShowSignaturePad}>
                      <DialogTrigger asChild>
                        <Button className="flex-1">
                          <FileSignature className="h-4 w-4 mr-2" />
                          Add Stamp & Forward
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Apply Digital Stamp</DialogTitle>
                          <DialogDescription>
                            Sign or upload your stamp to approve and forward to school supervisor
                          </DialogDescription>
                        </DialogHeader>
                        <SignaturePad
                          onSignatureComplete={handleIndustryStamp}
                          onCancel={() => setShowSignaturePad(false)}
                        />
                      </DialogContent>
                    </Dialog>
                  </div>

                  <div className="space-y-2">
                    <Label>Rejection Reason</Label>
                    <Textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Provide feedback for rejection..."
                      rows={3}
                    />
                    <Button 
                      onClick={handleIndustryReject} 
                      variant="destructive" 
                      disabled={!rejectionReason.trim()}
                      className="w-full"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Reject Submission
                    </Button>
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
                      placeholder="Add your comments..."
                      rows={3}
                    />
                  </div>
                  
                  <div className="flex space-x-4">
                    <Button onClick={handleSchoolApprove} className="flex-1">
                      <Check className="h-4 w-4 mr-2" />
                      Final Approve
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label>Rejection Reason</Label>
                    <Textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Provide feedback for rejection..."
                      rows={3}
                    />
                    <Button 
                      onClick={handleSchoolReject} 
                      variant="destructive" 
                      disabled={!rejectionReason.trim()}
                      className="w-full"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Reject Submission
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
