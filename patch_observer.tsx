import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/contexts/AuthContext";

export function ThemeRouteObserver() {
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const previousUserId = useRef<string | undefined>();

  useEffect(() => {
    // When the user changes (logs in, logs out, or switches accounts)
    if (user?.id !== previousUserId.current) {
      if (user?.id) {
        // Logged in: grab this specific user's preferred theme, default to system
        const userTheme = localStorage.getItem(\	heme-preference-\\) as any;
        if (userTheme && userTheme !== theme) {
          setTheme(userTheme);
        } else if (!userTheme) {
          // If no preference yet, set a sensible default for new users (light)
          setTheme("light");
        }
      } else {
        // Logged out
        setTheme("light");
      }
      previousUserId.current = user?.id;
    }
  }, [user?.id, setTheme, theme]);

  useEffect(() => {
    // Whenever the global theme changes, save it to the current user's profile if logged in
    if (user?.id) {
      localStorage.setItem(\	heme-preference-\\, theme);
    }
  }, [theme, user?.id]);

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
      // Optional: setting data-theme for extra safety
      root.setAttribute('data-theme', 'light');
    } else {
      // Re-apply the user's selected theme
      root.classList.remove("light", "dark");

      if (theme === "system") {
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
        root.classList.add(systemTheme);
        root.setAttribute('data-theme', systemTheme);
      } else {
        root.classList.add(theme);
        root.setAttribute('data-theme', theme);
      }
    }
  }, [location.pathname, theme]);

  return null;
}
