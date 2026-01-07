import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Button } from "./ui/button";
import { LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/config";
import { ThemeToggle } from "./ThemeToggle";
import { useTheme } from "@/hooks/useTheme";

const API_URL = getApiUrl();

export function MainLayout({ children }: { children: React.ReactNode }) {
  const { signOut, user, session } = useAuth();
  const { resolvedTheme } = useTheme();

  // Fetch company logo (endpoint específico para logo, não requer admin)
  const { data: companyConfig } = useQuery({
    queryKey: ["company-logo", resolvedTheme],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/config/company/logo`, {
        headers: {
          'Authorization': `Bearer ${session?.token}`,
        },
      });
      
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!session,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Determinar qual logo exibir com base no tema
  const currentLogo = resolvedTheme === "dark" 
    ? (companyConfig?.logo_dark || companyConfig?.logo) 
    : companyConfig?.logo;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar 
          companyLogo={currentLogo} 
          companyName={companyConfig?.nome} 
        />
        <div className="flex-1 flex flex-col">
          <header className="h-14 border-b bg-background flex items-center justify-between px-4 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <span className="text-sm text-muted-foreground">{user?.email}</span>
              <Button variant="ghost" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>
          </header>
          <main className="flex-1 p-6 bg-muted/30">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
