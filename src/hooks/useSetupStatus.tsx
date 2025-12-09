import { useQuery } from "@tanstack/react-query";
import { getApiUrl, isDockerEnvironment } from "@/lib/config";

export const useSetupStatus = () => {
  const { data: setupCompleted, isLoading } = useQuery({
    queryKey: ["setupStatus"],
    queryFn: async () => {
      try {
        // First check localStorage for quick response
        const localSetupCompleted = localStorage.getItem('setup_completed') === 'true';
        
        // In Docker, if we have localStorage flag, trust it initially
        // This prevents the check-schema call from failing during initial setup
        if (isDockerEnvironment() && !localSetupCompleted) {
          console.log('🐳 [SETUP-STATUS] Docker detectado, setup não concluído localmente');
          return false;
        }
        
        console.log('🔍 [SETUP-STATUS] Verificando schema...');
        
        const API_URL = getApiUrl();
        const response = await fetch(`${API_URL}/check-schema`, {
          // Add timeout to prevent long waits
          signal: AbortSignal.timeout(5000),
        });
        
        if (!response.ok) {
          console.log('⚠️ [SETUP-STATUS] Servidor retornou erro, assumindo setup não completo');
          return false;
        }
        
        const data = await response.json();
        
        console.log('📊 [SETUP-STATUS] Resposta do servidor:', data);
        
        // If schema is installed, setup is complete
        if (data.installed) {
          console.log('✅ [SETUP-STATUS] Schema instalado');
          localStorage.setItem('setup_completed', 'true');
          return true;
        }
        
        // Schema is not installed, clear localStorage
        console.log('❌ [SETUP-STATUS] Schema NÃO instalado');
        localStorage.removeItem('setup_completed');
        localStorage.removeItem('auth_token');
        return false;
      } catch (error) {
        // If backend is not available, check localStorage as fallback
        console.error('❌ [SETUP-STATUS] Erro ao verificar:', error);
        
        // In Docker environment with connection error, assume setup needed
        if (isDockerEnvironment()) {
          console.log('🐳 [SETUP-STATUS] Docker: erro de conexão, setup necessário');
          return false;
        }
        
        // For non-Docker, check localStorage
        return localStorage.getItem('setup_completed') === 'true';
      }
    },
    retry: 0, // Don't retry to avoid delays
    staleTime: 0,
  });

  console.log('🎯 [SETUP-STATUS] Resultado final:', { setupCompleted, isLoading });
  return { setupCompleted: setupCompleted ?? false, isLoading };
};
