import { useEffect, useState } from 'react';
import { ConnectionStatus, ProbeConfig, useConnectionProbe } from '@/hooks/useConnectionProbe';
import { ConnectionStatusBadge } from './ConnectionStatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { RefreshCw, Server, Database, Activity, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LiveConnectionMonitorProps {
  config: ProbeConfig | null;
  apiUrl: string;
  enabled?: boolean;
  autoProbeInterval?: number; // 0 = manual only
  onConnectionSuccess?: (status: ConnectionStatus) => void;
  onConnectionFailed?: (status: ConnectionStatus) => void;
  className?: string;
}

export const LiveConnectionMonitor = ({
  config,
  apiUrl,
  enabled = true,
  autoProbeInterval = 0,
  onConnectionSuccess,
  onConnectionFailed,
  className,
}: LiveConnectionMonitorProps) => {
  const [probeCount, setProbeCount] = useState(0);
  const [lastSuccessTime, setLastSuccessTime] = useState<Date | null>(null);

  const handleStatusChange = (newStatus: ConnectionStatus) => {
    if (newStatus.status === 'connected') {
      setLastSuccessTime(new Date());
      onConnectionSuccess?.(newStatus);
    } else if (newStatus.status === 'failed') {
      onConnectionFailed?.(newStatus);
    }
  };

  const { status, isProbing, probe, reset } = useConnectionProbe(config, {
    apiUrl,
    enabled,
    interval: autoProbeInterval,
    onStatusChange: handleStatusChange,
  });

  const handleManualProbe = async () => {
    setProbeCount(prev => prev + 1);
    await probe();
  };

  // Calculate connection quality based on latency
  const getConnectionQuality = () => {
    if (status.status !== 'connected' || !status.latency) return null;
    
    if (status.latency < 100) return { label: 'Excelente', color: 'text-green-500', progress: 100 };
    if (status.latency < 300) return { label: 'Boa', color: 'text-green-400', progress: 75 };
    if (status.latency < 500) return { label: 'Média', color: 'text-yellow-500', progress: 50 };
    return { label: 'Lenta', color: 'text-orange-500', progress: 25 };
  };

  const quality = getConnectionQuality();
  const hasConfig = config && config.host && config.password;

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <span className="font-medium">Conexão PostgreSQL</span>
          </div>
          <ConnectionStatusBadge 
            status={status} 
            isProbing={isProbing}
            showLatency={true}
          />
        </div>

        {/* Connection Details */}
        {hasConfig && (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Server className="h-3 w-3" />
              <span className="truncate">{config.host}:{config.port || '5432'}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Database className="h-3 w-3" />
              <span className="truncate">{config.database || 'layout_app'}</span>
            </div>
          </div>
        )}

        {/* Connection Quality Indicator */}
        {quality && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Qualidade
              </span>
              <span className={cn('font-medium', quality.color)}>{quality.label}</span>
            </div>
            <Progress value={quality.progress} className="h-1.5" />
          </div>
        )}

        {/* Error Message */}
        {status.status === 'failed' && status.error && (
          <div className="p-2 rounded bg-destructive/10 text-destructive text-sm">
            {status.error}
          </div>
        )}

        {/* Version Info */}
        {status.status === 'connected' && status.version && (
          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded truncate">
            {status.version.split('(')[0]}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleManualProbe}
            disabled={isProbing || !hasConfig}
            className="flex-1"
          >
            {isProbing ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Activity className="h-4 w-4 mr-2" />
            )}
            {isProbing ? 'Verificando...' : 'Testar Agora'}
          </Button>
        </div>

        {/* Stats */}
        {probeCount > 0 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
            <span>Testes realizados: {probeCount}</span>
            {lastSuccessTime && (
              <span>Último sucesso: {lastSuccessTime.toLocaleTimeString()}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
