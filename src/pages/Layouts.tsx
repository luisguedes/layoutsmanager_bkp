import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getApiUrl } from "@/lib/config";

const API_URL = getApiUrl();
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { usePermissions } from "@/hooks/usePermissions";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Copy, ArrowLeftRight, Image as ImageIcon, Search, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import { SearchableLayoutSelect } from "@/components/SearchableLayoutSelect";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function Layouts() {
  const { user, session } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { hasPermission } = usePermissions();
  
  const canView = isAdmin || hasPermission('layouts', 'view');
  const canCreate = isAdmin || hasPermission('layouts', 'create');
  const canEdit = isAdmin || hasPermission('layouts', 'edit');
  const canDelete = isAdmin || hasPermission('layouts', 'delete');
  
  const [open, setOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingLayoutId, setEditingLayoutId] = useState<string | null>(null);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [selectedLayoutForClone, setSelectedLayoutForClone] = useState<string>("");
  const [targetClientForClone, setTargetClientForClone] = useState<string>("");
  const [layoutsForCompare, setLayoutsForCompare] = useState<string[]>(["", ""]);
  const [compareResults, setCompareResults] = useState<any[]>([]);
  
  // Filtros
  const [filterNome, setFilterNome] = useState("");
  const [filterClientes, setFilterClientes] = useState<string[]>([]);
  const [filterModelos, setFilterModelos] = useState<string[]>([]);
  const [filterTipos, setFilterTipos] = useState<string[]>([]);
  const [filterCampos, setFilterCampos] = useState<string[]>([]);
  
  const [formData, setFormData] = useState({
    cliente_id: "",
    modelo_id: "",
    tipo_impressao_id: "",
    nome: "",
  });

  const [imagemFile, setImagemFile] = useState<File | null>(null);
  const [imagemUrl, setImagemUrl] = useState<string | null>(null);
  const [selectedCampos, setSelectedCampos] = useState<Array<{ campoId: string; ordem: number; obrigatorio: boolean }>>([]);

  const queryClient = useQueryClient();

  const { data: layouts = [] } = useQuery({
    queryKey: ["layouts"],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/layouts`, {
        headers: {
          'Authorization': `Bearer ${session.token}`,
        },
      });
      if (!response.ok) throw new Error('Erro ao buscar layouts');
      return response.json();
    },
    enabled: canView && !!session,
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/clientes`, {
        headers: {
          'Authorization': `Bearer ${session.token}`,
        },
      });
      if (!response.ok) throw new Error('Erro ao buscar clientes');
      return response.json();
    },
    enabled: !!session,
  });

  const { data: modelos = [] } = useQuery({
    queryKey: ["modelos"],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/modelos`, {
        headers: {
          'Authorization': `Bearer ${session.token}`,
        },
      });
      if (!response.ok) throw new Error('Erro ao buscar modelos');
      return response.json();
    },
    enabled: !!session,
  });

  const { data: tipos = [] } = useQuery({
    queryKey: ["tipos"],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/tipos`, {
        headers: {
          'Authorization': `Bearer ${session.token}`,
        },
      });
      if (!response.ok) throw new Error('Erro ao buscar tipos');
      return response.json();
    },
    enabled: !!session,
  });

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
    enabled: !!session,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const layoutData = {
        nome: formData.nome,
        cliente_id: formData.cliente_id,
        modelo_id: formData.modelo_id,
        tipo_impressao_id: formData.tipo_impressao_id,
        campos: selectedCampos,
      };

      let layoutId = editingLayoutId;

      if (editMode && editingLayoutId) {
        const response = await fetch(`${API_URL}/layouts/${editingLayoutId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.token}`,
          },
          body: JSON.stringify(layoutData),
        });
        
        if (!response.ok) throw new Error('Erro ao atualizar layout');
      } else {
        const response = await fetch(`${API_URL}/layouts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.token}`,
          },
          body: JSON.stringify(layoutData),
        });
        
        if (!response.ok) throw new Error('Erro ao criar layout');
        const result = await response.json();
        layoutId = result.id;
      }

      // Upload da imagem se houver (tanto para criar quanto para editar)
      if (imagemFile && layoutId) {
        const reader = new FileReader();
        reader.readAsDataURL(imagemFile);
        
        await new Promise((resolve, reject) => {
          reader.onload = async () => {
            try {
              const uploadResponse = await fetch(`${API_URL}/layouts/upload-image`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.token}`,
                },
                body: JSON.stringify({
                  layoutId: layoutId,
                  imageData: reader.result,
                  imageType: imagemFile.type,
                }),
              });
              
              if (!uploadResponse.ok) throw new Error('Erro ao fazer upload da imagem');
              resolve(true);
            } catch (error) {
              reject(error);
            }
          };
          reader.onerror = reject;
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["layouts"] });
      toast.success(editMode ? "Layout atualizado com sucesso!" : "Layout criado com sucesso!");
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(editMode ? "Erro ao atualizar layout" : "Erro ao criar layout");
      console.error(error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${API_URL}/layouts/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.token}`,
        },
      });
      if (!response.ok) throw new Error('Erro ao excluir layout');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["layouts"] });
      toast.success("Layout excluído com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao excluir layout");
    },
  });

  const cloneMutation = useMutation({
    mutationFn: async ({
      origem_layout_id,
      destino_cliente_id,
    }: {
      origem_layout_id: string;
      destino_cliente_id: string;
    }) => {
      const response = await fetch(`${API_URL}/rpc/clone-layout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`,
        },
        body: JSON.stringify({ origem_layout_id, destino_cliente_id }),
      });
      
      if (!response.ok) throw new Error('Erro ao clonar layout');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["layouts"] });
      toast.success("Layout clonado com sucesso!");
      setCloneDialogOpen(false);
      setSelectedLayoutForClone("");
      setTargetClientForClone("");
    },
    onError: () => {
      toast.error("Erro ao clonar layout");
    },
  });

  const handleCompare = async () => {
    const validLayouts = layoutsForCompare.filter(id => id !== "");
    
    if (validLayouts.length < 2) {
      toast.error("Selecione pelo menos 2 layouts para comparar");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/rpc/comparar-multiplos-layouts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`,
        },
        body: JSON.stringify({ layout_ids: validLayouts }),
      });

      if (!response.ok) throw new Error('Erro ao comparar layouts');

      const data = await response.json();
      setCompareResults(data || []);
      toast.success(`${validLayouts.length} layouts comparados com sucesso`);
    } catch (error: any) {
      console.error("Erro ao comparar layouts:", error);
      toast.error(`Erro ao comparar layouts: ${error.message}`);
    }
  };

  const addLayoutToCompare = () => {
    setLayoutsForCompare([...layoutsForCompare, ""]);
  };

  const removeLayoutFromCompare = (index: number) => {
    if (layoutsForCompare.length > 2) {
      setLayoutsForCompare(layoutsForCompare.filter((_, i) => i !== index));
    }
  };

  const updateLayoutForCompare = (index: number, value: string) => {
    const newLayouts = [...layoutsForCompare];
    newLayouts[index] = value;
    setLayoutsForCompare(newLayouts);
  };

  const getAvailableLayoutsForCompare = (currentIndex: number) => {
    const selectedIds = layoutsForCompare.filter((id, idx) => id !== "" && idx !== currentIndex);
    return layouts.filter((layout: any) => !selectedIds.includes(layout.id));
  };

  const resetForm = () => {
    setOpen(false);
    setEditMode(false);
    setEditingLayoutId(null);
    setFormData({
      cliente_id: "",
      modelo_id: "",
      tipo_impressao_id: "",
      nome: "",
    });
    setImagemFile(null);
    setImagemUrl(null);
    setSelectedCampos([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate();
  };

  const handleEdit = (layout: any) => {
    setEditMode(true);
    setEditingLayoutId(layout.id);
    setFormData({
      nome: layout.nome,
      cliente_id: layout.cliente_id,
      modelo_id: layout.modelo_id,
      tipo_impressao_id: layout.tipo_impressao_id,
    });
    
    // Verificar se tem imagem no banco (bytea) e adicionar cache-busting
    if (layout.imagem_data) {
      setImagemUrl(`${API_URL}/layouts/${layout.id}/image?t=${layout.updated_at}`);
    } else {
      setImagemUrl(null);
    }
    
    // Carregar campos do layout
    const camposDoLayout = layout.layout_campos?.map((lc: any) => ({
      campoId: lc.campos.id,
      ordem: lc.ordem,
      obrigatorio: lc.obrigatorio,
    })) || [];
    
    
    setSelectedCampos(camposDoLayout);
    setOpen(true);
  };

  const handleClone = () => {
    if (!selectedLayoutForClone || !targetClientForClone) {
      toast.error("Selecione o layout e o cliente destino");
      return;
    }
    cloneMutation.mutate({
      origem_layout_id: selectedLayoutForClone,
      destino_cliente_id: targetClientForClone,
    });
  };

  const toggleCampo = (campoId: string) => {
    setSelectedCampos(prev => {
      const exists = prev.find(c => c.campoId === campoId);
      if (exists) {
        return prev.filter(c => c.campoId !== campoId);
      } else {
        return [...prev, { campoId, ordem: prev.length + 1, obrigatorio: false }];
      }
    });
  };

  const toggleObrigatorio = (campoId: string) => {
    setSelectedCampos(prev =>
      prev.map(c => c.campoId === campoId ? { ...c, obrigatorio: !c.obrigatorio } : c)
    );
  };

  const updateOrdem = (campoId: string, newOrdem: number) => {
    setSelectedCampos(prev =>
      prev.map(c => c.campoId === campoId ? { ...c, ordem: newOrdem } : c)
    );
  };

  // Filtragem de layouts com contador de matches
  const filteredLayoutsWithScore = useMemo(() => {
    // Calcula o total de filtros ativos uma única vez (cada item selecionado conta como 1)
    let totalActiveFilters = 0;
    if (filterNome) totalActiveFilters++;
    totalActiveFilters += filterClientes.length;
    totalActiveFilters += filterModelos.length;
    totalActiveFilters += filterTipos.length;
    totalActiveFilters += filterCampos.length;
    
    const results = layouts.map((layout: any) => {
      let matchCount = 0;
      
      // Verificar filtro de nome
      if (filterNome && layout.nome.toLowerCase().includes(filterNome.toLowerCase())) {
        matchCount++;
      }
      
      // Verificar filtro de cliente (só conta se o cliente do layout está nos selecionados)
      if (filterClientes.length > 0 && filterClientes.includes(layout.cliente_id)) {
        matchCount++;
      }
      
      // Verificar filtro de modelo (só conta se o modelo do layout está nos selecionados)
      if (filterModelos.length > 0 && filterModelos.includes(layout.modelo_id)) {
        matchCount++;
      }
      
      // Verificar filtro de tipo (só conta se o tipo do layout está nos selecionados)
      if (filterTipos.length > 0 && filterTipos.includes(layout.tipo_impressao_id)) {
        matchCount++;
      }
      
      // Verificar filtro de campos (conta quantos campos selecionados o layout possui)
      if (filterCampos.length > 0) {
        const layoutCamposIds = layout.layout_campos?.map((lc: any) => lc.campos.id) || [];
        const matchedCampos = filterCampos.filter(campoId => layoutCamposIds.includes(campoId));
        matchCount += matchedCampos.length;
      }
      
      return {
        ...layout,
        matchCount,
        totalActiveFilters,
      };
    }).filter(layout => {
      // Se não há filtros ativos, mostrar todos
      if (totalActiveFilters === 0) return true;
      // Se há filtros ativos, mostrar apenas layouts com pelo menos 1 match
      return layout.matchCount > 0;
    });
    
    return results;
  }, [layouts, filterNome, filterClientes, filterModelos, filterTipos, filterCampos]);
  
  const filteredLayouts = filteredLayoutsWithScore;

  const hasActiveFilters = filterNome || filterClientes.length > 0 || filterModelos.length > 0 || filterTipos.length > 0 || filterCampos.length > 0;

  const clearAllFilters = () => {
    setFilterNome("");
    setFilterClientes([]);
    setFilterModelos([]);
    setFilterTipos([]);
    setFilterCampos([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Layouts</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie os layouts de impressão
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setCompareDialogOpen(true)}
          >
            <ArrowLeftRight className="h-4 w-4 mr-2" />
            Comparar
          </Button>
          {canCreate && (
            <>
              <Button
                variant="outline"
                onClick={() => setCloneDialogOpen(true)}
              >
                <Copy className="h-4 w-4 mr-2" />
                Clonar
              </Button>
              <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button onClick={resetForm}>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Layout
                  </Button>
                </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editMode ? "Editar Layout" : "Novo Layout"}</DialogTitle>
                <DialogDescription>
                  {editMode ? "Edite as informações do layout" : "Crie um novo layout para o cliente"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
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
                    <Label htmlFor="cliente">Cliente</Label>
                    <Select
                      value={formData.cliente_id}
                      onValueChange={(value) =>
                        setFormData({ ...formData, cliente_id: value })
                      }
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {clientes.map((cliente: any) => (
                          <SelectItem key={cliente.id} value={cliente.id}>
                            {cliente.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="modelo">Modelo</Label>
                    <Select
                      value={formData.modelo_id}
                      onValueChange={(value) =>
                        setFormData({ ...formData, modelo_id: value })
                      }
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um modelo" />
                      </SelectTrigger>
                      <SelectContent>
                        {modelos.map((modelo: any) => (
                          <SelectItem key={modelo.id} value={modelo.id}>
                            {modelo.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tipo">Tipo de Impressão</Label>
                    <Select
                      value={formData.tipo_impressao_id}
                      onValueChange={(value) =>
                        setFormData({ ...formData, tipo_impressao_id: value })
                      }
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {tipos.map((tipo: any) => (
                          <SelectItem key={tipo.id} value={tipo.id}>
                            {tipo.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="imagem">Imagem do Layout</Label>
                  <Input
                    id="imagem"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setImagemFile(file);
                        // Limpar a URL antiga para mostrar preview da nova
                        setImagemUrl('');
                      }
                    }}
                  />
                  {(imagemUrl || imagemFile) && (
                    <div className="mt-2">
                      <img 
                        src={imagemFile ? URL.createObjectURL(imagemFile) : imagemUrl} 
                        alt="Preview" 
                        className="max-h-32 rounded border" 
                      />
                      {imagemFile && (
                        <p className="text-sm text-muted-foreground mt-1">Nova imagem selecionada</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <Label>Campos do Layout</Label>
                  <div className="border rounded-lg p-4 max-h-64 overflow-y-auto space-y-2">
                    {campos.map((campo: any) => {
                      const selected = selectedCampos.find(c => c.campoId === campo.id);
                      return (
                        <div key={campo.id} className="flex items-center gap-4 p-2 hover:bg-accent/50 rounded">
                          <Checkbox
                            id={`campo-${campo.id}`}
                            checked={!!selected}
                            onCheckedChange={() => toggleCampo(campo.id)}
                          />
                          <Label
                            htmlFor={`campo-${campo.id}`}
                            className="flex-1 cursor-pointer"
                          >
                            {campo.nome}
                          </Label>
                          {selected && (
                            <>
                              <div className="flex items-center gap-2">
                                <Label htmlFor={`ordem-${campo.id}`} className="text-xs text-muted-foreground">
                                  Ordem:
                                </Label>
                                <Input
                                  id={`ordem-${campo.id}`}
                                  type="number"
                                  min="1"
                                  value={selected.ordem}
                                  onChange={(e) => updateOrdem(campo.id, parseInt(e.target.value) || 1)}
                                  className="w-16 h-8"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`obrig-${campo.id}`}
                                  checked={selected.obrigatorio}
                                  onCheckedChange={() => toggleObrigatorio(campo.id)}
                                />
                                <Label
                                  htmlFor={`obrig-${campo.id}`}
                                  className="text-xs text-muted-foreground cursor-pointer"
                                >
                                  Obrigatório
                                </Label>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {selectedCampos.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {selectedCampos.length} campo{selectedCampos.length !== 1 ? 's' : ''} selecionado{selectedCampos.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Salvando..." : (editMode ? "Atualizar" : "Criar")}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
            </>
          )}
        </div>
      </div>

      {/* Clone Dialog */}
      <Dialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clonar Layout</DialogTitle>
            <DialogDescription>
              Selecione o layout de origem e o cliente de destino para clonar
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Layout Origem</Label>
              <Select
                value={selectedLayoutForClone}
                onValueChange={setSelectedLayoutForClone}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um layout" />
                </SelectTrigger>
                <SelectContent>
                  {layouts.map((layout: any) => (
                    <SelectItem key={layout.id} value={layout.id}>
                      {layout.clientes.nome} - {layout.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cliente Destino</Label>
              <Select
                value={targetClientForClone}
                onValueChange={setTargetClientForClone}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((cliente: any) => (
                    <SelectItem key={cliente.id} value={cliente.id}>
                      {cliente.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleClone} className="w-full">
              Clonar Layout
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Compare Dialog */}
      <Dialog open={compareDialogOpen} onOpenChange={setCompareDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Comparar Layouts</DialogTitle>
            <DialogDescription>
              Selecione até 5 layouts para comparar seus campos
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              {layoutsForCompare.map((selectedLayout, index) => (
                <div key={index} className="flex gap-2 items-end">
                  <div className="flex-1 space-y-2">
                    <Label>Layout {index + 1}</Label>
                    <SearchableLayoutSelect
                      layouts={getAvailableLayoutsForCompare(index)}
                      value={selectedLayout}
                      onValueChange={(value) => updateLayoutForCompare(index, value)}
                      placeholder="Buscar e selecionar layout..."
                    />
                  </div>
                  {layoutsForCompare.length > 2 && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => removeLayoutFromCompare(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                onClick={addLayoutToCompare}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Layout para Comparar
              </Button>
            </div>
            
            <Button onClick={handleCompare} className="w-full">
              Comparar Layouts
            </Button>

            {compareResults.length > 0 && (
              <div className="border rounded-lg mt-4 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-10">Campo</TableHead>
                      {layoutsForCompare
                        .filter(id => id !== "")
                        .map((layoutId, index) => {
                          const layout = layouts.find((l: any) => l.id === layoutId);
                          return (
                            <TableHead key={layoutId} className="text-center min-w-[200px]">
                              {layout?.clientes?.nome} - {layout?.nome}
                            </TableHead>
                          );
                        })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {compareResults.map((result: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium sticky left-0 bg-background">
                          {result.campo_nome}
                        </TableCell>
                        {result.layout_data.map((layoutInfo: any, idx: number) => (
                          <TableCell key={idx} className="text-center">
                            {layoutInfo.possui ? (
                              <div className="space-y-1">
                                <Badge variant="default">
                                  Ordem: {layoutInfo.ordem}
                                </Badge>
                                {layoutInfo.obrigatorio && (
                                  <Badge variant="secondary" className="block">
                                    Obrigatório
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <Badge variant="outline">Não possui</Badge>
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Filtros */}
      <div className="border rounded-lg bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">Filtros Avançados</h3>
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Limpar todos
            </Button>
          )}
        </div>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="filter-nome">Nome do Layout</Label>
            <div className="relative">
              <Input
                id="filter-nome"
                placeholder="Buscar por nome..."
                value={filterNome}
                onChange={(e) => setFilterNome(e.target.value)}
                className="pr-8"
              />
              {filterNome && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-2"
                  onClick={() => setFilterNome("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MultiSelectFilter
              label="Clientes"
              options={clientes.map((c: any) => ({ id: c.id, nome: c.nome }))}
              selectedIds={filterClientes}
              onChange={setFilterClientes}
              placeholder="Todos os clientes"
            />
            
            <MultiSelectFilter
              label="Modelos"
              options={modelos.map((m: any) => ({ id: m.id, nome: m.nome }))}
              selectedIds={filterModelos}
              onChange={setFilterModelos}
              placeholder="Todos os modelos"
            />
            
            <MultiSelectFilter
              label="Tipos de Impressão"
              options={tipos.map((t: any) => ({ id: t.id, nome: t.nome }))}
              selectedIds={filterTipos}
              onChange={setFilterTipos}
              placeholder="Todos os tipos"
            />
            
            <MultiSelectFilter
              label="Campos"
              options={campos.map((c: any) => ({ id: c.id, nome: c.nome }))}
              selectedIds={filterCampos}
              onChange={setFilterCampos}
              placeholder="Todos os campos"
            />
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t">
            <p className="text-sm text-muted-foreground">
              {filteredLayouts.length} layout{filteredLayouts.length !== 1 ? 's' : ''} encontrado{filteredLayouts.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

      <div className="border rounded-lg bg-card">
        <TooltipProvider>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Imagem</TableHead>
                <TableHead className="text-center">Campos</TableHead>
                {hasActiveFilters && <TableHead className="text-center">Filtros Encontrados</TableHead>}
                <TableHead>Criado por</TableHead>
                <TableHead>Última edição</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
          <TableBody>
            {filteredLayouts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={hasActiveFilters ? 10 : 9} className="text-center text-muted-foreground">
                  {layouts.length === 0 ? "Nenhum layout cadastrado" : "Nenhum layout encontrado com os filtros aplicados"}
                </TableCell>
              </TableRow>
            ) : (
              filteredLayouts.map((layout: any) => (
                <TableRow key={layout.id}>
                  <TableCell className="font-medium">{layout.nome}</TableCell>
                  <TableCell>{layout.clientes.nome}</TableCell>
                  <TableCell>{layout.modelos.nome}</TableCell>
                  <TableCell>{layout.tipos_impressao.nome}</TableCell>
                  <TableCell>
                    {layout.imagem_data ? (
                      <HoverCard openDelay={200}>
                        <HoverCardTrigger asChild>
                          <img 
                            src={`${API_URL}/layouts/${layout.id}/image?t=${layout.updated_at}`}
                            alt={layout.nome}
                            className="h-12 w-12 object-cover rounded border cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                            onClick={() => window.open(`${API_URL}/layouts/${layout.id}/image?t=${layout.updated_at}`, '_blank')}
                          />
                        </HoverCardTrigger>
                        <HoverCardContent side="right" className="w-auto p-2">
                          <img 
                            src={`${API_URL}/layouts/${layout.id}/image?t=${layout.updated_at}`}
                            alt={layout.nome}
                            className="max-w-md max-h-96 object-contain rounded"
                          />
                        </HoverCardContent>
                      </HoverCard>
                    ) : (
                      <div className="h-12 w-12 flex items-center justify-center bg-muted rounded border">
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-block cursor-help">
                          <Badge variant="secondary">
                            {layout.layout_campos?.length || 0}
                          </Badge>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        {layout.layout_campos && layout.layout_campos.length > 0 ? (
                          <div className="space-y-1">
                            <p className="font-semibold text-xs mb-2">Campos do Layout:</p>
                            <ul className="space-y-1">
                              {layout.layout_campos
                                .sort((a: any, b: any) => a.ordem - b.ordem)
                                .map((lc: any) => (
                                  <li key={lc.id} className="text-xs flex items-center gap-2">
                                    <span className="text-muted-foreground">{lc.ordem}.</span>
                                    <span>{lc.campos.nome}</span>
                                    {lc.obrigatorio && (
                                      <Badge variant="outline" className="text-[10px] py-0 px-1 h-4">
                                        Obrigatório
                                      </Badge>
                                    )}
                                  </li>
                                ))}
                            </ul>
                          </div>
                        ) : (
                          <p className="text-xs">Nenhum campo cadastrado</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  {hasActiveFilters && (
                    <TableCell className="text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-block cursor-help">
                            <Badge 
                              variant={layout.matchCount === layout.totalActiveFilters ? "default" : "outline"}
                              className="font-semibold"
                            >
                              {layout.matchCount}/{layout.totalActiveFilters}
                            </Badge>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <div className="space-y-2">
                            <p className="font-semibold text-xs">Filtros Encontrados:</p>
                            {filterNome && layout.nome.toLowerCase().includes(filterNome.toLowerCase()) && (
                              <div className="text-xs">
                                <span className="text-muted-foreground">Nome:</span> {layout.nome}
                              </div>
                            )}
                            {filterClientes.length > 0 && filterClientes.includes(layout.cliente_id) && (
                              <div className="text-xs">
                                <span className="text-muted-foreground">Cliente:</span> {layout.clientes.nome}
                              </div>
                            )}
                            {filterModelos.length > 0 && filterModelos.includes(layout.modelo_id) && (
                              <div className="text-xs">
                                <span className="text-muted-foreground">Modelo:</span> {layout.modelos.nome}
                              </div>
                            )}
                            {filterTipos.length > 0 && filterTipos.includes(layout.tipo_impressao_id) && (
                              <div className="text-xs">
                                <span className="text-muted-foreground">Tipo:</span> {layout.tipos_impressao.nome}
                              </div>
                            )}
                            {filterCampos.length > 0 && (
                              <div className="text-xs">
                                <span className="text-muted-foreground">Campos encontrados:</span>
                                <ul className="mt-1 space-y-0.5 ml-2">
                                  {layout.layout_campos
                                    ?.filter((lc: any) => filterCampos.includes(lc.campos.id))
                                    .map((lc: any) => (
                                      <li key={lc.id}>• {lc.campos.nome}</li>
                                    ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                  )}
                  <TableCell>
                    {layout.created_profile_nome ? (
                      <Tooltip>
                        <TooltipTrigger>
                          <span className="text-xs text-muted-foreground">
                            {layout.created_profile_nome}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {layout.created_at && (
                            <p className="text-xs">
                              {format(new Date(layout.created_at), "dd/MM/yyyy HH:mm", {
                                locale: ptBR,
                              })}
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {layout.updated_profile_nome ? (
                      <Tooltip>
                        <TooltipTrigger>
                          <span className="text-xs text-muted-foreground">
                            {layout.updated_profile_nome}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {layout.updated_at && (
                            <p className="text-xs">
                              {format(new Date(layout.updated_at), "dd/MM/yyyy HH:mm", {
                                locale: ptBR,
                              })}
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(layout)}
                          title="Editar layout"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(layout.id)}
                          title="Excluir layout"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </TooltipProvider>
      </div>
    </div>
  );
}
