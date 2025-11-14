import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import StudentDashboard from "./pages/student/Dashboard";
import PreSiwes from "./pages/student/PreSiwes";
import Logbook from "./pages/student/Logbook";
import SupervisorDashboard from "./pages/supervisor/Dashboard";
import WeeklyReportView from "./pages/supervisor/WeeklyReportView";
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
            <Route path="/auth" element={<Auth />} />
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
              path="/supervisor/week/:weekId" 
              element={
                <ProtectedRoute allowedRoles={["industry_supervisor", "school_supervisor"]}>
                  <WeeklyReportView />
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
