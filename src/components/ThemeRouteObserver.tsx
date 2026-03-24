import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useTheme } from "@/components/theme-provider";

export function ThemeRouteObserver() {
  const location = useLocation();
  const { theme } = useTheme();

  useEffect(() => {
    const root = window.document.documentElement;
    
    // Pages that must ALWAYS be in light mode
    const isLightModeOnlyPage = 
      location.pathname === "/" || 
      location.pathname.includes("/login") || 
      location.pathname.includes("/signup");

    if (isLightModeOnlyPage) {
      root.classList.remove("dark");
      root.classList.add("light");
    } else {
      // Re-apply the user's selected theme (or system theme) when on other pages
      root.classList.remove("light", "dark");
      
      if (theme === "system") {
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
        root.classList.add(systemTheme);
      } else {
        root.classList.add(theme);
      }
    }
  }, [location.pathname, theme]);

  return null; // This component doesn't render anything
}
