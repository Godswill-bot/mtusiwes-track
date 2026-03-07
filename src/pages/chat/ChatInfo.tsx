import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Info, MessageCircle, UserCheck, Shield, FileText, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import mtuLogo from "@/assets/mtu-logo.png";

function ChatInfo() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-purple-100 to-white flex flex-col items-center justify-center py-8 px-4">
      <div className="w-full max-w-xl mb-4 flex items-center">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}
          className="rounded-full mr-2 text-primary hover:bg-primary/10">
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <span className="text-primary font-semibold">Back to Home</span>
      </div>
      <Card className="max-w-xl w-full shadow-xl border-2 border-primary/30">
        <CardHeader className="flex flex-col items-center gap-2">
          <img src={mtuLogo} alt="MTU Logo" className="h-12 mb-2" />
          <CardTitle className="text-3xl font-bold text-primary">Chat System</CardTitle>
          <p className="text-muted-foreground text-center text-lg">Secure SIWES communication between students and their assigned supervisors</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col items-center text-center p-4 rounded-lg bg-primary/5">
              <Info className="h-8 w-8 text-primary mb-2" />
              <span className="font-semibold">What is this chat for?</span>
              <span className="text-sm text-muted-foreground">Direct SIWES communication between student & assigned supervisor</span>
            </div>
            <div className="flex flex-col items-center text-center p-4 rounded-lg bg-primary/5">
              <UserCheck className="h-8 w-8 text-primary mb-2" />
              <span className="font-semibold">Who can use it?</span>
              <span className="text-sm text-muted-foreground">Only registered Mountain Top University SIWES students & supervisors</span>
            </div>
            <div className="flex flex-col items-center text-center p-4 rounded-lg bg-primary/5">
              <Shield className="h-8 w-8 text-primary mb-2" />
              <span className="font-semibold">Where does it work?</span>
              <span className="text-sm text-muted-foreground">Inside this system after login</span>
            </div>
            <div className="flex flex-col items-center text-center p-4 rounded-lg bg-primary/5">
              <MessageCircle className="h-8 w-8 text-primary mb-2" />
              <span className="font-semibold">Core functions</span>
              <span className="text-sm text-muted-foreground">Send/receive messages, share files, view history, real-time updates</span>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2 mt-4">
            <FileText className="h-7 w-7 text-primary mb-1" />
            <span className="font-semibold">Privacy & Limits</span>
            <span className="text-sm text-muted-foreground text-center">Only between the student and their assigned supervisor. No group chat.</span>
          </div>
          <div className="mt-8">
            <CardTitle className="text-xl mb-2 text-primary">How it works</CardTitle>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Login to your SIWES account</li>
              <li>Open the Chat section</li>
              <li>Message your supervisor</li>
              <li>Get replies instantly</li>
            </ol>
          </div>
          <div className="flex flex-col items-center mt-8">
            <Button size="lg" className="w-full text-lg font-bold" onClick={() => navigate("/student/login")}>Wanna get started?</Button>
            <span className="text-sm mt-2 text-muted-foreground">Don't have an account? <Button variant="link" className="p-0 h-auto" onClick={() => navigate("/student/signup")}>Sign up here</Button></span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ChatInfo;
