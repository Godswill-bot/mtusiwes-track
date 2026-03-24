import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import chatImage from "@/assets/chatttttt.webp";
import mtuLogo from "@/assets/mtu-logo.png";

export default function ChatInfo() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col font-sans">
      {/* Decorative Vector-like Background Elements mimicking the proto */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none stroke-primary/20 fill-none">
        {/* Clouds */}
        <svg className="absolute top-[10%] left-[45%] w-32 h-16 opacity-40" viewBox="0 0 24 24">
          <path d="M6 16C3.79086 16 2 14.2091 2 12C2 9.79086 3.79086 8 6 8C6.34586 8 6.68114 8.04383 7 8.125C7.57503 6.32675 9.14187 5 11 5C13.4853 5 15.5 7.01472 15.5 9.5C15.5 9.58988 15.4975 9.67914 15.4925 9.7677C16.892 9.94071 18 11.1306 18 12.6C18 14.1464 16.7464 15.4 15.2 15.4H6Z" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <svg className="absolute top-[15%] right-[15%] w-24 h-12 opacity-40" viewBox="0 0 24 24">
          <path d="M6 16C3.79086 16 2 14.2091 2 12C2 9.79086 3.79086 8 6 8C6.34586 8 6.68114 8.04383 7 8.125C7.57503 6.32675 9.14187 5 11 5C13.4853 5 15.5 7.01472 15.5 9.5C15.5 9.58988 15.4975 9.67914 15.4925 9.7677C16.892 9.94071 18 11.1306 18 12.6C18 14.1464 16.7464 15.4 15.2 15.4H6Z" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {/* Sun */}
        <svg className="absolute top-[18%] left-[30%] w-16 h-16 opacity-60 text-yellow-500 stroke-yellow-500" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="4" strokeWidth="1"/>
          <path d="M12 4V2M12 22V20M4 12H2M22 12H20M6.34315 6.34315L4.92893 4.92893M17.6569 17.6569L19.0711 19.0711M6.34315 17.6569L4.92893 19.0711M17.6569 6.34315L19.0711 4.92893" strokeWidth="1" strokeLinecap="round"/>
        </svg>
        {/* Squiggles & Circles */}
        <div className="absolute top-[40%] left-[24%] w-6 h-6 rounded-full border-2 border-yellow-400 opacity-50"></div>
        <div className="absolute bottom-[25%] left-[35%] w-4 h-4 rounded-full border-2 border-primary opacity-50"></div>
        <div className="absolute bottom-[18%] right-[32%] w-5 h-5 rounded-full border-2 border-rose-400 opacity-50"></div>
      </div>

      {/* Header aligned with the proto feel */}
      <header className="w-full px-6 py-6 flex justify-between items-center z-10 bg-transparent">
        <div 
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => navigate("/")}
        >
          <Button variant="ghost" size="icon" className="rounded-full text-foreground hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <img src={mtuLogo} alt="MTU Logo" className="h-10 transition-transform group-hover:scale-105" />
        </div>
        
        <nav className="hidden lg:flex gap-10 text-sm font-medium text-foreground/80">
          <span className="cursor-pointer hover:text-primary transition-colors">About</span>
          <span className="cursor-pointer hover:text-primary transition-colors">Where to Login</span>
          <span className="cursor-pointer hover:text-primary transition-colors">Features</span>
          <span className="cursor-pointer hover:text-primary transition-colors">Process</span>
          <span className="cursor-pointer hover:text-primary transition-colors">Contacts</span>
        </nav>

        <Button 
          onClick={() => navigate("/student/login")} 
          className="rounded-full px-8 py-5 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-transform hover:scale-105"
        >
          Portal
        </Button>
      </header>

      {/* Main Hero Content */}
      <main className="flex-1 max-w-[1400px] mx-auto w-full flex flex-col lg:flex-row items-center px-6 lg:px-16 py-8 gap-12 z-10">
        
        {/* Left Text Box */}
        <div className="flex-1 flex flex-col space-y-8 max-w-xl xl:mr-12 animate-fade-in-up">
          <h1 className="text-7xl lg:text-[140px] font-black text-foreground tracking-tighter leading-none" style={{ fontFamily: 'Georgia, serif' }}>
            Chat
          </h1>
          
          <p className="text-lg text-foreground/70 leading-relaxed max-w-md font-medium">
            Secure and direct SIWES communication system between MTU students and their assigned school supervisors. Share logbooks, request reviews, and collaborate in real-time.
          </p>
          
          <div className="pt-2">
             <span className="inline-block font-semibold text-foreground/90 text-sm uppercase tracking-[0.2em] border-b-[3px] border-primary pb-2">
               MTU SIWES Series
             </span>
          </div>
        </div>

        {/* Right Image Box (Replacing original vector with the WEBP) */}
        <div className="flex-[1.2] relative flex justify-center items-center w-full animate-fade-in">
          <div className="relative w-full max-w-3xl">
             {/* Decorative Background under image */}
             <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-purple-500/10 rounded-[4rem] transform rotate-3 scale-105 -z-10 blur-xl"></div>
             
             {/* Actual Image inserted */}
             <img 
               src={chatImage} 
               alt="Chat Communication System" 
               className="w-full h-auto object-contain drop-shadow-2xl relative z-10 transition-transform duration-700 hover:-translate-y-2 hover:scale-[1.01]"
             />
          </div>
        </div>
      </main>

      {/* Bottom Read More / Scroll indicator */}
      <div className="w-full pb-8 flex flex-col items-center justify-end flex-grow text-foreground/60 z-10">
        <span className="text-sm font-semibold mb-3 tracking-wide">Read more</span>
        <div className="w-10 h-10 rounded-full border-2 border-foreground/30 flex items-center justify-center animate-bounce shadow-sm bg-background/50 backdrop-blur-sm cursor-pointer hover:border-primary hover:text-primary transition-colors">
          <ArrowDown className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
