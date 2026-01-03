import { useEffect, useState, Component, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { StudentManager } from "@/components/admin/StudentManager";
import { SupervisorManager } from "@/components/admin/SupervisorManager";
import { WeeklyControlPanel } from "@/components/admin/WeeklyControlPanel";
// AttendanceControlPanel removed - Admin should only view PDFs saved by supervisors
import { AuditLogPanel } from "@/components/admin/AuditLogPanel";
import { PortalToggle } from "@/components/admin/PortalToggle";
import { AdminNotifications } from "@/components/admin/AdminNotifications";
import { OtherServices } from "@/components/admin/OtherServices";
import { DashboardOverview } from "@/components/admin/DashboardOverview";
// SupervisorAssignment removed - assignments are now automatic
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Users, UserCog, FileText, History, Bell, Settings, LayoutDashboard, Menu, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Simple Error Boundary Component
class ErrorBoundary extends Component<
  { name: string; children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { name: string; children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`Error in ${this.props.name}:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">{this.props.name} Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {this.state.error?.message || "An error occurred"}
            </p>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

const tableKeyMap: Record<string, Array<[string, string]>> = {
  students: [
    ["admin", "students"],
    ["admin", "students-basic"],
  ],
  supervisors: [["admin", "supervisors"]],
  weeks: [["admin", "weeks"]],
  audit_logs: [["admin", "audit"]],
};

type ActiveTab = 
  | "dashboard" 
  | "students" 
  | "supervisors" 
  | "weekly" 
  | "audit" 
  | "notifications"
  | "other-services"
  | null;

const AdminDashboard = () => {
  const { userRole, user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && userRole && userRole !== "admin") {
      navigate("/");
    }
  }, [userRole, navigate, loading]);

  useEffect(() => {
    // Test admin access to verify RLS policies
      const testAdminAccess = async () => {
        if (!user || userRole !== "admin") return;
        
        try {
          // Test query to settings table
          const { error: settingsError } = await supabase
            .from("settings")
            .select("key")
            .limit(1);
          
          if (settingsError) {
            setError(`Database access error: ${settingsError.message}. Please check RLS policies.`);
          }
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : "Unknown error";
          setError(`Failed to verify admin access: ${errorMessage}`);
        }
      };

    testAdminAccess();
  }, [user, userRole]);

  useEffect(() => {
    const channels = Object.keys(tableKeyMap).map((table) =>
      supabase
        .channel(`admin-${table}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          () => {
            tableKeyMap[table].forEach((key) =>
              queryClient.invalidateQueries({ queryKey: key })
            );
          },
        )
        .subscribe()
    );

    return () => {
      channels.forEach((channel) => supabase.removeChannel(channel));
    };
  }, [queryClient]);


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-light flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!user || userRole !== "admin") {
    return null; // Will redirect
  }

  // Tab configuration - Attendance removed per Phase 1 requirements
  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "students", label: "Students", icon: Users },
    { id: "supervisors", label: "Supervisors", icon: UserCog },
    { id: "weekly", label: "Weekly Reports", icon: FileText },
    { id: "audit", label: "Audit Trail", icon: History },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "other-services", label: "Other Services", icon: Settings },
  ] as const;

  const renderContent = () => {
    switch (activeTab) {
      case "students":
        return <StudentManager />;
      case "supervisors":
        return <SupervisorManager />;
      case "weekly":
        return <WeeklyControlPanel />;
      case "audit":
        return <AuditLogPanel />;
      case "notifications":
        return <AdminNotifications />;
      case "other-services":
        return <OtherServices />;
      default:
        return <DashboardOverview />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-light">
      <Navbar />
      <div className="flex">
        {/* Mobile sidebar toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="fixed bottom-4 right-4 z-50 lg:hidden bg-primary text-primary-foreground shadow-lg rounded-full h-12 w-12"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>

        {/* Sidebar overlay for mobile */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={cn(
          "fixed lg:sticky top-[64px] left-0 z-40 h-[calc(100vh-64px)] w-64 bg-card border-r border-border flex-shrink-0 transition-transform duration-300 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}>
          <nav className="h-full overflow-y-auto p-4">
            <div className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as ActiveTab);
                      setSidebarOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold">
              {tabs.find(t => t.id === activeTab)?.label || "Admin Dashboard"}
            </h1>
          </div>

          <ErrorBoundary name={activeTab || "dashboard"}>
            {renderContent()}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
