import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSetupStatus } from "@/hooks/useSetupStatus";

export const SetupGuard = ({ children }: { children: React.ReactNode }) => {
  const { setupCompleted, isLoading } = useSetupStatus();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    console.log('🔍 [SETUP-GUARD] Estado:', { 
      setupCompleted, 
      isLoading, 
      pathname: location.pathname 
    });
    
    if (!isLoading) {
      // Allow direct access to setup page when schema is not installed
      if (!setupCompleted && location.pathname !== "/setup") {
        console.log("❌ [SETUP-GUARD] Setup não completo, redirecionando para /setup");
        navigate("/setup", { replace: true });
      }
      // If setup is completed and on setup page, redirect to auth
      else if (setupCompleted && location.pathname === "/setup") {
        console.log("✅ [SETUP-GUARD] Setup completo, redirecionando para /auth");
        navigate("/auth", { replace: true });
      } else {
        console.log("ℹ️ [SETUP-GUARD] Mantendo na página atual:", location.pathname);
      }
    }
  }, [setupCompleted, isLoading, navigate, location.pathname]);

  // Show loading state while checking setup status
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Verificando configuração do sistema...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
