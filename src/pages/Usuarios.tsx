import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getApiUrl } from "@/lib/config";

const API_URL = getApiUrl();
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Settings, Edit } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { UserPermissionsDialog } from "@/components/UserPermissionsDialog";
import { EditUserDialog } from "@/components/EditUserDialog";
import { useIsAdmin } from "@/hooks/useIsAdmin";

interface Profile {
  id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  cargo: string | null;
  ativo: boolean;
  created_at: string;
  user_roles: { role: string }[];
}

export default function Usuarios() {
  const [permissionsDialog, setPermissionsDialog] = useState<{
    open: boolean;
    userId: string;
    userName: string;
    role: string;
  } | null>(null);
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    user: Profile;
  } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin } = useIsAdmin();
  const { session } = useAuth();

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/usuarios`, {
        headers: {
          'Authorization': `Bearer ${session.token}`,
        },
      });
      
      if (!response.ok) throw new Error('Erro ao buscar usuários');
      return response.json();
    },
    enabled: !!session,
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const response = await fetch(`${API_URL}/usuarios/${id}/toggle-active`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`,
        },
        body: JSON.stringify({ ativo }),
      });
      
      if (!response.ok) throw new Error('Erro ao atualizar status');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast({
        title: "Status do usuário atualizado",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Gestão de Usuários</h1>
          <p className="text-muted-foreground">
            Visualize e gerencie os usuários do sistema
          </p>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Cadastrado em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : profiles && profiles.length > 0 ? (
              profiles.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell className="font-medium">
                    {profile.nome || "-"}
                  </TableCell>
                  <TableCell>{profile.email || "-"}</TableCell>
                  <TableCell>{profile.telefone || "-"}</TableCell>
                  <TableCell>{profile.cargo || "-"}</TableCell>
                  <TableCell>
                    {profile.user_roles?.[0]?.role === "admin" ? (
                      <Badge variant="default">Administrador</Badge>
                    ) : (
                      <Badge variant="secondary">Usuário</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={profile.ativo}
                      onCheckedChange={(checked) =>
                        toggleActiveMutation.mutate({
                          id: profile.id,
                          ativo: checked,
                        })
                      }
                      disabled={!isAdmin}
                    />
                  </TableCell>
                  <TableCell>
                    {format(new Date(profile.created_at), "dd/MM/yyyy", {
                      locale: ptBR,
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {isAdmin && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setEditDialog({
                                open: true,
                                user: profile,
                              })
                            }
                            title="Editar usuário"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setPermissionsDialog({
                                open: true,
                                userId: profile.id,
                                userName: profile.nome || profile.email || "Usuário",
                                role: profile.user_roles?.[0]?.role || "user",
                              })
                            }
                            title="Gerenciar permissões"
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center">
                  Nenhum usuário cadastrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {permissionsDialog && (
        <UserPermissionsDialog
          open={permissionsDialog.open}
          onOpenChange={(open) =>
            open
              ? null
              : setPermissionsDialog(null)
          }
          userId={permissionsDialog.userId}
          userName={permissionsDialog.userName}
          currentRole={permissionsDialog.role}
        />
      )}

      {editDialog && (
        <EditUserDialog
          open={editDialog.open}
          onOpenChange={(open) =>
            open ? null : setEditDialog(null)
          }
          user={editDialog.user}
        />
      )}
    </div>
  );
}
