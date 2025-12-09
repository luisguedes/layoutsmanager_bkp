import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getApiUrl } from "@/lib/config";

const API_URL = getApiUrl();
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { clienteSchema } from "@/lib/validations";
import { maskCNPJ, maskCEP, maskPhone, unmask } from "@/lib/utils";
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

export default function Clientes() {
  const { user, session } = useAuth();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const { hasPermission, isLoading: isPermissionsLoading } = usePermissions();
  
  // Calculate permissions
  const isLoading = isAdminLoading || isPermissionsLoading;
  const canView = isAdmin || (!isLoading && hasPermission('clientes', 'view'));
  const canCreate = isAdmin || (!isLoading && hasPermission('clientes', 'create'));
  const canEdit = isAdmin || (!isLoading && hasPermission('clientes', 'edit'));
  const canDelete = isAdmin || (!isLoading && hasPermission('clientes', 'delete'));
  
  console.log("Clientes page permissions:", { 
    isAdmin, 
    isAdminLoading, 
    isPermissionsLoading,
    canView, 
    canCreate, 
    canEdit, 
    canDelete 
  });
  
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    cnpj: "",
    razao_social: "",
    nome_fantasia: "",
    endereco: "",
    cidade: "",
    uf: "",
    cep: "",
    telefone: "",
    email: "",
    situacao: "",
    atividade_principal: "",
    observacoes: "",
  });
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);

  const queryClient = useQueryClient();

  const { data: clientes = [], isLoading: isLoadingClientes, error: clientesError } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/clientes`, {
        headers: {
          'Authorization': `Bearer ${session.token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Erro ao buscar clientes');
      }
      
      return response.json();
    },
    enabled: canView && !!session,
  });

  // Log any errors
  if (clientesError) {
    console.error("Clientes query error:", clientesError);
  }

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch(`${API_URL}/clientes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`,
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao criar cliente');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      toast.success("Cliente criado com sucesso!");
      setOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Erro desconhecido ao criar cliente";
      toast.error(`Erro ao criar cliente: ${errorMessage}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const response = await fetch(`${API_URL}/clientes/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`,
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao atualizar cliente');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      toast.success("Cliente atualizado com sucesso!");
      setOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Erro desconhecido ao atualizar cliente";
      toast.error(`Erro ao atualizar cliente: ${errorMessage}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${API_URL}/clientes/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.token}`,
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao excluir cliente');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      toast.success("Cliente excluído com sucesso!");
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Erro desconhecido ao excluir cliente";
      toast.error(`Erro ao excluir cliente: ${errorMessage}`);
    },
  });

  const resetForm = () => {
    setFormData({
      nome: "",
      cnpj: "",
      razao_social: "",
      nome_fantasia: "",
      endereco: "",
      cidade: "",
      uf: "",
      cep: "",
      telefone: "",
      email: "",
      situacao: "",
      atividade_principal: "",
      observacoes: "",
    });
    setEditingId(null);
  };

  const buscarDadosCnpj = async (cnpj: string) => {
    const cleanCnpj = unmask(cnpj);
    if (!cleanCnpj || cleanCnpj.length !== 14) return;
    
    setBuscandoCnpj(true);
    try {
      const response = await fetch(`${API_URL}/consultar-cnpj`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`,
        },
        body: JSON.stringify({ cnpj: cleanCnpj }),
      });

      if (!response.ok) {
        throw new Error('Erro ao consultar CNPJ');
      }

      const data = await response.json();

      if (data) {
        setFormData(prev => ({
          ...prev,
          nome: data.razao_social || prev.nome,
          razao_social: data.razao_social || "",
          nome_fantasia: data.nome_fantasia || "",
          endereco: data.endereco || "",
          cidade: data.cidade || "",
          uf: data.uf || "",
          cep: unmask(data.cep || ""),
          telefone: unmask(data.telefone || ""),
          email: data.email || "",
          situacao: data.situacao || "",
          atividade_principal: data.atividade_principal || "",
        }));
        toast.success("Dados do CNPJ carregados com sucesso!");
      }
    } catch (error) {
      toast.error("Erro ao buscar dados do CNPJ");
    } finally {
      setBuscandoCnpj(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Limpar formatação antes de validar e salvar
      const cleanData = {
        ...formData,
        cnpj: unmask(formData.cnpj),
        cep: unmask(formData.cep),
        telefone: unmask(formData.telefone),
      };
      
      const validatedData = clienteSchema.parse(cleanData);
      
      if (editingId) {
        updateMutation.mutate({ id: editingId, data: validatedData as any });
      } else {
        createMutation.mutate(validatedData as any);
      }
    } catch (error: any) {
      if (error.issues) {
        const firstError = error.issues[0];
        toast.error(`${firstError.path.join('.')}: ${firstError.message}`);
      } else {
        toast.error("Erro ao validar dados");
      }
    }
  };

  const handleEdit = (cliente: any) => {
    setFormData({
      nome: cliente.nome,
      cnpj: maskCNPJ(cliente.cnpj || ""),
      razao_social: cliente.razao_social || "",
      nome_fantasia: cliente.nome_fantasia || "",
      endereco: cliente.endereco || "",
      cidade: cliente.cidade || "",
      uf: cliente.uf || "",
      cep: maskCEP(cliente.cep || ""),
      telefone: maskPhone(cliente.telefone || ""),
      email: cliente.email || "",
      situacao: cliente.situacao || "",
      atividade_principal: cliente.atividade_principal || "",
      observacoes: cliente.observacoes || "",
    });
    setEditingId(cliente.id);
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">Carregando permissões...</p>
          </div>
        </div>
      ) : !canView ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <div className="text-4xl">🔒</div>
            <h2 className="text-xl font-semibold">Acesso Negado</h2>
            <p className="text-muted-foreground">
              Você não tem permissão para visualizar clientes.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Clientes</h1>
              <p className="text-muted-foreground mt-2">
                Gerencie os clientes do sistema
              </p>
            </div>
            {canCreate && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button onClick={resetForm}>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Cliente
                  </Button>
                </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Editar Cliente" : "Novo Cliente"}
              </DialogTitle>
              <DialogDescription>
                {editingId ? "Edite as informações do cliente" : "Adicione um novo cliente ao sistema"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <div className="flex gap-2">
                  <Input
                    id="cnpj"
                    placeholder="00.000.000/0000-00"
                    value={formData.cnpj}
                    onChange={(e) =>
                      setFormData({ ...formData, cnpj: maskCNPJ(e.target.value) })
                    }
                    onBlur={(e) => buscarDadosCnpj(e.target.value)}
                    maxLength={18}
                    required
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => buscarDadosCnpj(formData.cnpj)}
                    disabled={buscandoCnpj}
                  >
                    {buscandoCnpj ? "Buscando..." : "Buscar"}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="razao_social">Razão Social</Label>
                  <Input
                    id="razao_social"
                    value={formData.razao_social}
                    onChange={(e) =>
                      setFormData({ ...formData, razao_social: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
                  <Input
                    id="nome_fantasia"
                    value={formData.nome_fantasia}
                    onChange={(e) =>
                      setFormData({ ...formData, nome_fantasia: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nome">Nome (Identificação)</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) =>
                    setFormData({ ...formData, nome: e.target.value })
                  }
                  required
                  placeholder="Nome usado para identificação no sistema"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endereco">Endereço</Label>
                <Input
                  id="endereco"
                  value={formData.endereco}
                  onChange={(e) =>
                    setFormData({ ...formData, endereco: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2 col-span-1">
                  <Label htmlFor="cep">CEP</Label>
                  <Input
                    id="cep"
                    placeholder="00000-000"
                    value={formData.cep}
                    onChange={(e) =>
                      setFormData({ ...formData, cep: maskCEP(e.target.value) })
                    }
                    maxLength={9}
                  />
                </div>
                <div className="space-y-2 col-span-1">
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input
                    id="cidade"
                    value={formData.cidade}
                    onChange={(e) =>
                      setFormData({ ...formData, cidade: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2 col-span-1">
                  <Label htmlFor="uf">UF</Label>
                  <Input
                    id="uf"
                    maxLength={2}
                    value={formData.uf}
                    onChange={(e) =>
                      setFormData({ ...formData, uf: e.target.value.toUpperCase() })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    placeholder="(00) 00000-0000"
                    value={formData.telefone}
                    onChange={(e) =>
                      setFormData({ ...formData, telefone: maskPhone(e.target.value) })
                    }
                    maxLength={15}
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
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="situacao">Situação</Label>
                  <Input
                    id="situacao"
                    value={formData.situacao}
                    onChange={(e) =>
                      setFormData({ ...formData, situacao: e.target.value })
                    }
                    readOnly
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="atividade_principal">Atividade Principal</Label>
                  <Input
                    id="atividade_principal"
                    value={formData.atividade_principal}
                    onChange={(e) =>
                      setFormData({ ...formData, atividade_principal: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) =>
                    setFormData({ ...formData, observacoes: e.target.value })
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
              <TableHead>CNPJ</TableHead>
              <TableHead>Razão Social</TableHead>
              <TableHead>Cidade/UF</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>Data de Criação</TableHead>
              <TableHead>Última Atualização</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingClientes ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Carregando clientes...
                </TableCell>
              </TableRow>
            ) : clientes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Nenhum cliente cadastrado
                </TableCell>
              </TableRow>
            ) : (
              clientes.map((cliente: any) => (
                <TableRow key={cliente.id}>
                  <TableCell className="font-medium">{cliente.nome}</TableCell>
                  <TableCell>{maskCNPJ(cliente.cnpj || "")}</TableCell>
                  <TableCell>{cliente.razao_social || "-"}</TableCell>
                  <TableCell>
                    {cliente.cidade && cliente.uf
                      ? `${cliente.cidade}/${cliente.uf}`
                      : cliente.cidade || cliente.uf || "-"}
                  </TableCell>
                  <TableCell>{cliente.situacao || "-"}</TableCell>
                  <TableCell>
                    {cliente.created_at ? (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(cliente.created_at), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {cliente.updated_at ? (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(cliente.updated_at), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(cliente)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(cliente.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      {!canEdit && !canDelete && (
                        <span className="text-xs text-muted-foreground px-3">-</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      </>
      )}
    </div>
  );
}
