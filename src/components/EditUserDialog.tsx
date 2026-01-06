import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/config";
import { maskPhone, unmask } from "@/lib/utils";

const API_URL = getApiUrl();

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    nome: string | null;
    email: string | null;
    telefone: string | null;
    cargo: string | null;
  };
}

export function EditUserDialog({
  open,
  onOpenChange,
  user,
}: EditUserDialogProps) {
  const { toast } = useToast();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    nome: user.nome || "",
    email: user.email || "",
    telefone: maskPhone(user.telefone || ""),
    cargo: user.cargo || "",
  });
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    setFormData({
      nome: user.nome || "",
      email: user.email || "",
      telefone: maskPhone(user.telefone || ""),
      cargo: user.cargo || "",
    });
    setNewPassword("");
    setConfirmNewPassword("");
    setPasswordError("");
  }, [user]);

  const updateUserMutation = useMutation({
    mutationFn: async () => {
      // Atualizar dados do perfil - remove máscara do telefone antes de salvar
      const dataToSave = {
        ...formData,
        telefone: unmask(formData.telefone),
      };
      
      const response = await fetch(`${API_URL}/usuarios/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.token}`,
        },
        body: JSON.stringify(dataToSave),
      });

      if (!response.ok) throw new Error('Erro ao atualizar usuário');

      // Se senha está sendo alterada, fazer requisição separada
      if (newPassword) {
        if (newPassword !== confirmNewPassword) {
          throw new Error("As senhas não coincidem");
        }
        if (newPassword.length < 8) {
          throw new Error("A senha deve ter no mínimo 8 caracteres");
        }

        const passwordResponse = await fetch(`${API_URL}/usuarios/${user.id}/reset-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.token}`,
          },
          body: JSON.stringify({ newPassword }),
        });

        if (!passwordResponse.ok) {
          const errorData = await passwordResponse.json();
          throw new Error(errorData.error || "Erro ao resetar senha");
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast({
        title: "Usuário atualizado com sucesso",
        description: newPassword ? "Dados e senha atualizados" : "Dados atualizados",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar usuário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    if (newPassword && newPassword !== confirmNewPassword) {
      setPasswordError("As senhas não coincidem");
      return;
    }
    if (newPassword && newPassword.length < 8) {
      setPasswordError("A senha deve ter no mínimo 8 caracteres");
      return;
    }

    updateUserMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) =>
                setFormData({ ...formData, nome: e.target.value })
              }
              placeholder="Nome completo"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              placeholder="email@exemplo.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone</Label>
            <Input
              id="telefone"
              value={formData.telefone}
              onChange={(e) =>
                setFormData({ ...formData, telefone: maskPhone(e.target.value) })
              }
              placeholder="(00) 00000-0000"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cargo">Cargo</Label>
            <Input
              id="cargo"
              value={formData.cargo}
              onChange={(e) =>
                setFormData({ ...formData, cargo: e.target.value })
              }
              placeholder="Cargo do usuário"
            />
          </div>

          <Separator className="my-4" />

          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Resetar Senha</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Deixe em branco para manter a senha atual
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmNewPassword">Confirmar Nova Senha</Label>
              <Input
                id="confirmNewPassword"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Confirme a nova senha"
              />
            </div>

            {passwordError && (
              <p className="text-sm text-destructive">{passwordError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={updateUserMutation.isPending}>
              {updateUserMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
