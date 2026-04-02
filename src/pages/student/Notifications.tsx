import { Navbar } from "@/components/Navbar";
import { StudentNotifications } from "@/components/student/StudentNotifications";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const StudentNotificationsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-4">
          <Button variant="ghost" onClick={() => navigate("/")} className="w-fit">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
          <StudentNotifications fullView />
        </div>
      </main>
    </div>
  );
};

export default StudentNotificationsPage;
