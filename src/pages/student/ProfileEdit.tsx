import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logProfileUpdate } from "@/utils/audit";
import { ProfileImageUpload } from "@/components/ProfileImageUpload";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const ProfileEdit = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  // Fetch student record to get profile image
  const { data: studentData, isLoading: studentLoading } = useQuery({
    queryKey: ["student-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("students")
        .select("id, profile_image_url, full_name")
        .eq("user_id", user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error("Error fetching student:", error);
      }
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
    }
  }, [profile]);

  // Handle profile image upload completion
  const handleProfileImageUpload = async (url: string) => {
    if (!studentData?.id) {
      toast.error("Student record not found");
      return;
    }

    try {
      const { error } = await supabase
        .from("students")
        .update({ profile_image_url: url })
        .eq("id", studentData.id);

      if (error) throw error;

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["student-profile"] });
      queryClient.invalidateQueries({ queryKey: ["student-data"] });
    } catch (error) {
      console.error("Error updating profile image:", error);
      toast.error("Failed to save profile image");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    setLoading(true);
    try {
      // Get old data
      const oldValue = { full_name: profile.full_name };
      const newValue = { full_name: fullName };

      const { data: updatedProfile, error } = await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", user.id)
        .select()
        .single();

      if (error) throw error;

      // Also update name in students table if exists
      if (studentData?.id) {
        await supabase
          .from("students")
          .update({ full_name: fullName })
          .eq("id", studentData.id);
      }

      // Log the update if name changed
      if (oldValue.full_name !== newValue.full_name) {
        await logProfileUpdate({
          userId: user.id,
          userType: profile.role || "student",
          userEmail: user.email || "",
          tableName: "profiles",
          recordId: user.id,
          oldValue,
          newValue: updatedProfile || newValue,
          changes: ["full_name"],
        });
      }

      // Invalidate all relevant queries to ensure UI reflects changes
      queryClient.invalidateQueries({ queryKey: ["student-profile"] });
      queryClient.invalidateQueries({ queryKey: ["student-data"] });
      queryClient.invalidateQueries({ queryKey: ["student-profile-image"] });

      toast.success("Profile updated successfully");
      navigate(-1);
    } catch (error: unknown) {
      toast.error("Error updating profile");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (studentLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Edit Profile
              </CardTitle>
              <CardDescription>Update your profile information and photo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Profile Picture Section */}
              <div className="flex flex-col items-center py-4">
                <h3 className="text-sm font-medium mb-4">Profile Picture</h3>
                <ProfileImageUpload
                  userId={user?.id || ""}
                  currentImageUrl={studentData?.profile_image_url}
                  fullName={profile?.full_name || "Student"}
                  onUploadComplete={handleProfileImageUpload}
                  size="lg"
                />
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  This photo will appear on your SIWES grading documents
                </p>
              </div>

              <Separator />

              {/* Profile Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>

                <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                  {loading ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default ProfileEdit;
