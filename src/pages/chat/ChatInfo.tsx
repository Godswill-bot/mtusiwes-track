import React, { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowDown, Users, Shield, Zap, ArrowRight, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import chatImage from "@/assets/chat pic.png";
import mtuLogo from "@/assets/mtu-logo.png";

export default function ChatInfo() {
  const navigate = useNavigate();
  const featuresRef = useRef<HTMLDivElement>(null);
  const loginRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const scrollToRef = (ref: React.RefObject<HTMLDivElement>) => {
    if (ref.current) {
        window.scrollTo({
            top: ref.current.offsetTop,
            behavior: "smooth"
        });
    }
  };

  return (
    <div className="min-h-screen bg-white relative overflow-x-hidden flex flex-col font-sans text-slate-900">
      {/* Background SVGs */}
      <div className="absolute top-0 left-0 w-full h-screen overflow-hidden pointer-events-none stroke-primary/20 fill-none z-0">
        <svg className="absolute top-[10%] left-[45%] w-32 h-16 opacity-40" viewBox="0 0 24 24">
          <path d="M6 16C3.79086 16 2 14.2091 2 12C2 9.79086 3.79086 8 6 8C6.34586 8 6.68114 8.04383 7 8.125C7.57503 6.32675 9.14187 5 11 5C13.4853 5 15.5 7.01472 15.5 9.5C15.5 9.58988 15.4975 9.67914 15.4925 9.7677C16.892 9.94071 18 11.1306 18 12.6C18 14.1464 16.7464 15.4 15.2 15.4H6Z" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <svg className="absolute top-[15%] right-[15%] w-24 h-12 opacity-40" viewBox="0 0 24 24">
          <path d="M6 16C3.79086 16 2 14.2091 2 12C2 9.79086 3.79086 8 6 8C6.34586 8 6.68114 8.04383 7 8.125C7.57503 6.32675 9.14187 5 11 5C13.4853 5 15.5 7.01472 15.5 9.5C15.5 9.58988 15.4975 9.67914 15.4925 9.7677C16.892 9.94071 18 11.1306 18 12.6C18 14.1464 16.7464 15.4 15.2 15.4H6Z" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <svg className="absolute top-[18%] left-[30%] w-16 h-16 opacity-60 text-yellow-500 stroke-yellow-500" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="4" strokeWidth="1"/>
          <path d="M12 4V2M12 22V20M4 12H2M22 12H20M6.34315 6.34315L4.92893 4.92893M17.6569 17.6569L19.0711 19.0711M6.34315 17.6569L4.92893 19.0711M17.6569 6.34315L19.0711 4.92893" strokeWidth="1" strokeLinecap="round"/>
        </svg>
        <div className="absolute top-[40%] left-[24%] w-6 h-6 rounded-full border-2 border-yellow-400 opacity-50"></div>
        <div className="absolute bottom-[25%] left-[35%] w-4 h-4 rounded-full border-2 border-primary opacity-50"></div>
        <div className="absolute bottom-[18%] right-[32%] w-5 h-5 rounded-full border-2 border-rose-400 opacity-50"></div>
      </div>

      <div className="min-h-screen flex flex-col relative z-10">
        <header className="w-full px-6 py-6 flex justify-between items-center bg-transparent relative">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate("/")}>
            <Button variant="ghost" size="icon" className="rounded-full text-slate-800 hover:bg-slate-100">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none">
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-[#4B0082]">
              MTU CHAT SYSTEM
            </h1>
          </div>
          <div className="w-10 h-10"></div> {/* Spacer to balance header flexbox */}
        </header>
            <img src={mtuLogo} alt="MTU Logo" className="h-10 transition-transform group-hover:scale-105" />
          </div>

          <Button onClick={() => scrollToRef(loginRef)} className="rounded-full px-8 py-5 font-semibold bg-primary hover:bg-primary/90 text-white shadow-md transition-transform hover:scale-105">
            Get Started
          </Button>
        </header>

        <main className="flex-1 max-w-[1500px] mx-auto w-full flex flex-col lg:flex-row items-center px-6 lg:px-12 py-4 gap-4 xl:gap-12">
          <div className="flex-1 flex flex-col space-y-8 max-w-xl animate-fade-in-up mt-8 lg:mt-0">
            <h1 className="text-[80px] lg:text-[160px] font-black text-slate-900 tracking-tighter leading-none whitespace-nowrap" style={{ fontFamily: 'Georgia, serif' }}>
              Chat
            </h1>
            <p className="text-xl text-slate-600 leading-relaxed max-w-md font-medium">
              Secure and direct SIWES communication system between MTU students and their assigned school supervisors. Share logbooks, request reviews, and collaborate in real-time.
            </p>
            <div className="pt-4">
               <span className="inline-block font-bold text-slate-800 text-sm uppercase tracking-[0.2em] border-b-[3px] border-primary pb-2">
                 MTU SIWES Series
               </span>
            </div>
          </div>

          <div className="flex-[1.4] w-full flex justify-center items-center relative animate-fade-in lg:translate-x-4">
            <div className="relative w-full max-w-3xl scale-95 lg:scale-100 xl:scale-110 origin-center -z-10 mt-12 lg:mt-0">
                 <div className="absolute inset-0 bg-gradient-to-br from-primary/10 w-full h-[120%] -top-[10%] to-purple-500/10 rounded-[6rem] transform rotate-3 scale-110 -z-20 blur-2xl"></div>
                 <img 
                   src={chatImage} 
                   alt="Chat Communication System" 
                   className="w-full h-auto object-contain drop-shadow-2xl relative z-10 transition-transform duration-700 hover:-translate-y-2 hover:scale-[1.02]"
                   style={{ mixBlendMode: 'multiply' }}
                 />
            </div>
          </div>
        </main>

        <div className="w-full pb-10 pt-4 flex flex-col items-center justify-end flex-grow text-slate-500 z-10">
          <span className="text-sm font-semibold mb-3 tracking-wide">Read more</span>
          <div onClick={() => scrollToRef(featuresRef)} className="w-12 h-12 rounded-full border-2 border-slate-300 flex items-center justify-center animate-bounce shadow-sm bg-white/50 backdrop-blur-sm cursor-pointer hover:border-primary hover:text-primary transition-all hover:scale-110">
            <ArrowDown className="h-6 w-6 text-slate-700" />
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div ref={featuresRef} className="min-h-[80vh] w-full bg-slate-50 relative z-10 flex flex-col items-center justify-center px-6 py-20">
        <div className="max-w-6xl mx-auto w-full">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900">Seamless Collaboration</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">Experience real-time interaction designed specifically to enhance the industrial training evaluation process.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-3xl shadow-lg border border-slate-100 hover:shadow-xl transition-shadow duration-300 group">
              <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Zap className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900">Instant Feedback</h3>
              <p className="text-slate-600 leading-relaxed">Supervisors can add remarks to daily records directly. Get notified the moment your logbook is reviewed without waiting.</p>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-lg border border-slate-100 hover:shadow-xl transition-shadow duration-300 group mt-4 md:mt-0">
              <div className="w-14 h-14 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Shield className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900">Secure & Verified</h3>
              <p className="text-slate-600 leading-relaxed">All chat sessions are tied to verified matriculation numbers and staff IDs. Your data remains strictly within MTU's controlled environment.</p>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-lg border border-slate-100 hover:shadow-xl transition-shadow duration-300 group mt-4 md:mt-0">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Users className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900">Media Support</h3>
              <p className="text-slate-600 leading-relaxed">Need to show a diagram of your work? Snap, upload, and send images seamlessly to clarify constraints faced at your firm.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Login & Signup Section */}
      <div ref={loginRef} className="min-h-[60vh] w-full bg-white relative z-10 flex flex-col items-center justify-center px-6 py-20 border-t border-slate-100">
         <div className="max-w-4xl mx-auto w-full text-center space-y-8">
            <div className="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
               <UserPlus className="w-10 h-10" />
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900">Get Started with Your Account</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
              To use the chat system, you need to sign up and own an account either as a student or a school supervisor. Create your profile to securely access your dedicated SIWES portals and communication channels.
            </p>
            <div className="pt-8">
               <Button onClick={() => navigate("/signup")} size="lg" className="rounded-full px-8 py-7 text-lg font-semibold bg-primary hover:bg-primary/90 text-white shadow-xl transition-all hover:scale-105 hover:shadow-primary/25 group">
                  Let's get started
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
               </Button>
            </div>
         </div>
      </div>
    </div>
  );
}
