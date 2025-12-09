import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getApiUrl } from "@/lib/config";

const API_URL = getApiUrl();

export type Resource = 'clientes' | 'modelos' | 'tipos' | 'campos' | 'layouts' | 'historico';
export type Action = 'view' | 'create' | 'edit' | 'delete';

interface Permission {
  resource: Resource;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export const usePermissions = () => {
  const { user, session } = useAuth();

  const { data: permissions, isLoading } = useQuery({
    queryKey: ["permissions", user?.id],
    queryFn: async () => {
      if (!user || !session) {
        return [];
      }

      try {
        const response = await fetch(`${API_URL}/permissions/${user.id}`, {
          headers: {
            'Authorization': `Bearer ${session.token}`,
          },
        });

        if (!response.ok) {
          return [];
        }

        const data = await response.json();
        return data as Permission[];
      } catch (error) {
        console.error("Erro ao buscar permissões:", error);
        return [];
      }
    },
    enabled: !!user && !!session,
  });

  const hasPermission = (resource: Resource, action: Action): boolean => {
    if (!permissions) {
      return false;
    }

    const perm = permissions.find((p) => p.resource === resource);
    if (!perm) {
      return false;
    }

    let result = false;
    switch (action) {
      case 'view':
        result = perm.can_view;
        break;
      case 'create':
        result = perm.can_create;
        break;
      case 'edit':
        result = perm.can_edit;
        break;
      case 'delete':
        result = perm.can_delete;
        break;
      default:
        result = false;
    }

    return result;
  };

  return { permissions, hasPermission, isLoading };
};
