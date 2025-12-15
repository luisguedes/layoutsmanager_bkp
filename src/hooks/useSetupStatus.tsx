import { useQuery } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/config";

interface SetupStatusDetails {
  schemaInstalled: boolean;
  tablesFound: number;
  usersCount: number;
  hasAdmin: boolean;
  error?: string;
}

interface SetupStatusResult {
  setupCompleted: boolean;
  isLoading: boolean;
  statusDetails: SetupStatusDetails | null;
}

export const useSetupStatus = (): SetupStatusResult => {
  const { data, isLoading } = useQuery({
    queryKey: ["setupStatus"],
    queryFn: async (): Promise<{ completed: boolean; details: SetupStatusDetails }> => {
      try {
        console.log('🔍 [SETUP-STATUS] Verificando schema no servidor...');
        
        const API_URL = getApiUrl();
        const response = await fetch(`${API_URL}/check-schema`, {
          signal: AbortSignal.timeout(10000),
        });
        
        if (!response.ok) {
          console.log('⚠️ [SETUP-STATUS] Servidor retornou erro, assumindo setup não completo');
          return {
            completed: false,
            details: { schemaInstalled: false, tablesFound: 0, usersCount: 0, hasAdmin: false }
          };
        }
        
        const data = await response.json();
        
        console.log('📊 [SETUP-STATUS] Resposta do servidor:', data);
        
        const details: SetupStatusDetails = {
          schemaInstalled: data.schemaInstalled ?? false,
          tablesFound: data.tablesFound ?? 0,
          usersCount: data.usersCount ?? 0,
          hasAdmin: data.hasAdmin ?? false,
          error: data.error
        };
        
        // Setup is complete if: schema installed AND has admin user
        if (data.installed) {
          console.log('✅ [SETUP-STATUS] Sistema instalado (schema + admin)');
          localStorage.setItem('setup_completed', 'true');
          return { completed: true, details };
        }
        
        // Schema is not fully installed
        console.log('❌ [SETUP-STATUS] Setup NÃO completo:', {
          schemaInstalled: details.schemaInstalled,
          hasAdmin: details.hasAdmin,
          usersCount: details.usersCount
        });
        localStorage.removeItem('setup_completed');
        localStorage.removeItem('auth_token');
        return { completed: false, details };
      } catch (error) {
        console.error('❌ [SETUP-STATUS] Erro ao verificar:', error);
        
        // On connection error, check localStorage as fallback
        // but only trust it if it says setup IS completed
        const localFlag = localStorage.getItem('setup_completed') === 'true';
        if (localFlag) {
          console.log('⚠️ [SETUP-STATUS] Usando cache local (setup_completed=true)');
          return {
            completed: true,
            details: { schemaInstalled: true, tablesFound: 7, usersCount: 1, hasAdmin: true }
          };
        }
        
        // If no local flag or connection error, assume not setup
        return {
          completed: false,
          details: { schemaInstalled: false, tablesFound: 0, usersCount: 0, hasAdmin: false, error: String(error) }
        };
      }
    },
    retry: 1,
    staleTime: 30000, // Cache for 30 seconds
    refetchOnWindowFocus: false,
  });

  console.log('🎯 [SETUP-STATUS] Resultado final:', { 
    setupCompleted: data?.completed, 
    isLoading,
    statusDetails: data?.details 
  });
  
  return { 
    setupCompleted: data?.completed ?? false, 
    isLoading,
    statusDetails: data?.details ?? null
  };
};
