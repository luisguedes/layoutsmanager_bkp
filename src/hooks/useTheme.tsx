import { useState, useEffect, createContext, useContext } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getApiUrl } from "@/lib/config";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

const API_URL = getApiUrl();

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user, session } = useAuth();
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  // Carregar preferência do usuário
  useEffect(() => {
    const loadUserTheme = async () => {
      // Primeiro, tenta carregar do localStorage (para não-logados ou fallback)
      const localTheme = localStorage.getItem("theme") as Theme | null;
      
      if (user && session) {
        try {
          const response = await fetch(`${API_URL}/config/user-preferences`, {
            headers: {
              'Authorization': `Bearer ${session.token}`,
            },
          });
          
          if (response.ok) {
            const prefs = await response.json();
            if (prefs.theme) {
              setThemeState(prefs.theme);
              return;
            }
          }
        } catch (error) {
          console.error("Erro ao carregar preferências do usuário:", error);
        }
      }
      
      // Fallback para localStorage
      if (localTheme && ["light", "dark", "system"].includes(localTheme)) {
        setThemeState(localTheme);
      }
    };

    loadUserTheme();
  }, [user, session]);

  // Aplicar tema
  useEffect(() => {
    const applyTheme = () => {
      const root = document.documentElement;
      
      if (theme === "system") {
        const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        setResolvedTheme(systemDark ? "dark" : "light");
        root.classList.toggle("dark", systemDark);
      } else {
        setResolvedTheme(theme);
        root.classList.toggle("dark", theme === "dark");
      }
    };

    applyTheme();

    // Listener para mudanças do sistema
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (theme === "system") {
        applyTheme();
      }
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [theme]);

  // Salvar tema
  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("theme", newTheme);

    // Salvar no backend se logado
    if (user && session) {
      try {
        await fetch(`${API_URL}/config/user-preferences`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.token}`,
          },
          body: JSON.stringify({ theme: newTheme }),
        });
      } catch (error) {
        console.error("Erro ao salvar preferência de tema:", error);
      }
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
