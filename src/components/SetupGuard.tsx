import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSetupStatus } from "@/hooks/useSetupStatus";
import { Database, Users, Shield, Server, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export const SetupGuard = ({ children }: { children: React.ReactNode }) => {
  const { setupCompleted, isLoading, statusDetails } = useSetupStatus();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    console.log('🔍 [SETUP-GUARD] Estado:', { 
      setupCompleted, 
      isLoading, 
      statusDetails,
      pathname: location.pathname 
    });
    
    if (!isLoading) {
      // If setup is not completed and not on setup page, redirect to setup
      if (!setupCompleted && location.pathname !== "/setup") {
        console.log("❌ [SETUP-GUARD] Setup não completo, redirecionando para /setup");
        navigate("/setup", { replace: true });
      }
      // If setup IS completed and user is on setup page, redirect to auth
      else if (setupCompleted && location.pathname === "/setup") {
        console.log("✅ [SETUP-GUARD] Setup completo, redirecionando para /auth");
        navigate("/auth", { replace: true });
      } else {
        console.log("ℹ️ [SETUP-GUARD] Mantendo na página atual:", location.pathname);
      }
    }
  }, [setupCompleted, isLoading, navigate, location.pathname, statusDetails]);

  // Show informative loading state while checking setup status
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30">
        <div className="text-center space-y-8 max-w-md mx-auto p-8">
          {/* Logo/Title */}
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-3">
              <div className="relative">
                <Server className="h-10 w-10 text-primary animate-pulse" />
                <div className="absolute -top-1 -right-1 h-3 w-3 bg-primary rounded-full animate-ping" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">
                Sistema de Gestão
              </h1>
            </div>
            <p className="text-muted-foreground text-sm">
              Verificando configuração do sistema
            </p>
          </div>

          {/* Progress bar */}
          <div className="space-y-3">
            <Progress value={undefined} className="h-2 animate-pulse" />
            <p className="text-xs text-muted-foreground">
              Conectando ao servidor...
            </p>
          </div>

          {/* Status checks */}
          <div className="grid gap-3">
            <StatusCheck 
              icon={Server} 
              label="Conexão com servidor" 
              status="checking" 
            />
            <StatusCheck 
              icon={Database} 
              label="Schema do banco de dados" 
              status="pending" 
            />
            <StatusCheck 
              icon={Users} 
              label="Usuários cadastrados" 
              status="pending" 
            />
            <StatusCheck 
              icon={Shield} 
              label="Administrador configurado" 
              status="pending" 
            />
          </div>

          {/* Footer info */}
          <p className="text-xs text-muted-foreground/60">
            Aguarde enquanto verificamos a configuração...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

interface StatusCheckProps {
  icon: React.ElementType;
  label: string;
  status: 'pending' | 'checking' | 'success' | 'error';
}

const StatusCheck = ({ icon: Icon, label, status }: StatusCheckProps) => {
  const getStatusIndicator = () => {
    switch (status) {
      case 'checking':
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      case 'success':
        return <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center">
          <span className="text-white text-xs">✓</span>
        </div>;
      case 'error':
        return <div className="h-4 w-4 rounded-full bg-destructive flex items-center justify-center">
          <span className="text-white text-xs">✗</span>
        </div>;
      default:
        return <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />;
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-card/50 border border-border/50">
      <Icon className="h-5 w-5 text-muted-foreground" />
      <span className="flex-1 text-sm text-left text-foreground/80">{label}</span>
      {getStatusIndicator()}
    </div>
  );
};
