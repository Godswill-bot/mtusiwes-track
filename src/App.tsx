import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Index from "./pages/Index";
import StudentAuth from "./pages/auth/StudentAuth";
import SupervisorAuth from "./pages/auth/SupervisorAuth";
import AdminAuth from "./pages/auth/AdminAuth";
import StudentDashboard from "./pages/student/Dashboard";
import PreSiwes from "./pages/student/PreSiwes";
import PreSiwesEdit from "./pages/student/PreSiwesEdit";
import ProfileEdit from "./pages/student/ProfileEdit";
import Logbook from "./pages/student/Logbook";
import SupervisorDashboard from "./pages/supervisor/Dashboard";
import SchoolSupervisorDashboard from "./pages/supervisor/SchoolSupervisorDashboard";
import WeeklyReportView from "./pages/supervisor/WeeklyReportView";
import StudentsList from "./pages/supervisor/StudentsList";
import PendingRegistrations from "./pages/supervisor/PendingRegistrations";
import AdminDashboard from "./pages/admin/Dashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
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
              path="/supervisor/dashboard" 
              element={
                <ProtectedRoute allowedRoles={["industry_supervisor", "school_supervisor"]}>
                  <SupervisorDashboard />
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
                <ProtectedRoute allowedRoles={["industry_supervisor", "school_supervisor"]}>
                  <WeeklyReportView />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/supervisor/students" 
              element={
                <ProtectedRoute allowedRoles={["industry_supervisor", "school_supervisor"]}>
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
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
