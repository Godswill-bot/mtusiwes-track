import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import mtuLogo from "@/assets/mtu-logo.png";
import siwesStudents from "@/assets/siwes-students.webp";
import itfBuilding from "@/assets/itf-building.png";
import studentLogbook from "@/assets/student-logbook.jpg";
import chatImage from "@/assets/chat pic.png";
import { ArrowRight, LogIn, Users, BookOpen, GraduationCap, Briefcase, Library, Laptop, PenTool, Lightbulb, FileText, Globe } from "lucide-react";
import ScrollFadeIn from "@/components/ScrollFadeIn";
import "@/styles/custom-fixes.css";

const slideshowImages = [siwesStudents, itfBuilding, studentLogbook];

const preloadImages = () => {
  slideshowImages.forEach((src) => {
    const img = new Image();
    img.src = src;
  });
};

const EducationalBackground = () => (
  <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden opacity-[0.25] text-primary">
    {/* Upper Section */}
    <BookOpen className="absolute top-[15%] left-[8%] w-32 h-32 -rotate-12" />
    <GraduationCap className="absolute top-[20%] right-[10%] w-32 h-32 rotate-12" />
    <Briefcase className="absolute top-[40%] left-[15%] w-20 h-20 -rotate-6" />
    <Library className="absolute top-[60%] right-[5%] w-28 h-28 rotate-6" />
    <Laptop className="absolute top-[80%] left-[10%] w-24 h-24 -rotate-12" />
    <PenTool className="absolute top-[30%] right-[25%] w-16 h-16 rotate-45" />
    <Lightbulb className="absolute top-[75%] right-[20%] w-20 h-20 -rotate-12" />
    <FileText className="absolute top-[50%] left-[30%] w-16 h-16 rotate-12" />
    <Globe className="absolute top-[15%] left-[40%] w-20 h-20 -rotate-12" />
  </div>
);

