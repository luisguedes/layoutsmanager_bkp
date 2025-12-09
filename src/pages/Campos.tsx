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
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getApiUrl } from "@/lib/config";

const API_URL = getApiUrl();

export default function Campos() {
  const { user, session } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { hasPermission } = usePermissions();
  
  const canView = isAdmin || hasPermission('campos', 'view');
  const canCreate = isAdmin || hasPermission('campos', 'create');
  const canEdit = isAdmin || hasPermission('campos', 'edit');
  const canDelete = isAdmin || hasPermission('campos', 'delete');
  
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedCamposIds, setSelectedCamposIds] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
  });

  const queryClient = useQueryClient();

  const { data: campos = [] } = useQuery({
    queryKey: ["campos"],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/campos`, {
        headers: {
          'Authorization': `Bearer ${session.token}`,
        },
      });
      if (!response.ok) throw new Error('Erro ao buscar campos');
      return response.json();
    },
    enabled: canView && !!session,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch(`${API_URL}/campos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Erro ao criar campo');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campos"] });
      toast.success("Campo criado com sucesso!");
      setOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error("Erro ao criar campo");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const response = await fetch(`${API_URL}/campos/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Erro ao atualizar campo');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campos"] });
      toast.success("Campo atualizado com sucesso!");
      setOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error("Erro ao atualizar campo");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${API_URL}/campos/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.token}`,
        },
      });
      if (!response.ok) throw new Error('Erro ao excluir campo');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campos"] });
      toast.success("Campo excluído com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao excluir campo");
    },
  });

  const handleSearch = async () => {
    if (selectedCamposIds.length === 0) {
      toast.error("Selecione pelo menos um campo para buscar");
      return;
    }

    const selectedCamposNomes = campos
      .filter((campo: any) => selectedCamposIds.includes(campo.id))
      .map((campo: any) => campo.nome);

    try {
      const response = await fetch(`${API_URL}/rpc/clientes-com-campo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`,
        },
        body: JSON.stringify({ nomes_campos: selectedCamposNomes }),
      });

      if (!response.ok) throw new Error('Erro ao buscar clientes');

      const data = await response.json();
      setSearchResults(data || []);
      
      if (data?.length === 0) {
        toast.info("Nenhum cliente encontrado com todos os campos selecionados");
      } else {
        toast.success(`${data.length} cliente(s) encontrado(s)`);
      }
    } catch (error: any) {
      console.error("Erro ao buscar clientes:", error);
      toast.error(`Erro ao buscar clientes: ${error.message}`);
    }
  };

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

  const handleEdit = (campo: any) => {
    setFormData({
      nome: campo.nome,
      descricao: campo.descricao || "",
    });
    setEditingId(campo.id);
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Campos</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie os campos dos layouts
          </p>
        </div>
        {canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Campo
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Editar Campo" : "Novo Campo"}
              </DialogTitle>
              <DialogDescription>
                {editingId ? "Edite as informações do campo" : "Adicione um novo campo ao sistema"}
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

      <Card>
        <CardHeader>
          <CardTitle>Buscar Clientes por Campos</CardTitle>
          <CardDescription>
            Selecione múltiplos campos para encontrar clientes que possuem TODOS os campos selecionados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <MultiSelectFilter
              label="Campos"
              placeholder="Selecione os campos..."
              options={campos.map((campo: any) => ({
                id: campo.id,
                nome: campo.nome,
              }))}
              selectedIds={selectedCamposIds}
              onChange={setSelectedCamposIds}
            />
            <Button onClick={handleSearch} className="w-full">
              <Search className="h-4 w-4 mr-2" />
              Buscar Clientes
            </Button>
          </div>
          {searchResults.length > 0 && (
            <div className="mt-4 border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Layout</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Tipo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchResults.map((result: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell>{result.cliente_nome}</TableCell>
                      <TableCell>{result.cliente_cnpj}</TableCell>
                      <TableCell>{result.layout_nome}</TableCell>
                      <TableCell>{result.modelo_nome}</TableCell>
                      <TableCell>{result.tipo_nome}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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
            {campos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Nenhum campo cadastrado
                </TableCell>
              </TableRow>
            ) : (
              campos.map((campo: any) => (
                <TableRow key={campo.id}>
                  <TableCell className="font-medium">{campo.nome}</TableCell>
                  <TableCell>{campo.descricao}</TableCell>
                  <TableCell>
                    {campo.created_profile_nome ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <span className="text-xs text-muted-foreground">
                              {campo.created_profile_nome}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {campo.created_at && (
                              <p className="text-xs">
                                {format(new Date(campo.created_at), "dd/MM/yyyy HH:mm", {
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
                    {campo.updated_profile_nome ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <span className="text-xs text-muted-foreground">
                              {campo.updated_profile_nome}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {campo.updated_at && (
                              <p className="text-xs">
                                {format(new Date(campo.updated_at), "dd/MM/yyyy HH:mm", {
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
                        onClick={() => handleEdit(campo)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(campo.id)}
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