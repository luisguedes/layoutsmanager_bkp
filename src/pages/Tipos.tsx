import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getApiUrl } from "@/lib/config";

const API_URL = getApiUrl();

export default function Tipos() {
  const { session } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { hasPermission } = usePermissions();
  
  const canView = isAdmin || hasPermission('tipos', 'view');
  const canCreate = isAdmin || hasPermission('tipos', 'create');
  const canEdit = isAdmin || hasPermission('tipos', 'edit');
  const canDelete = isAdmin || hasPermission('tipos', 'delete');
  
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
  });

  const queryClient = useQueryClient();

  const { data: tipos = [] } = useQuery({
    queryKey: ["tipos"],
    queryFn: async () => {
      if (!session) return [];
      
      const response = await fetch(`${API_URL}/tipos`, {
        headers: {
          'Authorization': `Bearer ${session.token}`,
        },
      });
      
      if (!response.ok) throw new Error('Erro ao carregar tipos');
      return response.json();
    },
    enabled: canView && !!session,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch(`${API_URL}/tipos`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session!.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) throw new Error('Erro ao criar tipo');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tipos"] });
      toast.success("Tipo criado com sucesso!");
      setOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error("Erro ao criar tipo");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const response = await fetch(`${API_URL}/tipos/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session!.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) throw new Error('Erro ao atualizar tipo');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tipos"] });
      toast.success("Tipo atualizado com sucesso!");
      setOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error("Erro ao atualizar tipo");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${API_URL}/tipos/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session!.token}`,
        },
      });
      
      if (!response.ok) throw new Error('Erro ao excluir tipo');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tipos"] });
      toast.success("Tipo excluído com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao excluir tipo");
    },
  });

  const resetForm = () => {
    setFormData({ nome: "", descricao: "" });
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (tipo: any) => {
    setFormData({
      nome: tipo.nome,
      descricao: tipo.descricao || "",
    });
    setEditingId(tipo.id);
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tipos de Impressão</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie os tipos de impressão disponíveis
          </p>
        </div>
        {canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Tipo
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Editar Tipo" : "Novo Tipo"}
              </DialogTitle>
              <DialogDescription>
                {editingId ? "Edite as informações do tipo de impressão" : "Adicione um novo tipo ao sistema"}
              </DialogDescription>
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
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) =>
                    setFormData({ ...formData, descricao: e.target.value })
                  }
                />
              </div>
              <Button type="submit" className="w-full">
                {editingId ? "Atualizar" : "Criar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Criado por</TableHead>
              <TableHead>Última edição</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tipos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Nenhum tipo cadastrado
                </TableCell>
              </TableRow>
            ) : (
              tipos.map((tipo: any) => (
                <TableRow key={tipo.id}>
                  <TableCell className="font-medium">{tipo.nome}</TableCell>
                  <TableCell>{tipo.descricao}</TableCell>
                  <TableCell>
                    {tipo.created_profile_nome ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <span className="text-xs text-muted-foreground">
                              {tipo.created_profile_nome}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {tipo.created_at && (
                              <p className="text-xs">
                                {format(new Date(tipo.created_at), "dd/MM/yyyy HH:mm", {
                                  locale: ptBR,
                                })}
                              </p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {tipo.updated_profile_nome ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <span className="text-xs text-muted-foreground">
                              {tipo.updated_profile_nome}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {tipo.updated_at && (
                              <p className="text-xs">
                                {format(new Date(tipo.updated_at), "dd/MM/yyyy HH:mm", {
                                  locale: ptBR,
                                })}
                              </p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(tipo)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(tipo.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
