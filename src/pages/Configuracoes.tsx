import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getApiUrl } from "@/lib/config";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Settings, Edit, Users, Globe, Loader2, CheckCircle2, XCircle, Building2, Upload, X, Cog, Download, FileText, Moon, Sun, Monitor } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { UserPermissionsDialog } from "@/components/UserPermissionsDialog";
import { EditUserDialog } from "@/components/EditUserDialog";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { maskPhone, maskCNPJ, maskCEP, unmask } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

const API_URL = getApiUrl();

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

interface ProxyConfig {
  enabled: boolean;
  host: string;
  port: string;
  username: string;
  password: string;
  protocol: string;
}

interface CompanyConfig {
  nome: string;
  razao_social: string;
  cnpj: string;
  endereco: string;
  cidade: string;
  uf: string;
  cep: string;
  telefone: string;
  email: string;
  logo: string;
}

// Audit Logs Table Component
function AuditLogsTable() {
  const { session } = useAuth();
  const API_URL = getApiUrl();

  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/audit-logs?limit=50`, {
        headers: {
          'Authorization': `Bearer ${session?.token}`,
        },
      });
      
      if (!response.ok) throw new Error('Erro ao buscar logs');
      return response.json();
    },
    enabled: !!session,
  });

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case 'INSERT': return 'default';
      case 'UPDATE': return 'secondary';
      case 'DELETE': return 'destructive';
      default: return 'outline';
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'INSERT': return 'Criação';
      case 'UPDATE': return 'Alteração';
      case 'DELETE': return 'Exclusão';
      default: return action;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!auditLogs || auditLogs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum registro de auditoria encontrado.
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data/Hora</TableHead>
            <TableHead>Tabela</TableHead>
            <TableHead>Ação</TableHead>
            <TableHead>Usuário</TableHead>
            <TableHead>Detalhes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {auditLogs.map((log: any) => (
            <TableRow key={log.id}>
              <TableCell className="text-xs">
                {format(new Date(log.changed_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
              </TableCell>
              <TableCell className="font-mono text-xs">{log.table_name}</TableCell>
              <TableCell>
                <Badge variant={getActionBadgeVariant(log.action)}>
                  {getActionLabel(log.action)}
                </Badge>
              </TableCell>
              <TableCell className="text-xs">{log.profile_nome || 'Sistema'}</TableCell>
              <TableCell className="text-xs max-w-[200px] truncate">
                {log.action === 'DELETE' && log.old_data?.nome}
                {log.action === 'INSERT' && log.new_data?.nome}
                {log.action === 'UPDATE' && log.new_data?.nome}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

export default function Configuracoes() {
  const { session } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State for tabs
  const [activeTab, setActiveTab] = useState("empresa");

  // State for user dialogs
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

  // State for proxy config
  const [proxyConfig, setProxyConfig] = useState<ProxyConfig>({
    enabled: false,
    host: "",
    port: "",
    username: "",
    password: "",
    protocol: "http",
  });
  const [testingProxy, setTestingProxy] = useState(false);
  const [proxyTestResult, setProxyTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // State for company config
  const [companyConfig, setCompanyConfig] = useState<CompanyConfig>({
    nome: "",
    razao_social: "",
    cnpj: "",
    endereco: "",
    cidade: "",
    uf: "",
    cep: "",
    telefone: "",
    email: "",
    logo: "",
  });
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Fetch users
  const { data: profiles, isLoading: loadingUsers } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/usuarios`, {
        headers: {
          'Authorization': `Bearer ${session?.token}`,
        },
      });
      
      if (!response.ok) throw new Error('Erro ao buscar usuários');
      return response.json();
    },
    enabled: !!session,
  });

  // Fetch proxy config
  const { data: savedProxyConfig, isLoading: loadingProxy } = useQuery({
    queryKey: ["proxy-config"],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/config/proxy`, {
        headers: {
          'Authorization': `Bearer ${session?.token}`,
        },
      });
      
      if (!response.ok) throw new Error('Erro ao buscar configuração de proxy');
      return response.json();
    },
    enabled: !!session && isAdmin,
  });

  // Fetch company config
  const { data: savedCompanyConfig, isLoading: loadingCompany } = useQuery({
    queryKey: ["company-config"],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/config/company`, {
        headers: {
          'Authorization': `Bearer ${session?.token}`,
        },
      });
      
      if (!response.ok) throw new Error('Erro ao buscar configuração da empresa');
      return response.json();
    },
    enabled: !!session && isAdmin,
  });

  // Update proxy state when data is fetched
  if (savedProxyConfig && proxyConfig.host === "" && savedProxyConfig.host) {
    setProxyConfig(savedProxyConfig);
  }

  // Update company state when data is fetched
  if (savedCompanyConfig && companyConfig.nome === "" && savedCompanyConfig.nome) {
    setCompanyConfig(savedCompanyConfig);
  }

  // Toggle user active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const response = await fetch(`${API_URL}/usuarios/${id}/toggle-active`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.token}`,
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

  // Save proxy config mutation
  const saveProxyMutation = useMutation({
    mutationFn: async (config: ProxyConfig) => {
      const response = await fetch(`${API_URL}/config/proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.token}`,
        },
        body: JSON.stringify(config),
      });
      
      if (!response.ok) throw new Error('Erro ao salvar configuração de proxy');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proxy-config"] });
      toast({
        title: "Configuração de proxy salva",
        description: "As configurações foram atualizadas com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar configuração",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Save company config mutation
  const saveCompanyMutation = useMutation({
    mutationFn: async (config: CompanyConfig) => {
      const response = await fetch(`${API_URL}/config/company`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.token}`,
        },
        body: JSON.stringify({
          ...config,
          telefone: unmask(config.telefone),
        }),
      });
      
      if (!response.ok) throw new Error('Erro ao salvar configuração da empresa');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-config"] });
      toast({
        title: "Dados da empresa salvos",
        description: "As informações foram atualizadas com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar dados da empresa",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Test proxy connection
  const testProxyConnection = async () => {
    setTestingProxy(true);
    setProxyTestResult(null);
    
    try {
      const response = await fetch(`${API_URL}/config/proxy/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.token}`,
        },
        body: JSON.stringify(proxyConfig),
      });
      
      const result = await response.json();
      setProxyTestResult({
        success: result.success,
        message: result.message || (result.success ? 'Conexão estabelecida com sucesso!' : 'Falha na conexão'),
      });
    } catch (error: any) {
      setProxyTestResult({
        success: false,
        message: error.message || 'Erro ao testar conexão',
      });
    } finally {
      setTestingProxy(false);
    }
  };

  // Handle logo upload
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O logo deve ter no máximo 2MB.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setCompanyConfig({ ...companyConfig, logo: base64 });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Configurações</h1>
          <p className="text-muted-foreground">
            Gerencie as configurações do sistema
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-[800px]">
          <TabsTrigger value="empresa" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Empresa
          </TabsTrigger>
          <TabsTrigger value="usuarios" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="sistema" className="flex items-center gap-2">
            <Cog className="h-4 w-4" />
            Sistema
          </TabsTrigger>
          <TabsTrigger value="proxy" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Proxy
          </TabsTrigger>
        </TabsList>

        {/* Company Tab */}
        <TabsContent value="empresa" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dados da Empresa</CardTitle>
              <CardDescription>
                Configure as informações da sua empresa que serão exibidas no sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {loadingCompany ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <>
                  {/* Logo Upload */}
                  <div className="space-y-2">
                    <Label>Logo da Empresa</Label>
                    <div className="flex items-center gap-4">
                      {companyConfig.logo ? (
                        <div className="relative">
                          <img
                            src={companyConfig.logo}
                            alt="Logo da empresa"
                            className="h-24 w-24 object-contain rounded-lg border bg-muted p-2"
                          />
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 h-6 w-6"
                            onClick={() => setCompanyConfig({ ...companyConfig, logo: "" })}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="h-24 w-24 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center bg-muted">
                          <Building2 className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                      )}
                      <div>
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                        <Button
                          variant="outline"
                          onClick={() => logoInputRef.current?.click()}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {companyConfig.logo ? "Alterar Logo" : "Carregar Logo"}
                        </Button>
                        <p className="text-xs text-muted-foreground mt-1">
                          PNG, JPG ou SVG. Máximo 2MB.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="company-nome">Nome da Empresa</Label>
                      <Input
                        id="company-nome"
                        placeholder="Nome comercial"
                        value={companyConfig.nome}
                        onChange={(e) =>
                          setCompanyConfig({ ...companyConfig, nome: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="company-razao">Razão Social</Label>
                      <Input
                        id="company-razao"
                        placeholder="Razão social completa"
                        value={companyConfig.razao_social}
                        onChange={(e) =>
                          setCompanyConfig({ ...companyConfig, razao_social: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="company-cnpj">CNPJ</Label>
                      <Input
                        id="company-cnpj"
                        placeholder="00.000.000/0000-00"
                        value={companyConfig.cnpj}
                        onChange={(e) =>
                          setCompanyConfig({ ...companyConfig, cnpj: maskCNPJ(e.target.value) })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="company-telefone">Telefone</Label>
                      <Input
                        id="company-telefone"
                        placeholder="(00) 00000-0000"
                        value={companyConfig.telefone}
                        onChange={(e) =>
                          setCompanyConfig({ ...companyConfig, telefone: maskPhone(e.target.value) })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="company-email">E-mail</Label>
                      <Input
                        id="company-email"
                        type="email"
                        placeholder="contato@empresa.com.br"
                        value={companyConfig.email}
                        onChange={(e) =>
                          setCompanyConfig({ ...companyConfig, email: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="company-cep">CEP</Label>
                      <Input
                        id="company-cep"
                        placeholder="00000-000"
                        value={companyConfig.cep}
                        onChange={(e) =>
                          setCompanyConfig({ ...companyConfig, cep: maskCEP(e.target.value) })
                        }
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="company-endereco">Endereço</Label>
                      <Input
                        id="company-endereco"
                        placeholder="Rua, número, bairro"
                        value={companyConfig.endereco}
                        onChange={(e) =>
                          setCompanyConfig({ ...companyConfig, endereco: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="company-cidade">Cidade</Label>
                      <Input
                        id="company-cidade"
                        placeholder="Cidade"
                        value={companyConfig.cidade}
                        onChange={(e) =>
                          setCompanyConfig({ ...companyConfig, cidade: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="company-uf">UF</Label>
                      <Input
                        id="company-uf"
                        placeholder="UF"
                        maxLength={2}
                        value={companyConfig.uf}
                        onChange={(e) =>
                          setCompanyConfig({ ...companyConfig, uf: e.target.value.toUpperCase() })
                        }
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={() => saveCompanyMutation.mutate(companyConfig)}
                      disabled={saveCompanyMutation.isPending}
                    >
                      {saveCompanyMutation.isPending && (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      )}
                      Salvar Dados da Empresa
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="usuarios" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gestão de Usuários</CardTitle>
              <CardDescription>
                Visualize e gerencie os usuários do sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                    {loadingUsers ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center">
                          <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                          Carregando...
                        </TableCell>
                      </TableRow>
                    ) : profiles && profiles.length > 0 ? (
                      profiles.map((profile: Profile) => (
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Tab */}
        <TabsContent value="sistema" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Theme Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sun className="h-5 w-5" />
                  Tema do Sistema
                </CardTitle>
                <CardDescription>
                  Escolha o tema de cores para a interface
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <Button
                    variant="outline"
                    className="flex flex-col items-center gap-2 h-auto py-4"
                    onClick={() => {
                      document.documentElement.classList.remove('dark');
                      localStorage.setItem('theme', 'light');
                      toast({ title: "Tema claro ativado" });
                    }}
                  >
                    <Sun className="h-6 w-6" />
                    <span className="text-xs">Claro</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="flex flex-col items-center gap-2 h-auto py-4"
                    onClick={() => {
                      document.documentElement.classList.add('dark');
                      localStorage.setItem('theme', 'dark');
                      toast({ title: "Tema escuro ativado" });
                    }}
                  >
                    <Moon className="h-6 w-6" />
                    <span className="text-xs">Escuro</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="flex flex-col items-center gap-2 h-auto py-4"
                    onClick={() => {
                      localStorage.removeItem('theme');
                      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                        document.documentElement.classList.add('dark');
                      } else {
                        document.documentElement.classList.remove('dark');
                      }
                      toast({ title: "Tema do sistema ativado" });
                    }}
                  >
                    <Monitor className="h-6 w-6" />
                    <span className="text-xs">Sistema</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Backup Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Backup e Exportação
                </CardTitle>
                <CardDescription>
                  Exporte o schema do banco de dados para backup ou nova instalação
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Schema do Banco de Dados</h4>
                  <p className="text-sm text-muted-foreground">
                    Exporte o schema SQL completo contendo todas as tabelas, funções, triggers e configurações iniciais.
                    Ideal para instalação em um novo ambiente PostgreSQL.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        window.open('/database_schema.sql', '_blank');
                        toast({ title: "Visualizando schema SQL" });
                      }}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Visualizar Schema
                    </Button>
                    <Button
                      variant="default"
                      onClick={async () => {
                        try {
                          const response = await fetch('/database_schema.sql');
                          const text = await response.text();
                          const blob = new Blob([text], { type: 'application/sql' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `database_schema_${new Date().toISOString().split('T')[0]}.sql`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                          toast({ title: "Download do schema iniciado" });
                        } catch (error) {
                          toast({ 
                            title: "Erro ao baixar schema", 
                            description: "Não foi possível baixar o arquivo.",
                            variant: "destructive" 
                          });
                        }
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Baixar Schema SQL
                    </Button>
                  </div>
                </div>
                
                <div className="border-t pt-4 space-y-2">
                  <h4 className="font-medium text-sm">Informações do Schema</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Tabelas incluídas:</p>
                      <p className="font-mono text-xs">12 tabelas principais</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Funções:</p>
                      <p className="font-mono text-xs">9 funções SQL</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Triggers:</p>
                      <p className="font-mono text-xs">11 triggers automáticos</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Views:</p>
                      <p className="font-mono text-xs">2 views úteis</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Audit Logs Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Logs de Auditoria
              </CardTitle>
              <CardDescription>
                Visualize as últimas ações realizadas no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AuditLogsTable />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Proxy Tab */}
        <TabsContent value="proxy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuração de Proxy</CardTitle>
              <CardDescription>
                Configure o proxy para acesso a APIs externas (como consulta de CNPJ).
                Útil quando o ambiente necessita de proxy para acessar a internet.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {loadingProxy ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="proxy-enabled"
                      checked={proxyConfig.enabled}
                      onCheckedChange={(checked) =>
                        setProxyConfig({ ...proxyConfig, enabled: checked })
                      }
                    />
                    <Label htmlFor="proxy-enabled">
                      Habilitar Proxy
                    </Label>
                  </div>

                  {proxyConfig.enabled && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="proxy-protocol">Protocolo</Label>
                        <select
                          id="proxy-protocol"
                          value={proxyConfig.protocol}
                          onChange={(e) =>
                            setProxyConfig({ ...proxyConfig, protocol: e.target.value })
                          }
                          className="w-full h-10 px-3 rounded-md border border-input bg-background"
                        >
                          <option value="http">HTTP</option>
                          <option value="https">HTTPS</option>
                          <option value="socks5">SOCKS5</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="proxy-host">Host do Proxy</Label>
                        <Input
                          id="proxy-host"
                          placeholder="proxy.empresa.com.br"
                          value={proxyConfig.host}
                          onChange={(e) =>
                            setProxyConfig({ ...proxyConfig, host: e.target.value })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="proxy-port">Porta</Label>
                        <Input
                          id="proxy-port"
                          placeholder="3128"
                          value={proxyConfig.port}
                          onChange={(e) =>
                            setProxyConfig({ ...proxyConfig, port: e.target.value })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="proxy-username">Usuário (opcional)</Label>
                        <Input
                          id="proxy-username"
                          placeholder="usuario"
                          value={proxyConfig.username}
                          onChange={(e) =>
                            setProxyConfig({ ...proxyConfig, username: e.target.value })
                          }
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="proxy-password">Senha (opcional)</Label>
                        <Input
                          id="proxy-password"
                          type="password"
                          placeholder="••••••••"
                          value={proxyConfig.password}
                          onChange={(e) =>
                            setProxyConfig({ ...proxyConfig, password: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  )}

                  {proxyTestResult && (
                    <div
                      className={`flex items-center gap-2 p-3 rounded-lg ${
                        proxyTestResult.success
                          ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                          : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                      }`}
                    >
                      {proxyTestResult.success ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <XCircle className="h-5 w-5" />
                      )}
                      <span>{proxyTestResult.message}</span>
                    </div>
                  )}

                  <div className="flex gap-3">
                    {proxyConfig.enabled && (
                      <Button
                        variant="outline"
                        onClick={testProxyConnection}
                        disabled={testingProxy || !proxyConfig.host || !proxyConfig.port}
                      >
                        {testingProxy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Testar Conexão
                      </Button>
                    )}
                    <Button
                      onClick={() => saveProxyMutation.mutate(proxyConfig)}
                      disabled={saveProxyMutation.isPending}
                    >
                      {saveProxyMutation.isPending && (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      )}
                      Salvar Configurações
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {permissionsDialog && (
        <UserPermissionsDialog
          open={permissionsDialog.open}
          onOpenChange={(open) =>
            open ? null : setPermissionsDialog(null)
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
