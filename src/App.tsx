import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Index from "./pages/Index";
// Legacy auth routes (kept for backward compatibility)
import StudentAuth from "./pages/auth/StudentAuth";
import SupervisorAuth from "./pages/auth/SupervisorAuth";
import AdminAuth from "./pages/auth/AdminAuth";
// New auth routes
import StudentLogin from "./pages/student/Login";
import StudentSignup from "./pages/student/Signup";
import SchoolSupervisorLogin from "./pages/school-supervisor/Login";
import SchoolSupervisorSignup from "./pages/school-supervisor/Signup";
import AdminLogin from "./pages/admin/Login";
import StudentDashboard from "./pages/student/Dashboard";
import PreSiwes from "./pages/student/PreSiwes";
import PreSiwesEdit from "./pages/student/PreSiwesEdit";
import ProfileEdit from "./pages/student/ProfileEdit";
import Logbook from "./pages/student/Logbook";
import StudentAttendance from "./pages/student/Attendance";
import SupervisorDashboard from "./pages/supervisor/Dashboard";
import SchoolSupervisorDashboard from "./pages/supervisor/SchoolSupervisorDashboard";
import WeeklyReportView from "./pages/supervisor/WeeklyReportView";
import StudentsList from "./pages/supervisor/StudentsList";
import PendingRegistrations from "./pages/supervisor/PendingRegistrations";
import AdminDashboard from "./pages/admin/Dashboard";
import SiwesInfo from "./pages/SiwesInfo";
import EmailVerification from "./pages/EmailVerification";
import EmailVerificationOTP from "./pages/student/EmailVerificationOTP";
import SupervisorEmailVerificationOTP from "./pages/school-supervisor/EmailVerificationOTP";
import SiwesLetter from "./pages/student/SiwesLetter";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import { Component, ErrorInfo, ReactNode } from "react";

// Error Boundary to catch React errors
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("React Error Boundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "20px", backgroundColor: "#fee", color: "#c00", fontFamily: "sans-serif" }}>
          <h1>Something went wrong</h1>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {this.state.error?.message}
          </pre>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: "12px" }}>
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes - data is considered fresh for 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes - unused data is garbage collected after 30 minutes
      retry: 1, // Only retry failed requests once
      refetchOnWindowFocus: false, // Don't refetch when window regains focus
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              {/* New authentication routes */}
              <Route path="/student/login" element={<StudentLogin />} />
              <Route path="/student/signup" element={<StudentSignup />} />
              <Route path="/school-supervisor/login" element={<SchoolSupervisorLogin />} />
              <Route path="/school-supervisor/signup" element={<SchoolSupervisorSignup />} />
              <Route path="/admin/login" element={<AdminLogin />} />
            {/* Legacy auth routes (kept for backward compatibility) */}
            <Route path="/auth/student" element={<StudentAuth />} />
            <Route path="/auth/supervisor" element={<SupervisorAuth />} />
            <Route path="/auth/admin" element={<AdminAuth />} />
            <Route 
              path="/student/dashboard" 
              element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/student/pre-siwes" 
              element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <PreSiwes />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/student/pre-siwes/edit" 
              element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <PreSiwesEdit />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/student/profile/edit" 
              element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <ProfileEdit />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/profile/edit" 
              element={
                <ProtectedRoute>
                  <ProfileEdit />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/student/logbook" 
              element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <Logbook />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/student/attendance" 
              element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentAttendance />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/student/siwes-letter" 
              element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <SiwesLetter />
                </ProtectedRoute>
              } 
            />
            <Route path="/email-verification" element={<EmailVerification />} />
            <Route path="/student/verify-email" element={<EmailVerificationOTP />} />
            <Route path="/school-supervisor/verify-email" element={<SupervisorEmailVerificationOTP />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route 
              path="/supervisor/dashboard" 
              element={
                <ProtectedRoute allowedRoles={["school_supervisor"]}>
                  <SchoolSupervisorDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/supervisor/school/dashboard" 
              element={
                <ProtectedRoute allowedRoles={["school_supervisor"]}>
                  <SchoolSupervisorDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/supervisor/week/:weekId" 
              element={
                <ProtectedRoute allowedRoles={["school_supervisor"]}>
                  <WeeklyReportView />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/supervisor/students" 
              element={
                <ProtectedRoute allowedRoles={["school_supervisor"]}>
                  <StudentsList />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/supervisor/pending-registrations" 
              element={
                <ProtectedRoute allowedRoles={["school_supervisor"]}>
                  <PendingRegistrations />
                </ProtectedRoute>
              } 
            />
            <Route
              path="/admin/dashboard" 
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminDashboard />
                </ProtectedRoute>
              } 
            />
            <Route path="/siwes-info" element={<SiwesInfo />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
