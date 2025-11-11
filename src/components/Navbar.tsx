import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, BookOpen, User } from "lucide-react";
import mtuLogo from "@/assets/mtu-logo.png";

export const Navbar = () => {
  const { user, userRole, signOut } = useAuth();

  const getRoleDisplay = (role: string | null) => {
    if (!role) return "";
    return role.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };

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
              <div className="hidden md:flex items-center space-x-2 text-sm">
                <User className="h-4 w-4 text-primary" />
                <span className="font-medium">{getRoleDisplay(userRole)}</span>
              </div>
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
