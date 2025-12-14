import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Settings, Database, User, Building2, CheckCircle, Download, Loader2, CheckCircle2, AlertCircle, BookOpen, Cloud, Server, Container, Globe, Wifi, WifiOff, Activity, RefreshCw } from "lucide-react";
import { maskCNPJ, maskPhone } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { isDockerEnvironment, getEnvironmentInfo, getApiUrl } from "@/lib/config";
import { useConnectionProbe, ConnectionStatus, ProbeConfig } from "@/hooks/useConnectionProbe";
import { ConnectionStatusBadge } from "@/components/ConnectionStatusBadge";
import { LiveConnectionMonitor } from "@/components/LiveConnectionMonitor";

const setupSchema = z.object({
  // Informações do Administrador
  adminNome: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  adminEmail: z.string().email("Email inválido"),
  adminTelefone: z.string().optional(),
  adminSenha: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
  adminConfirmarSenha: z.string(),
  
  // Environment type
  envType: z.enum(["docker", "standalone"]),
  
  // Server IP configuration (for standalone)
  serverIp: z.string().optional(),
  
  // Database type selection
  dbType: z.enum(["supabase", "postgresql"]),
  
  // Database location (for Docker environments)
  dbLocation: z.enum(["container", "external"]).optional(),
  
  // Database configuration
  dbHost: z.string().optional(),
  dbPort: z.string().optional(),
  dbName: z.string().optional(),
  dbUser: z.string().optional(),
  dbPassword: z.string().optional(),
  dbSsl: z.boolean().optional(),
  
  // Informações da Empresa
  empresaNome: z.string().optional(),
  empresaCNPJ: z.string().optional(),
  empresaTelefone: z.string().optional(),
  empresaEmail: z.string().optional(),
}).refine((data) => data.adminSenha === data.adminConfirmarSenha, {
  message: "As senhas não coincidem",
  path: ["adminConfirmarSenha"],
});

type SetupForm = z.infer<typeof setupSchema>;

