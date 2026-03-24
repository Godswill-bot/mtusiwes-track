import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/contexts/AuthContext";

export function ThemeRouteObserver() {
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const previousUserId = useRef<string | undefined>();

  // 1. Load User's Individual Theme preference on Login
  useEffect(() => {
    if (user?.id !== previousUserId.current) {
      if (user?.id) {
        // Find their specific saved theme, default to light
        const userTheme = localStorage.getItem('theme-preference-' + user.id) || 'light';
        if (userTheme !== theme) {
          setTheme(userTheme as 'light' | 'dark' | 'system');
        }
      } else {
        // User logged out, revert to light
        setTheme('light');
      }
      previousUserId.current = user?.id;
    }
  }, [user?.id, setTheme, theme]);

  // 2. Save User's Individual Theme Preference when they change it
  useEffect(() => {
    if (user?.id) {
      localStorage.setItem('theme-preference-' + user.id, theme);
    }
  }, [theme, user?.id]);

  // 3. Force UI changes based on route
  useEffect(() => {
    const root = window.document.documentElement;

    const isLightModeOnlyPage =
      location.pathname === "/" ||
      location.pathname.includes("/login") ||
      location.pathname.includes("/signup");

    if (isLightModeOnlyPage) {
      root.classList.remove("dark");
      root.classList.add("light");
      root.setAttribute('data-theme', 'light');
    } else {
      root.classList.remove("light", "dark");
      if (theme === "system") {
        const sys = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        root.classList.add(sys);
        root.setAttribute('data-theme', sys);
      } else {
        root.classList.add(theme);
        root.setAttribute('data-theme', theme);
      }
    }
  }, [location.pathname, theme]);

  return null;
}
