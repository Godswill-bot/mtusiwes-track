import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import mtuLogo from "@/assets/mtu-logo.png";
import itfLogo from "@/assets/itf-logo.png";
import mountainBg from "@/assets/mountaintop.jpg";
import { ArrowLeft, ArrowRight, Target, Users, BookOpen, Award, FileText, Calendar, CheckSquare } from "lucide-react";

const SiwesInfo = () => {
  const navigate = useNavigate();

  const aims = [
    {
      icon: Target,
      title: "Expose Students to Real Work Environment",
      description: "Provide students with practical experience in their field of study through hands-on training in industry settings."
    },
    {
      icon: Users,
      title: "Bridge Theory and Practice",
      description: "Connect academic knowledge with real-world applications, enhancing students' understanding and skills."
    },
    {
      icon: BookOpen,
      title: "Develop Professional Skills",
      description: "Foster essential workplace competencies including communication, teamwork, and problem-solving abilities."
    },
    {
      icon: Award,
      title: "Enhance Employability",
      description: "Prepare students for the job market by providing industry-relevant experience and professional networks."
    }
  ];

  const activities = [
    {
      step: 1,
      title: "Pre-SIWES Registration",
      description: "Students complete registration forms with organization and supervisor details.",
      icon: FileText
    },
    {
      step: 2,
      title: "Placement & Orientation",
      description: "Students are placed in organizations and receive orientation on workplace expectations.",
      icon: Users
    },
    {
      step: 3,
      title: "Weekly Logbook Submissions",
      description: "Students document daily activities and submit weekly reports for supervisor review.",
      icon: Calendar
    },
    {
      step: 4,
      title: "Supervisor Evaluations",
      description: "Industry and school supervisors review, approve, and provide feedback on student progress.",
      icon: CheckSquare
    },
    {
      step: 5,
      title: "Final Assessment",
      description: "Completion of SIWES program with final evaluation and certification.",
      icon: Award
    }
  ];

  return (
    <div className="min-h-screen relative">
      {/* Background Image with Gradient Overlay */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${mountainBg})` }}
      />
      {/* Gradient Overlay for readability */}
      <div className="fixed inset-0 bg-gradient-to-br from-white/90 via-purple-50/85 to-primary/20" />
      
      {/* Header with Logo */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-border shadow-sm py-6 relative z-10">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center space-x-4">
            <img
              src={mtuLogo}
              alt="Mountain Top University Logo"
              className="h-16 md:h-20 w-auto mix-blend-multiply"
              loading="eager"
              decoding="async"
            />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 md:py-12 relative z-10">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-8 bg-white/50 backdrop-blur-sm hover:bg-white/70"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Button>

        {/* ITF Logo */}
        <div className="flex flex-col items-center justify-center mb-12">
          <img
            src={itfLogo}
            alt="Industrial Training Fund Logo"
            className="h-32 md:h-40 w-auto mix-blend-multiply drop-shadow-md"
            loading="eager"
            decoding="async"
          />
          {/* Text below logo matching ITF branding */}
          <div className="text-center mt-6 space-y-2">
            <p className="text-sm md:text-base font-semibold text-red-800 uppercase tracking-wide">
              Students Industrial Work Experience Scheme
            </p>
            <p className="text-2xl md:text-3xl font-bold text-black uppercase">
              SIWES
            </p>
          </div>
        </div>

        {/* Main Title */}
        <div className="text-center mb-12 animate-fade-in-up">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-primary mb-4">
            About the SIWES Program
          </h1>
        </div>

        {/* SIWES Introduction */}
        <section className="max-w-4xl mx-auto mb-16 animate-fade-in-up animation-delay-200">
          <Card className="shadow-elevated bg-white/80 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="prose prose-lg max-w-none">
                <p className="text-base md:text-lg text-foreground/90 leading-relaxed mb-4">
                  The Students Industrial Work Experience Scheme (SIWES) is a program designed to expose students to the industrial work environment in their field of study. It is a mandatory program for all students in Nigerian universities, polytechnics, and colleges of education.
                </p>
                <p className="text-base md:text-lg text-foreground/90 leading-relaxed mb-4">
                  SIWES provides students with the opportunity to gain practical experience, develop professional skills, and bridge the gap between theoretical knowledge acquired in the classroom and the practical skills required in the workplace.
                </p>
                <p className="text-base md:text-lg text-foreground/90 leading-relaxed">
                  At Mountain Top University, we are committed to ensuring that our students receive quality industrial training that prepares them for successful careers in their chosen fields.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Aims & Objectives */}
        <section className="mb-16 animate-fade-in-up animation-delay-400">
          <h2 className="text-2xl md:text-3xl font-bold text-primary text-center mb-8">
            Aims & Objectives
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {aims.map((aim, index) => {
              const Icon = aim.icon;
              return (
                <Card
                  key={index}
                  className="shadow-card hover:shadow-elevated transition-all duration-300 hover:scale-105 bg-white/80 backdrop-blur-sm"
                >
                  <CardHeader>
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <CardTitle className="text-lg">{aim.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base leading-relaxed">
                      {aim.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* SIWES Program Activities */}
        <section className="mb-16 animate-fade-in-up animation-delay-600">
          <h2 className="text-2xl md:text-3xl font-bold text-primary text-center mb-12">
            SIWES Program Activities
          </h2>
          <div className="max-w-4xl mx-auto">
            <div className="space-y-8">
              {activities.map((activity, index) => {
                const Icon = activity.icon;
                const isLast = index === activities.length - 1;
                return (
                  <div key={activity.step} className="relative">
                    {/* Connector Line */}
                    {!isLast && (
                      <div className="absolute left-6 top-16 bottom-0 w-0.5 bg-primary/30"></div>
                    )}
                    
                    <div className="flex items-start space-x-6">
                      {/* Step Number & Icon */}
                      <div className="flex-shrink-0 relative z-10">
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-white font-bold text-lg shadow-lg">
                          {activity.step}
                        </div>
                        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                          <div className="p-2 bg-white rounded-full shadow-md border-2 border-primary/20">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                        </div>
                      </div>

                      {/* Content */}
                      <Card className="flex-1 shadow-card hover:shadow-elevated transition-all duration-300 ml-4 bg-white/80 backdrop-blur-sm">
                        <CardHeader>
                          <CardTitle className="text-xl">{activity.title}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <CardDescription className="text-base leading-relaxed">
                            {activity.description}
                          </CardDescription>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="text-center mb-12 animate-fade-in-up animation-delay-800">
          <Card className="max-w-2xl mx-auto shadow-elevated bg-primary/90 backdrop-blur-sm text-white">
            <CardContent className="pt-6">
              <h3 className="text-2xl font-bold mb-4">Ready to Get Started?</h3>
              <p className="text-lg mb-6 opacity-90">
                Join the MTU SIWES Platform and begin your industrial training journey today.
              </p>
              <Button
                onClick={() => navigate("/student/signup")}
                size="lg"
                className="bg-white text-primary hover:bg-primary-lighter hover:text-primary font-semibold"
              >
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white/80 backdrop-blur-sm border-t border-border py-6 mt-12 relative z-10">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Mountain Top University. All rights reserved.</p>
        </div>
      </footer>

      <style>{`
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

        .animate-fade-in-up {
          animation: fade-in-up 0.8s ease-out forwards;
          opacity: 0;
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

        .animation-delay-800 {
          animation-delay: 0.8s;
        }
      `}</style>
    </div>
  );
};

export default SiwesInfo;

