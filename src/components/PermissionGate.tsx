import { ReactNode } from "react";
import { usePermissions, Resource, Action } from "@/hooks/usePermissions";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock } from "lucide-react";

interface PermissionGateProps {
  resource: Resource;
  action: Action;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGate({
  resource,
  action,
  children,
  fallback,
}: PermissionGateProps) {
  const { isAdmin } = useIsAdmin();
  const { hasPermission, isLoading } = usePermissions();

  if (isLoading) {
    return null;
  }

  // Admins always have access
  if (isAdmin) {
    return <>{children}</>;
  }

  // Check permission
  if (hasPermission(resource, action)) {
    return <>{children}</>;
  }

  // Show fallback or default message
  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <Alert className="my-4">
      <Lock className="h-4 w-4" />
      <AlertDescription>
        Você não tem permissão para {action === 'view' ? 'visualizar' : action === 'create' ? 'criar' : action === 'edit' ? 'editar' : 'excluir'} este recurso.
      </AlertDescription>
    </Alert>
  );
}

// Hook version for conditional rendering
export function usePermissionCheck(resource: Resource, action: Action): boolean {
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const { hasPermission, isLoading: isPermissionsLoading } = usePermissions();

  console.log(`usePermissionCheck: resource='${resource}', action='${action}', isAdmin=${isAdmin}, isAdminLoading=${isAdminLoading}, isPermissionsLoading=${isPermissionsLoading}`);

  // While loading, deny access to be safe
  if (isAdminLoading || isPermissionsLoading) {
    console.log(`usePermissionCheck: Still loading, denying access temporarily`);
    return false;
  }

  if (isAdmin) {
    console.log(`usePermissionCheck: User is admin, granting access`);
    return true;
  }

  const result = hasPermission(resource, action);
  console.log(`usePermissionCheck: Final result=${result}`);
  return result;
}
