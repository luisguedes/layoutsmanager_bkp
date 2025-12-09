import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getApiUrl } from "@/lib/config";

const API_URL = getApiUrl();

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, signOut, session } = useAuth();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user || !session) return null;
      
      const response = await fetch(`${API_URL}/usuarios/${user.id}`, {
        headers: {
          'Authorization': `Bearer ${session.token}`,
        },
      });

      if (!response.ok) throw new Error('Erro ao buscar perfil');
      return response.json();
    },
    enabled: !!user && !!session,
  });

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Check if user is inactive
  if (profile && !profile.ativo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Conta Inativa</CardTitle>
            <CardDescription>
              Sua conta ainda não foi ativada por um administrador.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Aguarde a aprovação de um administrador para acessar o sistema. 
              Você receberá uma notificação quando sua conta for ativada.
            </p>
            <button
              onClick={signOut}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Sair
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};