export default function Index() {
  const { user, userRole, loading, isInitialized } = useAuth();
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const learnMoreRef = useRef<HTMLElement>(null);
  const chatSystemRef = useRef<HTMLElement>(null);

  const scrollToRef = (ref: React.RefObject<HTMLElement>) => {
    ref.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    preloadImages();
    setImagesLoaded(true);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slideshowImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    if (user && userRole) {
      switch (userRole) {
        case "student": navigate("/student/dashboard"); break;
        case "school_supervisor": navigate("/supervisor/dashboard"); break;
        case "admin": navigate("/admin/dashboard"); break;
      }
    }
  }, [user, userRole, isInitialized, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading MTU SIWES Portal...</p>
        </div>
      </div>
    );
  }

  if (user && userRole) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-gray-600 text-lg font-semibold">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col font-sans overflow-x-hidden bg-white text-slate-900 relative">
      {/* Navigation Bar */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 py-4 px-6 md:px-12 flex justify-between items-center ${isScrolled ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100' : 'bg-transparent'}`}>
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <img src={mtuLogo} alt="MTU Logo" className="h-10 w-auto" />
          <span className={`font-bold text-lg md:text-xl tracking-tight hidden md:block transition-colors duration-300 ${isScrolled ? 'text-primary' : 'text-white drop-shadow-md'}`}>MTU SIWES</span>
        </div>
        <div className={`flex items-center gap-6 md:gap-10 text-sm font-semibold transition-colors duration-300 ${isScrolled ? 'text-gray-600' : 'text-white/90 drop-shadow-md'}`}>
          <span className={`cursor-pointer transition-colors ${isScrolled ? 'hover:text-primary' : 'hover:text-white'}`} onClick={() => scrollToRef(learnMoreRef)}>Learn More</span>
          <span className={`cursor-pointer transition-colors ${isScrolled ? 'hover:text-primary' : 'hover:text-white'}`} onClick={() => scrollToRef(chatSystemRef)}>Chat System</span>
          <Button onClick={() => navigate("/student/login")} variant="default" className="bg-primary hover:bg-primary/90 text-white rounded-full px-6 shadow-lg border border-transparent">
            Sign In
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative w-full h-[100vh] min-h-[600px] flex items-center justify-center overflow-hidden bg-black">
        {/* Slideshow Background */}
        <div className="absolute inset-0 z-0">
          {slideshowImages.map((image, index) => (
            <img
              key={index}
              src={image}
              alt={"Slideshow"}
              className={`object-cover w-full h-full absolute inset-0 origin-center hero-slideshow-img ${index === currentSlide ? "hero-slideshow-img--active" : "hero-slideshow-img--inactive"}`}
            />
          ))}
        </div>
        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/60 to-primary/60 z-0" />

          <div className="relative z-10 max-w-5xl mx-auto px-6 text-center space-y-8 animate-fade-in-up">
            <img src={mtuLogo} alt="MTU Logo" className="w-32 md:w-48 h-auto mx-auto drop-shadow-2xl mb-6" />
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white drop-shadow-lg tracking-tight">
            Welcome to the MTU SIWES Platform
          </h1>
          <h2 className="text-lg md:text-2xl text-white/90 max-w-3xl mx-auto font-light drop-shadow">
            Official Students Industrial Work Experience Scheme Portal for Mountain Top University.
          </h2>
          
          <div className="pt-6 flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              onClick={() => navigate("/student/signup")}
              size="lg"
              className="w-full sm:w-auto px-8 py-6 text-lg font-semibold rounded-full bg-success text-white hover:bg-success/90 hover:scale-105 transition-all shadow-lg border-2 border-transparent"
            >
              Student Portal Signup
            </Button>
            <Button
              onClick={() => navigate("/school-supervisor/signup")}
              size="lg"
              className="w-full sm:w-auto px-8 py-6 text-lg font-semibold rounded-full bg-white/10 backdrop-blur-md text-white border-2 border-white/50 hover:bg-white hover:text-primary hover:scale-105 transition-all shadow-lg"
            >
              <Users className="mr-2 h-5 w-5" /> Supervisor Connect
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Section (with Background Logo & Icons) */}
      <div className="relative w-full bg-slate-50 py-24 pb-32">
        <EducationalBackground />
        
        {/* Huge Background Logo */}
        <div className="absolute inset-0 z-0 opacity-40 pointer-events-none flex items-center justify-center overflow-hidden">
            <img src={mtuLogo} alt="Background MTU Logo" className="w-[400px] md:w-[700px] max-w-none h-auto object-contain" />
        </div>
        <div className="relative z-10 max-w-[90rem] mx-auto px-4 md:px-8 flex flex-col gap-16">
          {/* Learn More Card */}
          <ScrollFadeIn y={60} duration={1.2}>
            <div className="relative bg-white/40 backdrop-blur-2xl border border-white/50 shadow-2xl rounded-3xl overflow-hidden hover:shadow-3xl transition-shadow duration-700">
              <section ref={learnMoreRef} className="p-8 md:p-16 flex flex-col md:flex-row items-center gap-12 lg:gap-20">
                <div className="flex-1 space-y-6">
                  <h2 className="text-3xl md:text-4xl font-bold text-gray-900 border-b-4 border-success pb-4 inline-block">Learn More: The Portal</h2>
                  <p className="text-lg text-gray-600 leading-relaxed font-light">
                    The MTU SIWES Platform is engineered precisely to aid students in managing and tracking their industrial training routines. The portal ensures strict academic compliance, allows direct supervisor assignments, handles weekly log submissions effortlessly, and fosters quick industry evaluations. 
                  </p>
                  <div className="pt-4">
                    <Button variant="outline" onClick={() => navigate("/siwes-info")} className="text-primary border-primary bg-white hover:bg-primary hover:text-white rounded-full px-6 transition-all">
                      <BookOpen className="mr-2 h-4 w-4" /> Full Documentation
                    </Button>
                  </div>
                </div>
                <div className="flex-1 w-full max-w-md">
                  <img src={itfBuilding} alt="ITF Building" className="w-full h-auto rounded-xl shadow-2xl hover:scale-[1.02] transition-transform duration-500 object-cover" />
                </div>
              </section>
            </div>
          </ScrollFadeIn>

          {/* Chat System Card */}
          <ScrollFadeIn y={60} duration={1.2} delay={0.15}>
            <div className="relative bg-white/40 backdrop-blur-2xl border border-white/50 shadow-2xl rounded-3xl overflow-hidden hover:shadow-3xl transition-shadow duration-700">
              <section ref={chatSystemRef} className="p-8 md:p-16 flex flex-col md:flex-row-reverse items-center gap-12 lg:gap-20">
                <div className="flex-1 space-y-6">
                  <h2 className="text-3xl md:text-4xl font-bold text-gray-900 border-b-4 border-primary pb-4 inline-block">Direct Chat System</h2>
                  <p className="text-lg text-gray-600 leading-relaxed font-light">
                    Need to ask your supervisor a question about your work log? Want to clarify a constraint quickly? The integrated SIWES Chat System bypasses the hassle of emails seamlessly. It connects you strictly with your verified school supervisor for instant feedback, logbook discussion, and file sharing in a secured institutional environment.
                  </p>
                  <div className="pt-4">
                     <Button onClick={() => navigate("/chat/info")} className="bg-primary hover:bg-primary/90 text-white rounded-full px-6 shadow-md transition-all group">
                        Enter Chat System <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                     </Button>
                  </div>
                </div>
                <div className="flex-1 w-full max-w-md relative p-4 md:p-8">
                   <img src={chatImage} alt="Chat Communication" className="w-full h-auto drop-shadow-2xl hover:-translate-y-2 transition-transform duration-500 mix-blend-multiply" />
                </div>
              </section>
            </div>
          </ScrollFadeIn>
        </div>
      </div>

      {/* Bottom Footer Call to action */}
      <footer className="w-full bg-[url('@/assets/student-logbook.jpg')] bg-cover bg-center relative -mt-[1px]">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/95 to-primary/80 z-0"></div>
        <div className="relative z-10 w-full max-w-6xl mx-auto px-6 py-20 flex flex-col md:flex-row items-center justify-between text-white gap-8 text-center md:text-left">
           <h3 className="text-3xl md:text-4xl font-bold leading-tight">Connect and Start<br/>Logging</h3>
           <div className="flex flex-col sm:flex-row gap-4">
                <Button onClick={() => navigate("/student/login")} size="lg" className="bg-success/70 backdrop-blur-md text-white border-2 border-transparent hover:border-success/50 hover:bg-success rounded-full font-bold px-8 shadow-2xl transition-all">
                 <LogIn className="mr-2 h-5 w-5" /> Student Log in
              </Button>
              <Button onClick={() => navigate("/school-supervisor/login")} size="lg" className="bg-black/50 backdrop-blur-md text-white border-2 border-transparent hover:border-white/20 hover:bg-black/70 rounded-full font-bold px-8 shadow-2xl transition-all">
                 <Users className="mr-2 h-5 w-5" /> Supervisor Log in
              </Button>
           </div>
        </div>
        <div className="relative z-10 bg-black/50 text-white/60 text-xs py-4 text-center">
           Copyright © Mountain Top University SIWES Track 2026. All Rights Reserved.
        </div>
      </footer>
      <ScrollFadeIn y={40} duration={0.7} delay={0.3}>
        <div />
      </ScrollFadeIn>
    </div>
  );
}
