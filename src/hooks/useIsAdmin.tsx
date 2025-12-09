import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getApiUrl } from "@/lib/config";

const API_URL = getApiUrl();

export const useIsAdmin = () => {
  const { user, session } = useAuth();

  const { data: isAdmin, isLoading } = useQuery({
    queryKey: ["isAdmin", user?.id],
    queryFn: async () => {
      if (!user || !session) {
        return false;
      }

      try {
        const response = await fetch(`${API_URL}/auth/is-admin`, {
          headers: {
            'Authorization': `Bearer ${session.token}`,
          },
        });

        if (!response.ok) {
          return false;
        }

        const data = await response.json();
        return data.isAdmin;
      } catch (error) {
        console.error("Erro ao verificar status de admin:", error);
        return false;
      }
    },
    enabled: !!user && !!session,
  });

  return { isAdmin: isAdmin ?? false, isLoading };
};
