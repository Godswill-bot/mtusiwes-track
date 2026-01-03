import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, User } from "lucide-react";
import mtuLogo from "@/assets/mtu-logo.png";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Navbar = () => {
  const { user, userRole, profile, signOut } = useAuth();

  // Fetch student profile image if user is a student
  const { data: studentData } = useQuery({
    queryKey: ["student-profile-image", user?.id],
    queryFn: async () => {
      if (!user?.id || userRole !== "student") return null;
      const { data } = await supabase
        .from("students")
        .select("profile_image_url")
        .eq("user_id", user.id)
        .single();
      return data;
    },
    enabled: !!user?.id && userRole === "student",
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const getRoleDisplay = (role: string | null) => {
    if (!role) return "";
    return role.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(part => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const profileImageUrl = studentData?.profile_image_url;

  return (
    <nav className="bg-white border-b border-border shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <img src={mtuLogo} alt="MTU Logo" className="h-10 w-10" />
            <div>
              <h1 className="text-lg font-bold text-primary">MTU SIWES</h1>
              <p className="text-xs text-muted-foreground">Logbook System</p>
            </div>
          </div>

          {user && (
            <div className="flex items-center space-x-4">
              {profile && (
                <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 bg-primary/10 rounded-full">
                  {profileImageUrl ? (
                    <Avatar className="h-7 w-7 border border-primary/20">
                      <AvatarImage src={profileImageUrl} alt={profile.full_name} />
                      <AvatarFallback className="text-xs bg-primary/20 text-primary">
                        {getInitials(profile.full_name)}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <User className="h-4 w-4 text-primary" />
                  )}
                  <span className="text-sm font-medium text-primary">
                    {profile.full_name} ({getRoleDisplay(profile.role)})
                  </span>
                </div>
              )}
              <Button onClick={signOut} variant="outline" size="sm">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};
