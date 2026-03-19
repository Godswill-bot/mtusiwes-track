import { useState, useEffect } from "react";
import img1 from "@/assets/alternate-hero-image.png";
import img2 from "@/assets/intro-image.png";
import img3 from "@/assets/hero-image-2.jpeg";

const IMAGES = [img1, img2, img3];

export const AuthSlideshow = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % IMAGES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-zinc-900 p-10 text-white lg:flex">
      <div className="absolute inset-0 bg-zinc-900">
        {IMAGES.map((img, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              index === currentIndex ? "opacity-100" : "opacity-0"
            }`}
          >
            <img
              src={img}
              alt={`Slide ${index + 1}`}
              className="h-full w-full object-cover opacity-50"
            />
          </div>
        ))}
      </div>
      <div className="relative z-20 flex items-center text-lg font-medium">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mr-2 h-6 w-6"
        >
          <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3 3" />
        </svg>
        MTU SIWES
      </div>
      <div className="relative z-20 mt-auto">
        <blockquote className="space-y-2">
          <p className="text-lg">
            &ldquo;Empowering students with practical industry experience to bridge the gap between theory and practice.&rdquo;
          </p>
          <footer className="text-sm">MTU SIWES Unit</footer>
        </blockquote>
        <div className="mt-8 flex gap-2">
          {IMAGES.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setCurrentIndex(index)}
              aria-label={`Go to slide ${index + 1}`}
              className={`h-2 w-2 rounded-full transition-all ${
                index === currentIndex ? "w-4 bg-white" : "bg-white/50"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