const Setup = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [dbConnectionStatus, setDbConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [dbInstallStatus, setDbInstallStatus] = useState<'idle' | 'installing' | 'success' | 'error'>('idle');
  const [backendStatus, setBackendStatus] = useState<'idle' | 'checking' | 'online' | 'offline'>('idle');
  const [previousBackendStatus, setPreviousBackendStatus] = useState<'idle' | 'checking' | 'online' | 'offline'>('idle');
  const [dbConnectionError, setDbConnectionError] = useState<string>('');
  const [autoProbeEnabled, setAutoProbeEnabled] = useState(false);
  const [isCheckingBackend, setIsCheckingBackend] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState<number>(0);
  const [retryAttempt, setRetryAttempt] = useState<number>(0);
  const navigate = useNavigate();
  const { toast } = useToast();

  const envInfo = getEnvironmentInfo();
  const detectedDocker = isDockerEnvironment();

  const form = useForm<SetupForm>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      adminNome: "",
      adminEmail: "",
      adminTelefone: "",
      adminSenha: "",
      adminConfirmarSenha: "",
      envType: detectedDocker ? "docker" : "standalone",
      serverIp: "localhost",
      dbType: detectedDocker ? "postgresql" : "supabase",
      dbLocation: "container",
      dbHost: "localhost",
      dbPort: "5432",
      dbName: "layout_app",
      dbUser: "postgres",
      dbPassword: "",
      empresaNome: "",
      empresaCNPJ: "",
      empresaTelefone: "",
      empresaEmail: "",
    },
  });

  const selectedEnvType = form.watch("envType");
  const selectedDbType = form.watch("dbType");
  const selectedDbLocation = form.watch("dbLocation");
  const watchedDbHost = form.watch("dbHost");
  const watchedDbPort = form.watch("dbPort");
  const watchedDbName = form.watch("dbName");
  const watchedDbUser = form.watch("dbUser");
  const watchedDbPassword = form.watch("dbPassword");
  const watchedServerIp = form.watch("serverIp");

  // Determine effective DB host based on settings
  const getEffectiveDbHost = (): string => {
    const values = form.getValues();
    if (values.envType === 'docker' && values.dbLocation === 'container') {
      return 'postgres'; // Docker container name
    }
    return values.dbHost || 'localhost';
  };

  // Build API URL based on environment type
  const getSetupApiUrl = (): string => {
    const values = form.getValues();
    
    if (values.envType === "docker") {
      // In Docker, use relative /api path (nginx proxies to backend)
      return '/api';
    }
    
    // Standalone: use serverIp
    const serverIp = values.serverIp || 'localhost';
    return `http://${serverIp}:3001/api`;
  };

  // Memoized probe config for live connection monitor
  const probeConfig = useMemo((): ProbeConfig | null => {
    if (selectedDbType !== 'postgresql') return null;
    
    const effectiveHost = selectedEnvType === 'docker' && selectedDbLocation === 'container' 
      ? 'postgres' 
      : watchedDbHost || 'localhost';

    return {
      host: effectiveHost,
      port: watchedDbPort || '5432',
      database: watchedDbName || 'layout_app',
      user: watchedDbUser || 'postgres',
      password: watchedDbPassword || '',
    };
  }, [selectedDbType, selectedEnvType, selectedDbLocation, watchedDbHost, watchedDbPort, watchedDbName, watchedDbUser, watchedDbPassword]);

  // Memoized API URL for probe
  const probeApiUrl = useMemo(() => {
    if (selectedEnvType === "docker") {
      return '/api';
    }
    return `http://${watchedServerIp || 'localhost'}:3001/api`;
  }, [selectedEnvType, watchedServerIp]);

  // Handle live connection status change
  const handleLiveConnectionSuccess = (status: ConnectionStatus) => {
    setDbConnectionStatus('success');
    setDbConnectionError('');
    setBackendStatus('online');
  };

  const handleLiveConnectionFailed = (status: ConnectionStatus) => {
    setDbConnectionStatus('error');
    setDbConnectionError(status.error || 'Falha na conexão');
  };

  // Enable auto-probe when entering step 2 with password filled
  useEffect(() => {
    if (currentStep === 2 && selectedDbType === 'postgresql' && watchedDbPassword) {
      setAutoProbeEnabled(true);
    } else {
      setAutoProbeEnabled(false);
    }
  }, [currentStep, selectedDbType, watchedDbPassword]);

  // Play reconnection sound
  const playReconnectSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Pleasant "ding" sound - two ascending tones
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
      oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.4);
    } catch (error) {
      console.log('Audio not supported:', error);
    }
  };

  // Check backend status function
  const checkBackendStatus = async (isRetry = false) => {
    setIsCheckingBackend(true);
    setBackendStatus('checking');
    setRetryCountdown(0);
    
    try {
      const apiUrl = probeApiUrl;
      const response = await fetch(`${apiUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      
      if (response.ok) {
        const wasOffline = previousBackendStatus === 'offline';
        setBackendStatus('online');
        setPreviousBackendStatus('online');
        setRetryAttempt(0);
        
        // Show toast and play sound when coming back online
        if (wasOffline || isRetry) {
          playReconnectSound();
          toast({
            title: "✅ Backend reconectado!",
            description: "A conexão com o servidor foi restabelecida.",
          });
        }
        return true;
      }
      setBackendStatus('offline');
      setPreviousBackendStatus('offline');
      return false;
    } catch (error) {
      console.error('Backend check failed:', error);
      setBackendStatus('offline');
      setPreviousBackendStatus('offline');
      return false;
    } finally {
      setIsCheckingBackend(false);
    }
  };

  // Auto-retry when offline
  useEffect(() => {
    if (backendStatus === 'offline' && !isCheckingBackend) {
      const retryDelay = Math.min(10, 5 + retryAttempt * 2); // 5s, 7s, 9s, max 10s
      setRetryCountdown(retryDelay);
      
      const countdownInterval = setInterval(() => {
        setRetryCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      const retryTimeout = setTimeout(() => {
        setRetryAttempt(prev => prev + 1);
        checkBackendStatus(true);
      }, retryDelay * 1000);

      return () => {
        clearInterval(countdownInterval);
        clearTimeout(retryTimeout);
      };
    }
  }, [backendStatus, isCheckingBackend, retryAttempt]);

  // Auto-check backend on step 2 or when env changes
  useEffect(() => {
    if (currentStep >= 1 && selectedDbType === 'postgresql') {
      checkBackendStatus();
    }
  }, [currentStep, selectedDbType, probeApiUrl]);

  const handleDownloadSchema = () => {
    const schemaUrl = '/database_schema.sql';
    const link = document.createElement('a');
    link.href = schemaUrl;
    link.download = 'database_schema.sql';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Download iniciado",
      description: "O arquivo SQL com o schema completo foi baixado.",
    });
  };


  const handleInstallSchema = async () => {
    if (dbConnectionStatus !== 'success') {
      toast({
        title: "Teste a conexão primeiro",
        description: "É necessário testar a conexão antes de instalar o schema",
        variant: "destructive",
      });
      return;
    }

    setDbInstallStatus('installing');
    
    try {
      const values = form.getValues();
      const apiUrl = getSetupApiUrl();
      
      const effectiveHost = getEffectiveDbHost();
      
      const response = await fetch(`${apiUrl}/install-schema`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: effectiveHost,
          port: values.dbPort,
          database: values.dbName,
          user: values.dbUser,
          password: values.dbPassword,
          ssl: values.dbSsl || false,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Erro ao instalar schema');
      }

      setDbInstallStatus('success');
      toast({
        title: "Schema instalado!",
        description: "Todas as tabelas foram criadas com sucesso.",
      });
    } catch (error: any) {
      setDbInstallStatus('error');
      toast({
        title: "Erro na instalação",
        description: error.message || "Não foi possível instalar o schema",
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (data: SetupForm) => {
    if (!data.empresaNome || data.empresaNome.length < 3) {
      toast({
        title: "Erro de validação",
        description: "Nome da empresa é obrigatório",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    try {
      const apiUrl = getSetupApiUrl();
      console.log('🔗 Usando API URL:', apiUrl);
      
      // 1. Create admin user
      console.log('👤 Criando usuário administrador...');
      const signupResponse = await fetch(`${apiUrl}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: data.adminNome,
          email: data.adminEmail,
          password: data.adminSenha,
          telefone: data.adminTelefone,
        }),
      });

      if (!signupResponse.ok) {
        const errorData = await signupResponse.json();
        throw new Error(errorData.error || 'Erro ao criar usuário');
      }

      const { user, token } = await signupResponse.json();
      console.log('✅ Usuário criado com sucesso!');

      // 2. Save auth token
      localStorage.setItem('auth_token', token);
      
      // 3. Mark setup as complete
      localStorage.setItem('setup_completed', 'true');
      localStorage.setItem('empresa_config', JSON.stringify({
        nome: data.empresaNome,
        cnpj: data.empresaCNPJ || '',
        telefone: data.empresaTelefone || '',
        email: data.empresaEmail || '',
      }));

      // 4. Save DB config for standalone mode
      if (data.envType === 'standalone' && data.dbType === 'postgresql') {
        localStorage.setItem('db_config', JSON.stringify({
          host: data.dbHost,
          port: data.dbPort,
          database: data.dbName,
          user: data.dbUser,
          ssl: data.dbSsl || false,
        }));
        
        // Save to .env.local
        await fetch(`${apiUrl}/save-db-config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            host: data.dbHost,
            port: data.dbPort,
            database: data.dbName,
            user: data.dbUser,
            password: data.dbPassword,
            ssl: data.dbSsl || false,
            serverIp: data.serverIp || 'localhost',
          }),
        });
      }

      toast({
        title: "Instalação concluída!",
        description: "Sistema configurado com sucesso. Redirecionando...",
      });

      setTimeout(() => navigate("/dashboard"), 2000);
    } catch (error: any) {
      console.error("Erro no setup:", error);
      toast({
        title: "Erro na instalação",
        description: error.message || "Ocorreu um erro ao configurar o sistema",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const nextStep = async () => {
    let isValid = false;
    
    if (currentStep === 0) {
      isValid = true;
    } else if (currentStep === 1) {
      const values = form.getValues();
      const errors: string[] = [];
      
      if (!values.adminNome || values.adminNome.length < 3) {
        errors.push("Nome inválido");
        form.setError("adminNome", { message: "Nome deve ter no mínimo 3 caracteres" });
      }
      if (!values.adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.adminEmail)) {
        errors.push("Email inválido");
        form.setError("adminEmail", { message: "Email inválido" });
      }
      if (!values.adminSenha || values.adminSenha.length < 8) {
        errors.push("Senha inválida");
        form.setError("adminSenha", { message: "Senha deve ter no mínimo 8 caracteres" });
      }
      if (values.adminSenha !== values.adminConfirmarSenha) {
        errors.push("Senhas não coincidem");
        form.setError("adminConfirmarSenha", { message: "As senhas não coincidem" });
      }
      
      isValid = errors.length === 0;
      if (!isValid) {
        toast({
          title: "Campos obrigatórios",
          description: "Verifique os campos destacados",
          variant: "destructive",
        });
      }
    } else if (currentStep === 2) {
      const values = form.getValues();
      
      if (values.dbType === "supabase") {
        isValid = true;
      } else {
        // PostgreSQL validation
        if (values.envType === 'standalone' && !values.serverIp) {
          form.setError("serverIp", { message: "IP do servidor é obrigatório" });
          isValid = false;
        } else if (dbInstallStatus !== "success") {
          toast({
            title: "Schema não instalado",
            description: "Instale o schema antes de continuar",
            variant: "destructive",
          });
          isValid = false;
        } else {
          isValid = true;
        }
      }
    } else if (currentStep === 3) {
      const values = form.getValues();
      
      if (!values.empresaNome || values.empresaNome.length < 3) {
        form.setError("empresaNome", { message: "Nome da empresa é obrigatório" });
        isValid = false;
      } else if (values.empresaEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.empresaEmail)) {
        form.setError("empresaEmail", { message: "Email inválido" });
        isValid = false;
      } else {
        isValid = true;
      }
    }
    
    if (isValid) {
      setCurrentStep(currentStep + 1);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/5 p-4">
      <Card className="w-full max-w-3xl shadow-xl">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-center mb-4">
            <div className="p-4 rounded-full bg-primary/10">
              <Settings className="h-12 w-12 text-primary" />
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <CardTitle className="text-3xl text-center">Instalação do Sistema</CardTitle>
            {detectedDocker && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Container className="h-3 w-3" />
                Docker
              </Badge>
            )}
          </div>
          
          {/* Backend Status Indicator */}
          {selectedDbType === 'postgresql' && currentStep >= 1 && (
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={() => checkBackendStatus(false)}
                disabled={isCheckingBackend}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors hover:bg-muted/50"
              >
                {isCheckingBackend ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-muted-foreground">Verificando backend...</span>
                  </>
                ) : backendStatus === 'online' ? (
                  <>
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                    </span>
                    <span className="text-green-600 dark:text-green-400 font-medium">Backend Online</span>
                    <Server className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                  </>
                ) : backendStatus === 'offline' ? (
                  <>
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                    </span>
                    <span className="text-red-600 dark:text-red-400 font-medium">Backend Offline</span>
                    <WifiOff className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                    {retryCountdown > 0 ? (
                      <span className="text-xs text-muted-foreground ml-1">
                        Retry em {retryCountdown}s
                      </span>
                    ) : (
                      <RefreshCw className="h-3 w-3 text-muted-foreground ml-1" />
                    )}
                  </>
                ) : (
                  <>
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-muted-foreground"></span>
                    </span>
                    <span className="text-muted-foreground">Backend não verificado</span>
                  </>
                )}
              </button>
            </div>
          )}

          <CardDescription className="text-center text-base">
            Configure o sistema para começar a utilizá-lo
          </CardDescription>
          
          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-1 sm:gap-2 pt-4">
            {['Início', 'Admin', 'Banco', 'Empresa'].map((label, index) => (
              <div key={index} className="flex items-center gap-1">
                {index > 0 && <Separator className="w-6 sm:w-8" />}
                <div className={`flex items-center gap-1 ${currentStep === index ? 'text-primary' : 'text-muted-foreground'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep > index ? 'bg-primary text-primary-foreground' : 
                    currentStep === index ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}>
                    {currentStep > index ? <CheckCircle className="h-4 w-4" /> : index}
                  </div>
                  <span className="text-xs font-medium hidden md:inline">{label}</span>
                </div>
              </div>
            ))}
          </div>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Step 0: Welcome & Environment */}
              {currentStep === 0 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 mb-4">
                    <BookOpen className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">Bem-vindo à Instalação</h3>
                  </div>

                  {/* Environment Detection */}
                  <Alert className={detectedDocker ? "border-blue-500/50 bg-blue-500/10" : ""}>
                    <Container className="h-4 w-4" />
                    <AlertTitle>Ambiente Detectado</AlertTitle>
                    <AlertDescription>
                      {detectedDocker ? (
                        <span>Ambiente <strong>Docker</strong> detectado. As configurações serão otimizadas automaticamente.</span>
                      ) : (
                        <span>Ambiente <strong>standalone</strong>. Você precisará configurar o servidor e banco manualmente.</span>
                      )}
                    </AlertDescription>
                  </Alert>

                  <FormField
                    control={form.control}
                    name="envType"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>Tipo de Ambiente</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="flex flex-col space-y-3"
                          >
                            <div className={`flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent ${field.value === 'docker' ? 'border-primary bg-primary/5' : ''}`}>
                              <RadioGroupItem value="docker" id="docker" />
                              <Label htmlFor="docker" className="flex-1 cursor-pointer">
                                <div className="flex items-center gap-2">
                                  <Container className="h-5 w-5 text-blue-500" />
                                  <div>
                                    <p className="font-medium">Docker</p>
                                    <p className="text-sm text-muted-foreground">
                                      Configuração simplificada via docker-compose
                                    </p>
                                  </div>
                                </div>
                              </Label>
                            </div>
                            <div className={`flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent ${field.value === 'standalone' ? 'border-primary bg-primary/5' : ''}`}>
                              <RadioGroupItem value="standalone" id="standalone" />
                              <Label htmlFor="standalone" className="flex-1 cursor-pointer">
                                <div className="flex items-center gap-2">
                                  <Server className="h-5 w-5 text-orange-500" />
                                  <div>
                                    <p className="font-medium">Standalone (Manual)</p>
                                    <p className="text-sm text-muted-foreground">
                                      Configuração manual de servidor e banco
                                    </p>
                                  </div>
                                </div>
                              </Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {/* Quick start for Docker */}
                  {selectedEnvType === 'docker' && (
                    <Alert>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <AlertTitle>Configuração Docker Simplificada</AlertTitle>
                      <AlertDescription className="text-sm">
                        <ul className="list-disc list-inside space-y-1 mt-2">
                          <li>O banco de dados já está configurado automaticamente</li>
                          <li>Você só precisa informar a senha definida no <code className="bg-muted px-1 rounded">.env</code></li>
                          <li>A API e frontend já estão conectados via nginx</li>
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button type="button" onClick={nextStep} className="w-full">
                    Iniciar Instalação
                  </Button>
                </div>
              )}

              {/* Step 1: Admin */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <User className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">Dados do Administrador</h3>
                  </div>

                  <FormField
                    control={form.control}
                    name="adminNome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Completo *</FormLabel>
                        <FormControl>
                          <Input placeholder="João Silva" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="adminEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email *</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="admin@empresa.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="adminTelefone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="(11) 98765-4321" 
                              {...field}
                              onChange={(e) => field.onChange(maskPhone(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="adminSenha"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Senha *</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Mínimo 8 caracteres" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="adminConfirmarSenha"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirmar Senha *</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Repita a senha" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={() => setCurrentStep(0)} className="flex-1">
                      Voltar
                    </Button>
                    <Button type="button" onClick={nextStep} className="flex-1">
                      Próximo
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2: Database */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Database className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">Configuração do Banco de Dados</h3>
                  </div>

                  {/* Database Type Selection */}
                  <FormField
                    control={form.control}
                    name="dbType"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>Tipo de Banco *</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                          >
                            <div className={`flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent ${field.value === 'supabase' ? 'border-primary bg-primary/5' : ''}`}>
                              <RadioGroupItem value="supabase" id="supabase" />
                              <Label htmlFor="supabase" className="flex-1 cursor-pointer">
                                <div className="flex items-center gap-2">
                                  <Cloud className="h-5 w-5 text-green-500" />
                                  <div>
                                    <p className="font-medium">Lovable Cloud</p>
                                    <p className="text-xs text-muted-foreground">Pronto para uso</p>
                                  </div>
                                </div>
                              </Label>
                            </div>
                            <div className={`flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent ${field.value === 'postgresql' ? 'border-primary bg-primary/5' : ''}`}>
                              <RadioGroupItem value="postgresql" id="postgresql" />
                              <Label htmlFor="postgresql" className="flex-1 cursor-pointer">
                                <div className="flex items-center gap-2">
                                  <Server className="h-5 w-5 text-blue-500" />
                                  <div>
                                    <p className="font-medium">PostgreSQL</p>
                                    <p className="text-xs text-muted-foreground">Local/Docker</p>
                                  </div>
                                </div>
                              </Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {/* Supabase - Ready to go */}
                  {selectedDbType === "supabase" && (
                    <Alert className="border-green-500/50 bg-green-500/10">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <AlertDescription>
                        O Lovable Cloud já está configurado e pronto para uso. Clique em "Próximo" para continuar.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* PostgreSQL Configuration */}
                  {selectedDbType === "postgresql" && (
                    <div className="space-y-4">
                      {/* Server IP (only for standalone) */}
                      {selectedEnvType === 'standalone' && (
                        <FormField
                          control={form.control}
                          name="serverIp"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>IP do Servidor Backend *</FormLabel>
                              <FormControl>
                                <Input placeholder="localhost ou 192.168.1.100" {...field} />
                              </FormControl>
                              <FormDescription>
                                IP onde o backend está rodando (porta 3001)
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {/* Database Location - Docker only */}
                      {selectedEnvType === 'docker' && (
                        <FormField
                          control={form.control}
                          name="dbLocation"
                          render={({ field }) => (
                            <FormItem className="space-y-3">
                              <FormLabel>Localização do PostgreSQL</FormLabel>
                              <FormControl>
                                <RadioGroup
                                  onValueChange={field.onChange}
                                  value={field.value}
                                  className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                                >
                                  <div className={`flex items-center space-x-3 border rounded-lg p-3 cursor-pointer hover:bg-accent ${field.value === 'container' ? 'border-primary bg-primary/5' : ''}`}>
                                    <RadioGroupItem value="container" id="container" />
                                    <Label htmlFor="container" className="flex-1 cursor-pointer">
                                      <div className="flex items-center gap-2">
                                        <Container className="h-4 w-4 text-blue-500" />
                                        <div>
                                          <p className="font-medium text-sm">Container Docker</p>
                                          <p className="text-xs text-muted-foreground">PostgreSQL no docker-compose</p>
                                        </div>
                                      </div>
                                    </Label>
                                  </div>
                                  <div className={`flex items-center space-x-3 border rounded-lg p-3 cursor-pointer hover:bg-accent ${field.value === 'external' ? 'border-primary bg-primary/5' : ''}`}>
                                    <RadioGroupItem value="external" id="external" />
                                    <Label htmlFor="external" className="flex-1 cursor-pointer">
                                      <div className="flex items-center gap-2">
                                        <Server className="h-4 w-4 text-orange-500" />
                                        <div>
                                          <p className="font-medium text-sm">Servidor Externo</p>
                                          <p className="text-xs text-muted-foreground">PostgreSQL como serviço</p>
                                        </div>
                                      </div>
                                    </Label>
                                  </div>
                                </RadioGroup>
                              </FormControl>
                              <FormDescription>
                                {field.value === 'container' 
                                  ? 'O PostgreSQL está rodando dentro do docker-compose (host: postgres)'
                                  : 'O PostgreSQL está instalado como serviço no servidor ou em outra máquina'
                                }
                              </FormDescription>
                            </FormItem>
                          )}
                        />
                      )}

                      {/* Info alert based on selection */}
                      {selectedEnvType === 'docker' && selectedDbLocation === 'container' && (
                        <Alert className="border-blue-500/50 bg-blue-500/10">
                          <Container className="h-4 w-4" />
                          <AlertDescription>
                            <strong>Docker Container:</strong> Host será <code className="bg-muted px-1 rounded">postgres</code> (nome do serviço no docker-compose)
                          </AlertDescription>
                        </Alert>
                      )}

                      {selectedEnvType === 'docker' && selectedDbLocation === 'external' && (
                        <Alert className="border-orange-500/50 bg-orange-500/10">
                          <Server className="h-4 w-4" />
                          <AlertDescription>
                            <strong>PostgreSQL Externo:</strong> Informe o IP/hostname do servidor onde o PostgreSQL está rodando.
                            Use <code className="bg-muted px-1 rounded">host.docker.internal</code> para acessar o host da máquina Docker.
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="dbHost"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Host {(selectedEnvType === 'standalone' || selectedDbLocation === 'external') && '*'}</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder={
                                    selectedEnvType === 'docker' && selectedDbLocation === 'container' 
                                      ? 'postgres' 
                                      : 'localhost ou 192.168.1.100'
                                  } 
                                  {...field}
                                  disabled={selectedEnvType === 'docker' && selectedDbLocation === 'container'}
                                  value={selectedEnvType === 'docker' && selectedDbLocation === 'container' ? 'postgres' : field.value}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="dbPort"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Porta</FormLabel>
                              <FormControl>
                                <Input placeholder="5432" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="dbName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome do Banco</FormLabel>
                            <FormControl>
                              <Input placeholder="layout_app" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="dbUser"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Usuário</FormLabel>
                              <FormControl>
                                <Input placeholder="postgres" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="dbPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Senha *</FormLabel>
                              <FormControl>
                                <Input type="password" placeholder="••••••" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Live Connection Monitor */}
                      {watchedDbPassword && (
                        <LiveConnectionMonitor
                          config={probeConfig}
                          apiUrl={probeApiUrl}
                          enabled={autoProbeEnabled}
                          autoProbeInterval={5000}
                          onConnectionSuccess={handleLiveConnectionSuccess}
                          onConnectionFailed={handleLiveConnectionFailed}
                        />
                      )}

                      {/* Install Schema Button */}
                      {dbConnectionStatus === 'success' && (
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            onClick={handleInstallSchema}
                            disabled={dbInstallStatus === 'installing' || dbInstallStatus === 'success'}
                            className="flex-1"
                          >
                            {dbInstallStatus === 'installing' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {dbInstallStatus === 'success' && <CheckCircle2 className="mr-2 h-4 w-4" />}
                            {dbInstallStatus === 'error' && <AlertCircle className="mr-2 h-4 w-4" />}
                            {dbInstallStatus === 'idle' && <Download className="mr-2 h-4 w-4" />}
                            {dbInstallStatus === 'installing' ? 'Instalando...' : dbInstallStatus === 'success' ? 'Instalado!' : 'Instalar Schema'}
                          </Button>
                        </div>
                      )}

                      {/* Waiting for password hint */}
                      {!watchedDbPassword && (
                        <Alert>
                          <Activity className="h-4 w-4" />
                          <AlertDescription>
                            Informe a senha do banco para iniciar a detecção automática de conexão
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Success message */}
                      {dbInstallStatus === 'success' && (
                        <Alert className="border-green-500/50 bg-green-500/10">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <AlertDescription>
                            Schema instalado com sucesso! Todas as tabelas foram criadas.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={() => setCurrentStep(1)} className="flex-1">
                      Voltar
                    </Button>
                    <Button type="button" onClick={nextStep} className="flex-1">
                      Próximo
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Company */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Building2 className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">Informações da Empresa</h3>
                  </div>

                  <FormField
                    control={form.control}
                    name="empresaNome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome da Empresa *</FormLabel>
                        <FormControl>
                          <Input placeholder="Minha Empresa Ltda" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="empresaCNPJ"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CNPJ</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="00.000.000/0000-00" 
                            {...field}
                            onChange={(e) => field.onChange(maskCNPJ(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="empresaEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="contato@empresa.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="empresaTelefone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="(11) 3333-4444" 
                              {...field}
                              onChange={(e) => field.onChange(maskPhone(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={() => setCurrentStep(2)} className="flex-1">
                      Voltar
                    </Button>
                    <Button type="submit" disabled={isLoading} className="flex-1">
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Instalando...
                        </>
                      ) : (
                        "Concluir Instalação"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Setup;
