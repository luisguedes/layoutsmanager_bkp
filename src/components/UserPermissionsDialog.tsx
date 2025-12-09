import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { getApiUrl } from "@/lib/config";

const API_URL = getApiUrl();

interface UserPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  currentRole: string;
}

const resources = [
  { id: 'clientes', label: 'Clientes' },
  { id: 'modelos', label: 'Modelos' },
  { id: 'tipos', label: 'Tipos de Impressão' },
  { id: 'campos', label: 'Campos' },
  { id: 'layouts', label: 'Layouts' },
  { id: 'historico', label: 'Histórico' },
];

export function UserPermissionsDialog({
  open,
  onOpenChange,
  userId,
  userName,
  currentRole,
}: UserPermissionsDialogProps) {
  const { toast } = useToast();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [role, setRole] = useState(currentRole);
  const [permissions, setPermissions] = useState<Record<string, any>>({});

  const { data: userPermissions } = useQuery({
    queryKey: ["userPermissions", userId],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/permissions/${userId}`, {
        headers: {
          'Authorization': `Bearer ${session?.token}`,
        },
      });
      if (!response.ok) throw new Error('Erro ao buscar permissões');
      return response.json();
    },
    enabled: open && !!session,
  });

  useEffect(() => {
    if (userPermissions) {
      const perms: Record<string, any> = {};
      userPermissions.forEach((p) => {
        perms[p.resource] = {
          can_view: p.can_view,
          can_create: p.can_create,
          can_edit: p.can_edit,
          can_delete: p.can_delete,
        };
      });
      setPermissions(perms);
    }
  }, [userPermissions]);

  const updateRoleMutation = useMutation({
    mutationFn: async (newRole: string) => {
      const response = await fetch(`${API_URL}/usuarios/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });
      
      if (!response.ok) throw new Error('Erro ao atualizar perfil');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast({
        title: "Perfil atualizado com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar perfil",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: async () => {
      const updates = Object.entries(permissions).map(([resource, perms]) => ({
        user_id: userId,
        resource,
        ...perms,
      }));

      const response = await fetch(`${API_URL}/permissions/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.token}`,
        },
        body: JSON.stringify({ permissions: updates }),
      });
      
      if (!response.ok) throw new Error('Erro ao atualizar permissões');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userPermissions"] });
      toast({
        title: "Permissões atualizadas com sucesso",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar permissões",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = async () => {
    if (role !== currentRole) {
      await updateRoleMutation.mutateAsync(role);
    }
    await updatePermissionsMutation.mutateAsync();
  };

  const updatePermission = (resource: string, action: string, value: boolean) => {
    setPermissions((prev) => ({
      ...prev,
      [resource]: {
        ...prev[resource],
        [action]: value,
      },
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Permissões - {userName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Perfil de Acesso</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Usuário</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {role === "admin"
                ? "Administradores têm acesso total a todas as funcionalidades"
                : "Configure as permissões específicas abaixo"}
            </p>
          </div>

          {role !== "admin" && (
            <>
              <Separator />

              <div className="space-y-4">
                <Label className="text-base font-semibold">
                  Permissões por Recurso
                </Label>

                {resources.map((resource) => (
                  <div key={resource.id} className="space-y-3 rounded-lg border p-4">
                    <h4 className="font-medium">{resource.label}</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`${resource.id}-view`}>Visualizar</Label>
                        <Switch
                          id={`${resource.id}-view`}
                          checked={permissions[resource.id]?.can_view || false}
                          onCheckedChange={(checked) =>
                            updatePermission(resource.id, "can_view", checked)
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`${resource.id}-create`}>Criar</Label>
                        <Switch
                          id={`${resource.id}-create`}
                          checked={permissions[resource.id]?.can_create || false}
                          onCheckedChange={(checked) =>
                            updatePermission(resource.id, "can_create", checked)
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`${resource.id}-edit`}>Editar</Label>
                        <Switch
                          id={`${resource.id}-edit`}
                          checked={permissions[resource.id]?.can_edit || false}
                          onCheckedChange={(checked) =>
                            updatePermission(resource.id, "can_edit", checked)
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`${resource.id}-delete`}>Excluir</Label>
                        <Switch
                          id={`${resource.id}-delete`}
                          checked={permissions[resource.id]?.can_delete || false}
                          onCheckedChange={(checked) =>
                            updatePermission(resource.id, "can_delete", checked)
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                updateRoleMutation.isPending || updatePermissionsMutation.isPending
              }
            >
              {updateRoleMutation.isPending || updatePermissionsMutation.isPending
                ? "Salvando..."
                : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
