import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Home } from "lucide-react";
import mtuLogo from "@/assets/mtu-logo.png";
import { FadeIn } from "@/components/animations/MotionWrappers";

const PortalClosed = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-light flex items-center justify-center p-4">
      <FadeIn duration={0.5}>
        <Card className="w-full max-w-md shadow-elevated">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <img src={mtuLogo} alt="MTU Logo" className="h-20 w-20" />
            </div>
            <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
              <Lock className="h-6 w-6" />
              SIWES Portal Closed
            </CardTitle>
            <CardDescription className="text-base">
              The SIWES Portal is currently closed. Please contact the administrator for assistance.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={() => navigate("/")} className="w-full" size="lg">
              <Home className="h-4 w-4 mr-2" />
              Return to Home
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              The portal may be temporarily unavailable for maintenance or updates.
            </p>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
};

export default PortalClosed;
















