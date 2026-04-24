import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";

type Theme = "dark" | "light";

type ThemeContextType = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

type ThemeProviderProps = {
  children: ReactNode;
};

// تطبيق فوري للثيم على <html> (دالة خارجية - لا تسبب re-render)
const applyThemeToDOM = (currentTheme: Theme) => {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  if (currentTheme === 'dark') {
    root.classList.add("dark");
    root.classList.remove("light");
  } else {
    root.classList.remove("dark");
    root.classList.add("light");
  }
  localStorage.setItem("theme", currentTheme);
};

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem("theme") as Theme;
      if (savedTheme) return savedTheme;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  });

  // ⚡ تطبيق الثيم مرة واحدة عند كل تغيير (بدون تكرار)
  React.useLayoutEffect(() => {
    applyThemeToDOM(theme);
  }, [theme]);

  // مراقبة تغييرات نظام التشغيل (مرة واحدة فقط)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      // طبّق فقط إذا لم يحدد المستخدم تفضيلاً يدوياً
      const userPreference = localStorage.getItem("theme");
      if (!userPreference) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;
