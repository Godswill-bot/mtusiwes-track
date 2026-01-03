import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const PreSiwes = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    matric_no: "",
    faculty: "" as "CBAS" | "CHMS" | "",
    department: "",
    level: "",
    organisation_name: "",
    organisation_address: "",
    industry_supervisor_name: "",
    industry_supervisor_email: "",
    industry_supervisor_phone: "",
    nature_of_business: "",
    location_size: "small",
    start_date: "",
    end_date: "",
    other_info: "",
  });

  // Department options based on faculty
  const CBAS_DEPARTMENTS = [
    "Software Engineering",
    "Computer Science",
    "Cybersecurity",
    "Physics",
    "Geophysics",
    "Biochemistry",
    "Biology",
    "Microbiology",
    "Chemistry",
    "Data Science"
  ];

  const CHMS_DEPARTMENTS = [
    "Fine Art",
    "Mass Communication",
    "Accounting",
    "Business Administration"
  ];

  const getDepartmentOptions = (): string[] => {
    if (formData.faculty === "CBAS") return CBAS_DEPARTMENTS;
    if (formData.faculty === "CHMS") return CHMS_DEPARTMENTS;
    return [];
  };


  const loadExistingData = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      // Pre-fill form with any existing data if available
      if (data) {
        setFormData((prev) => ({
          ...prev,
          matric_no: data.matric_no || "",
          faculty: (data.faculty as "CBAS" | "CHMS") || "",
          department: data.department || "",
          level: data.level || "",
          organisation_name: data.organisation_name || "",
          organisation_address: data.organisation_address || "",
          industry_supervisor_name: data.industry_supervisor_name || "",
          industry_supervisor_email: data.industry_supervisor_email || "",
          industry_supervisor_phone: data.industry_supervisor_phone || "",
          nature_of_business: data.nature_of_business || "",
          location_size: data.location_size || "small",
          start_date: data.start_date || "",
          end_date: data.end_date || "",
          other_info: data.other_info || "",
        }));
      }
    } catch (error) {
      console.error("Error loading existing data:", error);
    }
  }, [user]);

  useEffect(() => {
    loadExistingData();
  }, [user, loadExistingData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error("You must be logged in to submit the form.");
      return;
    }

    if (!formData.matric_no?.trim()) {
      toast.error("Please enter your matriculation number.");
      return;
    }

    if (!formData.faculty) {
      toast.error("Please select your faculty.");
      return;
    }

    if (!formData.department?.trim()) {
      toast.error("Please select your department.");
      return;
    }

    if (!formData.start_date || !formData.end_date) {
      toast.error("Please select start and end dates.");
      return;
    }

    setLoading(true);

    try {
      // Check if matric number already exists for another student
      const { data: existingMatric, error: matricCheckError } = await supabase
        .from("students")
        .select("user_id, matric_no")
        .eq("matric_no", formData.matric_no.trim())
        .maybeSingle();

      if (matricCheckError && matricCheckError.code !== 'PGRST116') {
        throw matricCheckError;
      }

      // If matric number exists and belongs to a different user, prevent duplicate
      if (existingMatric && existingMatric.user_id !== user.id) {
        toast.error("This matriculation number is already registered to another student. Please check your matric number and try again.");
        setLoading(false);
        return;
      }

      // First, fetch existing student record to get current values for safe defaults
      const { data: existingStudent } = await supabase
        .from("students")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      // Build safe values for required NOT NULL fields
      // Prefer form values, then existing values, then safe defaults
      const safeMatric =
        formData.matric_no?.trim() ||
        existingStudent?.matric_no ||
        `PENDING-${(user.id || Date.now().toString()).replace(/[^a-zA-Z0-9]/g, "").slice(0, 12)}`;

      const safeFaculty = formData.faculty || existingStudent?.faculty || "Not provided";
      const safeDepartment = formData.department || existingStudent?.department || "Not provided";
      const safeLevel = formData.level?.trim() || existingStudent?.level || "";
      const safePhone = existingStudent?.phone || "";
      const safeEmail = existingStudent?.email || user.email || "";
      const safeFullName = existingStudent?.full_name || profile?.full_name || "";

      // Use form data if provided, otherwise keep existing values, otherwise use defaults
      const safeOrganisation = formData.organisation_name || existingStudent?.organisation_name || "To be updated";
      const safeOrgAddress =
        formData.organisation_address || existingStudent?.organisation_address || "To be updated";
      const safeNature = formData.nature_of_business || existingStudent?.nature_of_business || "To be updated";
      const safeLocationSize = formData.location_size || existingStudent?.location_size || "medium";
      const safeProducts =
        existingStudent?.products_services || formData.nature_of_business || "To be updated";
      const safeIndustrySupervisor =
        formData.industry_supervisor_name || existingStudent?.industry_supervisor_name || "To be updated";
      const safeIndustryEmail =
        formData.industry_supervisor_email || existingStudent?.industry_supervisor_email || "";
      const safeIndustryPhone =
        formData.industry_supervisor_phone || existingStudent?.industry_supervisor_phone || "";

      const periodOfTraining =
        formData.start_date && formData.end_date
          ? `${formData.start_date} to ${formData.end_date}`
          : existingStudent?.period_of_training || "To be updated";

      // Prepare submission data with user_id included for upsert conflict resolution
      // Note: user_id is UNIQUE, so upsert will update if a record with this user_id exists
      const submissionData = {
        user_id: user.id, // Include user_id so upsert can match on this UNIQUE constraint
        full_name: safeFullName,
        email: safeEmail,
        phone: safePhone,
        matric_no: safeMatric,
        faculty: safeFaculty,
        department: safeDepartment,
        level: safeLevel,
        organisation_name: safeOrganisation,
        organisation_address: safeOrgAddress,
        nature_of_business: safeNature,
        location_size: safeLocationSize as "small" | "medium" | "large",
        products_services: safeProducts,
        industry_supervisor_name: safeIndustrySupervisor,
        industry_supervisor_email: safeIndustryEmail,
        industry_supervisor_phone: safeIndustryPhone,
        start_date: formData.start_date,
        end_date: formData.end_date,
        period_of_training: periodOfTraining,
        // Clear rejection message if present, but keep other info
        other_info: formData.other_info?.startsWith("Rejected:") 
          ? formData.other_info.replace(/^Rejected:\s*/, "").trim() || null
          : formData.other_info || null,
        pre_registration_approved: false, // Pending school supervisor approval - reset on resubmission
        pre_registration_approved_at: null, // Clear approval timestamp on resubmission
      };

      // Use upsert to handle both insert and update atomically
      // This prevents duplicate key errors by updating if user_id already exists
      const { error } = await supabase
        .from("students")
        .upsert(submissionData, {
          onConflict: "user_id", // Resolve conflicts on the UNIQUE user_id column
        });

      if (error) {
        // If upsert still fails (unlikely but handle gracefully), try update as fallback
        if (error.code === "23505" || error.message?.includes("duplicate key") || error.message?.includes("unique constraint")) {
          // Record exists but upsert failed - try explicit update
          const { error: updateError } = await supabase
            .from("students")
            .update(submissionData)
            .eq("user_id", user.id);

          if (updateError) {
            console.error("Failed to update student record:", updateError);
            throw new Error("Failed to save registration. Please try again or contact support if the issue persists.");
          }
        } else {
          // Other database errors
          console.error("Database error during student registration:", error);
          throw error;
        }
      }

      // --- NEW: Create/Update Pre-Registration Record ---
      try {
        // 1. Get the student ID (needed for pre_registration table)
        const { data: studentRecord } = await supabase
          .from("students")
          .select("id")
          .eq("user_id", user.id)
          .single();

        // 2. Get current session
        const { data: currentSession } = await supabase
          .from("academic_sessions")
          .select("id")
          .eq("is_current", true)
          .maybeSingle();

        if (studentRecord && currentSession) {
          // 3. Upsert pre_registration
          const { error: preRegError } = await supabase
            .from("pre_registration")
            .upsert({
              student_id: studentRecord.id,
              session_id: currentSession.id,
              status: 'pending',
              remark: null, // Clear rejection remark
            }, {
              onConflict: 'student_id, session_id'
            });

          if (preRegError) {
            console.error("Error updating pre-registration status:", preRegError);
          }
        }
      } catch (err) {
        console.error("Error in pre-registration workflow:", err);
      }
      // --------------------------------------------------

      // Log pre-registration submission
      try {
        const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
        await fetch(`${API_BASE_URL}/api/auth/log-activity`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            userType: "student",
            userEmail: user.email,
            activityType: "pre_registration_submit",
            success: true,
          }),
        }).catch(() => {}); // Don't block on logging failure
      } catch {
        // Ignore logging errors
      }

      // Get student ID from the upserted record for subsequent operations
      const { data: studentRecord } = await supabase
        .from("students")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!studentRecord) {
        throw new Error("Failed to retrieve student record after submission.");
      }

      // Automatically assign student to a random school supervisor
      try {
        const { data: supervisorId, error: assignmentError } = await supabase.rpc(
          "assign_student_to_school_supervisor",
          { p_student_id: studentRecord.id }
        );

        if (assignmentError) {
          console.error("Error assigning supervisor:", assignmentError);
          // Don't block submission if assignment fails - log and continue
          toast.warning("Registration submitted, but supervisor assignment failed. Please contact admin.");
        } else if (supervisorId) {
          console.log("Student automatically assigned to supervisor:", supervisorId);
        } else {
          console.warn("No active school supervisor available for assignment.");
          toast.warning("Registration submitted, but no supervisor available. Please contact admin.");
        }
      } catch (assignmentErr) {
        console.error("Unexpected error during supervisor assignment:", assignmentErr);
        // Don't block submission
      }

      // Create/update student placement record for current academic session
      try {
        // Get current academic session
        const { data: currentSession } = await supabase
          .from("academic_sessions")
          .select("id")
          .eq("is_current", true)
          .maybeSingle();

        if (currentSession && studentRecord) {
          // Create/update placement record
          const { error: placementError } = await supabase
            .from("student_placements")
            .upsert(
              {
                student_id: studentRecord.id,
                session_id: currentSession.id,
                organisation_name: safeOrganisation,
                organisation_address: safeOrgAddress,
                placement_date: new Date().toISOString(),
              },
              {
                onConflict: "student_id,session_id",
              }
            );

          if (placementError) {
            console.error("Error upserting student placement:", placementError);
            toast.error("Failed to save placement information.");
          }
        } else {
          console.warn("No current academic session found. Student placement not recorded.");
          toast.warning("No current academic session found. Placement not recorded.");
        }
      } catch (placementError) {
        console.error("Unexpected error during placement upsert:", placementError);
        toast.error("An unexpected error occurred while saving placement information.");
      }

      toast.success("Pre-registration submitted! Awaiting school supervisor approval.");
      navigate("/student/dashboard");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to submit registration";
      toast.error(errorMessage);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gradient-light">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate("/student/dashboard")}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <Card className="shadow-elevated">
            <CardHeader>
              <CardTitle className="text-2xl">Pre-SIWES Registration Form</CardTitle>
              <CardDescription>
                Complete this form before starting your industrial training
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="border-t pt-6 space-y-4">
                  <h3 className="font-semibold text-lg">Student Information</h3>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="matric_no">Matric Number *</Label>
                      <Input
                        id="matric_no"
                        value={formData.matric_no}
                        onChange={(e) => handleChange("matric_no", e.target.value)}
                        required
                        placeholder="e.g., MTU/20/0001"
                        maxLength={20}
                        pattern="[A-Za-z0-9/]+"
                        title="Enter your matriculation number"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="level">Level *</Label>
                      <Input
                        id="level"
                        value={formData.level}
                        onChange={(e) => handleChange("level", e.target.value)}
                        required
                        placeholder="e.g., 300, 400"
                        maxLength={3}
                        pattern="[0-9]+"
                        title="Enter your level (e.g., 300, 400)"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="faculty">Faculty *</Label>
                      <Select
                        value={formData.faculty}
                        onValueChange={(value) => {
                          handleChange("faculty", value);
                          // Clear department when faculty changes
                          handleChange("department", "");
                        }}
                        required
                      >
                        <SelectTrigger id="faculty">
                          <SelectValue placeholder="Select Faculty" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CBAS">CBAS</SelectItem>
                          <SelectItem value="CHMS">CHMS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="department">Department *</Label>
                      <Select
                        value={formData.department}
                        onValueChange={(value) => handleChange("department", value)}
                        required
                        disabled={!formData.faculty}
                      >
                        <SelectTrigger id="department">
                          <SelectValue placeholder={formData.faculty ? "Select Department" : "Select Faculty first"} />
                        </SelectTrigger>
                        <SelectContent>
                          {getDepartmentOptions().map((dept) => (
                            <SelectItem key={dept} value={dept}>
                              {dept}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6 space-y-4">
                  <h3 className="font-semibold text-lg">Organisation Information</h3>

                  <div className="space-y-2">
                    <Label htmlFor="organisation_name">Organisation Name *</Label>
                    <Input
                      id="organisation_name"
                      value={formData.organisation_name}
                      onChange={(e) => handleChange("organisation_name", e.target.value)}
                      required
                      placeholder="ABC Company Limited"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="organisation_address">Full Address *</Label>
                    <Textarea
                      id="organisation_address"
                      value={formData.organisation_address}
                      onChange={(e) => handleChange("organisation_address", e.target.value)}
                      required
                      placeholder="123 Main Street, Lagos, Nigeria"
                      rows={3}
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nature_of_business">Nature of Business *</Label>
                      <Input
                        id="nature_of_business"
                        value={formData.nature_of_business}
                        onChange={(e) => handleChange("nature_of_business", e.target.value)}
                        required
                        placeholder="Software Development"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="location_size">Location Size *</Label>
                      <Select
                        value={formData.location_size}
                        onValueChange={(value) => handleChange("location_size", value)}
                      >
                        <SelectTrigger id="location_size">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="small">Small</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="large">Large</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                </div>

                <div className="border-t pt-6 space-y-4">
                  <h3 className="font-semibold text-lg">Training Period</h3>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="start_date">Start Date *</Label>
                      <Input
                        id="start_date"
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => handleChange("start_date", e.target.value)}
                        required
                        disabled={loading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="end_date">End Date *</Label>
                      <Input
                        id="end_date"
                        type="date"
                        value={formData.end_date}
                        onChange={(e) => handleChange("end_date", e.target.value)}
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6 space-y-4">
                  <h3 className="font-semibold text-lg">Industry Supervisor Information</h3>

                  <div className="space-y-2">
                    <Label htmlFor="industry_supervisor_name">Supervisor Name *</Label>
                    <Input
                      id="industry_supervisor_name"
                      value={formData.industry_supervisor_name}
                      onChange={(e) => handleChange("industry_supervisor_name", e.target.value)}
                      required
                      placeholder="Dr. John Doe"
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="industry_supervisor_email">Supervisor Email</Label>
                      <Input
                        id="industry_supervisor_email"
                        type="email"
                        value={formData.industry_supervisor_email}
                        onChange={(e) => handleChange("industry_supervisor_email", e.target.value)}
                        placeholder="supervisor@company.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="industry_supervisor_phone">Supervisor Phone</Label>
                      <Input
                        id="industry_supervisor_phone"
                        type="tel"
                        value={formData.industry_supervisor_phone}
                        onChange={(e) => handleChange("industry_supervisor_phone", e.target.value)}
                        placeholder="+234 xxx xxx xxxx"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6 space-y-4">
                  <h3 className="font-semibold text-lg">Additional Information</h3>

                  <div className="space-y-2">
                    <Label htmlFor="other_info">Extra Notes</Label>
                    <Textarea
                      id="other_info"
                      value={formData.other_info}
                      onChange={(e) => handleChange("other_info", e.target.value)}
                      placeholder="Any additional information about your placement..."
                      rows={3}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="flex space-x-4">
                  <Button type="submit" disabled={loading} size="lg">
                    {loading ? "Submitting..." : "Submit Registration"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/student/dashboard")}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default PreSiwes;
