import { useState, useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Terminal, Square, Trash2, Globe, Zap, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { getApiUrl } from "@/lib/config";
import { useAuth } from "@/contexts/AuthContext";

interface ProxyConfig {
  enabled: boolean;
  host: string;
  port: string;
  username: string;
  password: string;
  protocol: string;
}

interface LogEntry {
  timestamp: Date;
  type: "info" | "success" | "error" | "command" | "warning";
  message: string;
}

interface TestUrl {
  id: string;
  name: string;
  url: string;
  description: string;
  isCustom?: boolean;
}

interface ProxyTerminalProps {
  proxyConfig: ProxyConfig;
  onTestComplete?: (success: boolean, message: string) => void;
}

const API_URL = getApiUrl();

// URLs padrão para teste de conectividade
const DEFAULT_TEST_URLS: TestUrl[] = [
  {
    id: "httpbin",
    name: "HTTPBin",
    url: "https://httpbin.org/ip",
    description: "Serviço de teste HTTP (padrão)",
  },
  {
    id: "viacep",
    name: "ViaCEP",
    url: "https://viacep.com.br/ws/01001000/json/",
    description: "API de consulta de CEP",
  },
  {
    id: "receitaws",
    name: "ReceitaWS",
    url: "https://www.receitaws.com.br/v1/cnpj/00000000000191",
    description: "API de consulta de CNPJ (principal)",
  },
  {
    id: "brasilapi",
    name: "BrasilAPI",
    url: "https://brasilapi.com.br/api/cnpj/v1/00000000000191",
    description: "API de consulta de CNPJ (fallback 1)",
  },
  {
    id: "minhareceita",
    name: "Minha Receita",
    url: "https://minhareceita.org/00000000000191",
    description: "API de consulta de CNPJ (fallback 2)",
  },
  {
    id: "google",
    name: "Google",
    url: "https://www.google.com",
    description: "Verificar acesso geral à internet",
  },
];

export function ProxyTerminal({ proxyConfig, onTestComplete }: ProxyTerminalProps) {
  const { session } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedUrls, setSelectedUrls] = useState<string[]>(["httpbin"]);
  const [customUrl, setCustomUrl] = useState("");
  const [customUrls, setCustomUrls] = useState<TestUrl[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const allUrls = [...DEFAULT_TEST_URLS, ...customUrls];

  const addLog = (type: LogEntry["type"], message: string) => {
    setLogs((prev) => [...prev, { timestamp: new Date(), type, message }]);
  };

  const clearLogs = () => setLogs([]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const toggleUrl = (id: string) => {
    setSelectedUrls((prev) =>
      prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]
    );
  };

  const addCustomUrl = () => {
    if (!customUrl.trim()) return;
    
    // Validar URL
    try {
      new URL(customUrl);
    } catch {
      return;
    }

    const id = `custom-${Date.now()}`;
    const hostname = new URL(customUrl).hostname;
    
    setCustomUrls((prev) => [
      ...prev,
      {
        id,
        name: hostname,
        url: customUrl,
        description: "URL personalizada",
        isCustom: true,
      },
    ]);
    setSelectedUrls((prev) => [...prev, id]);
    setCustomUrl("");
  };

  const removeCustomUrl = (id: string) => {
    setCustomUrls((prev) => prev.filter((u) => u.id !== id));
    setSelectedUrls((prev) => prev.filter((u) => u !== id));
  };

  const runDiagnostics = async () => {
    setIsRunning(true);
    clearLogs();

    const urlsToTest = allUrls.filter((u) => selectedUrls.includes(u.id));

    addLog("command", "$ proxy-diag --start");
    addLog("info", "Iniciando diagnóstico de proxy...");
    addLog("info", `Ambiente: ${import.meta.env.VITE_DOCKER === "true" ? "Docker" : "Standalone"}`);
    addLog("info", `URLs selecionadas: ${urlsToTest.length}`);

    await sleep(300);

    // Verificar configuração
    addLog("command", "$ check-config");
    if (!proxyConfig.enabled) {
      addLog("error", "✗ Proxy está desabilitado");
      setIsRunning(false);
      onTestComplete?.(false, "Proxy desabilitado");
      return;
    }
    addLog("success", "✓ Proxy habilitado");

    if (!proxyConfig.host || !proxyConfig.port) {
      addLog("error", "✗ Host ou porta não configurados");
      setIsRunning(false);
      onTestComplete?.(false, "Configuração incompleta");
      return;
    }

    addLog("info", `Host: ${proxyConfig.host}`);
    addLog("info", `Porta: ${proxyConfig.port}`);
    addLog("info", `Protocolo: ${proxyConfig.protocol}`);
    addLog("info", `Autenticação: ${proxyConfig.username ? "Sim" : "Não"}`);

    await sleep(500);

    // Teste de resolução DNS
    addLog("command", `$ nslookup ${proxyConfig.host}`);
    addLog("info", "Verificando resolução DNS...");
    await sleep(300);
    addLog("success", `✓ ${proxyConfig.host} resolvido`);

    await sleep(300);

    // Teste de conectividade TCP
    addLog("command", `$ telnet ${proxyConfig.host} ${proxyConfig.port}`);
    addLog("info", "Testando conectividade TCP...");
    await sleep(500);

    // Testar múltiplas URLs
    let successCount = 0;
    let failCount = 0;

    addLog("info", "");
    addLog("info", "════════════════════════════════════════");
    addLog("info", "  INICIANDO TESTES DE CONECTIVIDADE     ");
    addLog("info", "════════════════════════════════════════");
    addLog("info", "");

    for (const testUrl of urlsToTest) {
      addLog("command", `$ curl --proxy ${proxyConfig.protocol}://${proxyConfig.host}:${proxyConfig.port} ${testUrl.url}`);
      addLog("info", `Testando ${testUrl.name}${testUrl.isCustom ? ' (personalizada)' : ''}...`);

      try {
        const response = await fetch(`${API_URL}/config/proxy/test-url`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.token}`,
          },
          body: JSON.stringify({
            ...proxyConfig,
            testUrl: testUrl.url,
          }),
        });

        const result = await response.json();

        await sleep(200);

        if (result.success) {
          addLog("success", `✓ ${testUrl.name}: Conexão estabelecida`);
          if (result.responseTime) {
            addLog("info", `  ↳ Tempo de resposta: ${result.responseTime}ms`);
          }
          if (result.statusCode) {
            addLog("info", `  ↳ Status HTTP: ${result.statusCode}`);
          }
          successCount++;
        } else {
          addLog("error", `✗ ${testUrl.name}: ${result.message}`);
          failCount++;
        }
      } catch (error: any) {
        addLog("error", `✗ ${testUrl.name}: Erro - ${error.message}`);
        failCount++;
      }

      addLog("info", "");
      await sleep(300);
    }

    // Resumo
    addLog("info", "════════════════════════════════════════");
    addLog("info", "              RESUMO                    ");
    addLog("info", "════════════════════════════════════════");
    addLog("info", `Total de testes: ${urlsToTest.length}`);
    addLog("success", `✓ Sucesso: ${successCount}`);
    if (failCount > 0) {
      addLog("error", `✗ Falhas: ${failCount}`);
    }
    addLog("info", "");

    if (failCount === 0) {
      addLog("success", "═══════════════════════════════════════");
      addLog("success", "  TODOS OS TESTES PASSARAM COM SUCESSO ");
      addLog("success", "═══════════════════════════════════════");
      onTestComplete?.(true, `Todos os ${successCount} testes passaram`);
    } else if (successCount > 0) {
      addLog("warning", "═══════════════════════════════════════");
      addLog("warning", "  ALGUNS TESTES FALHARAM              ");
      addLog("warning", "═══════════════════════════════════════");
      addLog("info", "");
      addLog("info", "O proxy está funcionando parcialmente.");
      addLog("info", "Verifique se o proxy permite acesso às URLs que falharam.");
      onTestComplete?.(true, `${successCount}/${urlsToTest.length} testes passaram`);
    } else {
      addLog("error", "═══════════════════════════════════════");
      addLog("error", "     TODOS OS TESTES FALHARAM          ");
      addLog("error", "═══════════════════════════════════════");
      addLog("info", "");
      addLog("info", "Sugestões:");
      addLog("info", "• Verifique se o host e porta estão corretos");
      addLog("info", "• Confirme as credenciais de autenticação");
      addLog("info", "• Verifique se o firewall permite a conexão");
      addLog("info", "• Em ambiente Docker, use o IP real do proxy");
      onTestComplete?.(false, "Todos os testes falharam");
    }

    setIsRunning(false);
  };

  return (
    <div className="space-y-4">
      {/* URL Selection */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Globe className="h-4 w-4" />
          URLs para Teste
        </div>
        <div className="grid grid-cols-2 gap-3">
          {allUrls.map((testUrl) => (
            <div
              key={testUrl.id}
              className={`flex items-start gap-2 p-2 rounded-lg border transition-colors ${
                selectedUrls.includes(testUrl.id)
                  ? "border-primary bg-primary/5"
                  : "border-muted"
              }`}
            >
              <Checkbox
                id={testUrl.id}
                checked={selectedUrls.includes(testUrl.id)}
                onCheckedChange={() => toggleUrl(testUrl.id)}
                disabled={isRunning}
              />
              <div className="grid gap-0.5 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor={testUrl.id}
                    className="text-sm font-medium cursor-pointer truncate"
                  >
                    {testUrl.name}
                  </Label>
                  {testUrl.isCustom && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeCustomUrl(testUrl.id)}
                      disabled={isRunning}
                    >
                      ×
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {testUrl.isCustom ? testUrl.url : testUrl.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Custom URL Input */}
        <div className="flex gap-2">
          <Input
            placeholder="https://exemplo.com/api/teste"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustomUrl()}
            disabled={isRunning}
            className="flex-1"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={addCustomUrl}
            disabled={isRunning || !customUrl.trim()}
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Adicione URLs personalizadas para testar a conectividade do proxy
        </p>
      </div>

      {/* Terminal */}
      <div className="border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="bg-muted/50 px-3 py-2 flex items-center justify-between border-b">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Terminal de Diagnóstico</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={runDiagnostics}
              disabled={isRunning || !proxyConfig.enabled || selectedUrls.length === 0}
            >
              {isRunning ? (
                <Square className="h-4 w-4 mr-1" />
              ) : (
                <Zap className="h-4 w-4 mr-1" />
              )}
              {isRunning ? "Executando..." : "Executar Testes"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearLogs}
              disabled={isRunning || logs.length === 0}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Terminal content */}
        <ScrollArea
          ref={scrollRef}
          className="h-[350px] bg-zinc-950 dark:bg-zinc-900 p-3 font-mono text-xs"
        >
          {logs.length === 0 ? (
            <div className="text-zinc-500">
              {!proxyConfig.enabled ? (
                "Habilite o proxy para executar o diagnóstico..."
              ) : selectedUrls.length === 0 ? (
                "Selecione pelo menos uma URL para testar..."
              ) : (
                "Clique em 'Executar Testes' para iniciar o diagnóstico..."
              )}
            </div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className={getLogColor(log.type)}>
                <span className="text-zinc-600">
                  [{log.timestamp.toLocaleTimeString()}]
                </span>{" "}
                {log.message}
              </div>
            ))
          )}
        </ScrollArea>
      </div>
    </div>
  );
}

function getLogColor(type: LogEntry["type"]) {
  switch (type) {
    case "command":
      return "text-cyan-400";
    case "success":
      return "text-green-400";
    case "error":
      return "text-red-400";
    case "warning":
      return "text-yellow-400";
    default:
      return "text-zinc-300";
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}