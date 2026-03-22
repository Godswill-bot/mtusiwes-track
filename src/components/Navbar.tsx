import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, User } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import mtuLogo from "@/assets/mtu-logo.png";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Navbar = () => {
  const { user, userRole, profile, signOut } = useAuth();
  const [isSignOutDialogOpen, setIsSignOutDialogOpen] = useState(false);

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
    <nav className="bg-background border-b border-border shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <img src={mtuLogo} alt="MTU Logo" className="h-10 w-10" />
            <div>
              <h1 className="text-lg font-bold text-primary">MTU SIWES</h1>
              <p className="text-xs text-muted-foreground">Logbook System</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            <ThemeToggle />
            {user && (
              <>
                {profile && (
                <div className="flex items-center space-x-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-primary/10 rounded-full">
                  {profileImageUrl ? (
                    <Avatar className="h-6 w-6 sm:h-7 sm:w-7 border border-primary/20">
                      <AvatarImage src={profileImageUrl} alt={profile.full_name} />
                      <AvatarFallback className="text-[10px] sm:text-xs bg-primary/20 text-primary">
                        {getInitials(profile.full_name)}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <User className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                  )}
                  <span className="text-xs sm:text-sm font-medium text-primary hidden sm:inline-block">
                    {profile.full_name} ({getRoleDisplay(profile.role)})
                  </span>
                  <span className="text-[10px] font-medium text-primary sm:hidden max-w-[80px] truncate">
                    {profile.full_name.split(' ')[0]}
                  </span>
                </div>
              )}
              <AlertDialog open={isSignOutDialogOpen} onOpenChange={setIsSignOutDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="px-2 sm:px-3">
                    <LogOut className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Sign Out</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure you want to sign out?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You will need to sign in again to access your dashboard.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={signOut} className="bg-primary hover:bg-primary/90">
                      Sign Out
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
