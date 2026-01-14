import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import mtuLogo from "@/assets/mtu-logo.png";
import siwesStudents from "@/assets/siwes-students.webp";
import itfBuilding from "@/assets/itf-building.png";
import studentLogbook from "@/assets/student-logbook.jpg";
import { ArrowRight, Info } from "lucide-react";

// Slideshow images array
const slideshowImages = [siwesStudents, itfBuilding, studentLogbook];

// Preload images for faster slideshow
const preloadImages = () => {
  slideshowImages.forEach((src) => {
    const img = new Image();
    img.src = src;
  });
};

const Index = () => {
  const { user, userRole, loading, isInitialized } = useAuth();
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [imagesLoaded, setImagesLoaded] = useState(false);

  // Preload slideshow images on mount
  useEffect(() => {
    preloadImages();
    setImagesLoaded(true);
  }, []);

  // Slideshow auto-advancement
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slideshowImages.length);
    }, 5000); // Change slide every 5 seconds

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Only redirect after auth is fully initialized AND we have confirmed user + role
    if (!isInitialized) return;
    
    if (user && userRole) {
      // Redirect based on role
      switch (userRole) {
        case "student":
          navigate("/student/dashboard");
          break;
        // Industry supervisors are not system users - data only
        // case "industry_supervisor": removed
        case "school_supervisor":
          navigate("/supervisor/dashboard");
          break;
        case "admin":
          navigate("/admin/dashboard");
          break;
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

  // If logged in, don't show homepage (redirect handled above)
  if (user && userRole) {
    return null;
  }

  // Beautiful homepage for non-logged-in users
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Slideshow Background */}
      <div className="absolute inset-0">
        {slideshowImages.map((image, index) => (
          <div
            key={index}
            className={`absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000 ease-in-out ${
              index === currentSlide ? "opacity-100 slide-zoom" : "opacity-0"
            }`}
            style={{ 
              backgroundImage: `url(${image})`,
              animationPlayState: index === currentSlide ? 'running' : 'paused'
            }}
          />
        ))}
      </div>
      
      {/* Gradient Overlay for readability - Purple and Green blend */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-purple-900/60 to-primary/50" />
      
      {/* Slideshow Indicators - positioned above footer */}
      <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-20 flex gap-3">
        {slideshowImages.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
              index === currentSlide
                ? "bg-white scale-125 shadow-lg"
                : "bg-white/40 hover:bg-white/70"
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
      
      {/* Subtle green accent stripe at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-success to-transparent opacity-60" />
      
      {/* Hero Section */}
      <section className="flex-1 flex items-center justify-center px-4 py-16 md:py-24 relative z-10">
        <div className="max-w-4xl mx-auto text-center space-y-8 animate-fade-in">
          {/* Logo with animation and green accent ring */}
          <div className="flex justify-center mb-8 animate-scale-in">
            <div className="relative">
              <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-primary via-success to-primary opacity-20 blur-sm"></div>
              <div className="bg-white rounded-full p-3 shadow-lg">
                <img
                  src={mtuLogo}
                  alt="Mountain Top University Logo"
                  className="h-24 md:h-32 w-auto relative"
                  loading="eager"
                  decoding="async"
                />
              </div>
            </div>
          </div>

          {/* Main Title with green underline accent */}
          <div className="relative inline-block">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white drop-shadow-lg animate-fade-in-up">
              Welcome to the MTU SIWES Platform
            </h1>
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-24 h-1 bg-gradient-to-r from-success via-success-light to-success rounded-full"></div>
          </div>

          {/* Subtitle */}
          <p className="text-lg md:text-xl lg:text-2xl text-white/90 max-w-3xl mx-auto animate-fade-in-up animation-delay-200 pt-4 drop-shadow-md">
            Official Students Industrial Work Experience Scheme Portal for Mountain Top University.
          </p>

          {/* Introduction Paragraph */}
          <div className="max-w-3xl mx-auto pt-8 animate-fade-in-up animation-delay-400">
            <p className="text-base md:text-lg text-white/85 leading-relaxed drop-shadow-md">
              The MTU SIWES Platform is designed to help students document, manage, and track their industrial training activities with ease. This platform ensures proper supervision, weekly submissions, industry evaluations, and seamless communication between students, industry supervisors, and school supervisors.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8 animate-fade-in-up animation-delay-600">
            <Button
              onClick={() => navigate("/student/signup")}
              size="lg"
              className="w-full sm:w-auto px-8 py-6 text-lg font-semibold rounded-full bg-success/85 hover:bg-success text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 hover:glow-green backdrop-blur-sm"
            >
              Get Started
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>

            <Button
              onClick={() => navigate("/siwes-info")}
              size="lg"
              variant="outline"
              className="w-full sm:w-auto px-8 py-6 text-lg font-semibold rounded-full border-2 border-primary/70 text-primary bg-white/60 hover:bg-primary/90 hover:text-white shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 backdrop-blur-sm"
            >
              <Info className="mr-2 h-5 w-5" />
              Learn More
            </Button>
          </div>

          {/* Login Links Section */}
          <div className="max-w-3xl mx-auto pt-12 animate-fade-in-up animation-delay-800">
            <div className="border-t border-white/30 pt-8">
              <p className="text-sm text-white/80 mb-4 text-center">
                Already have an account? Sign in here:
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                <Button
                  onClick={() => navigate("/student/login")}
                  variant="outline"
                  className="w-full sm:w-auto border-success text-white bg-success/30 hover:bg-success hover:text-white hover:border-success backdrop-blur-sm"
                >
                  Student Login
                </Button>
                <Button
                  onClick={() => navigate("/school-supervisor/login")}
                  variant="outline"
                  className="w-full sm:w-auto bg-white/20 text-white border-white/50 backdrop-blur-sm hover:bg-primary hover:text-white hover:border-primary"
                >
                  Supervisor Login
                </Button>
                <Button
                  onClick={() => navigate("/admin/login")}
                  variant="outline"
                  className="w-full sm:w-auto bg-white/20 text-white border-white/50 backdrop-blur-sm hover:bg-primary hover:text-white hover:border-primary"
                >
                  Admin Login
                </Button>
              </div>
              <p className="text-xs text-white/70 mt-4 text-center">
                New supervisor?{" "}
                <button
                  onClick={() => navigate("/school-supervisor/signup")}
                  className="text-success hover:underline font-medium"
                >
                  Sign up here
                </button>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-4 text-center text-sm text-white/80 border-t border-white/20 relative z-30 bg-black/50 backdrop-blur-sm">
        <p>© {new Date().getFullYear()} Mountain Top University. All rights reserved.</p>
      </footer>

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.8s ease-out;
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.8s ease-out forwards;
          opacity: 0;
        }

        .animate-scale-in {
          animation: scale-in 0.6s ease-out;
        }

        .animation-delay-200 {
          animation-delay: 0.2s;
        }

        .animation-delay-400 {
          animation-delay: 0.4s;
        }

        .animation-delay-600 {
          animation-delay: 0.6s;
        }

        .hover\\:glow-primary:hover {
          box-shadow: 0 0 20px rgba(128, 0, 128, 0.4);
        }
        
        .hover\\:glow-green:hover {
          box-shadow: 0 0 20px rgba(30, 100, 60, 0.5);
        }

        /* Slideshow zoom animation */
        @keyframes slideZoom {
          0% {
            transform: scale(1);
          }
          100% {
            transform: scale(1.1);
          }
        }

        .slide-zoom {
          animation: slideZoom 6s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default Index;
