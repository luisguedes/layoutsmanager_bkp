import { ConnectionStatus } from '@/hooks/useConnectionProbe';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, Circle, Wifi, WifiOff, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConnectionStatusBadgeProps {
  status: ConnectionStatus;
  isProbing?: boolean;
  showLatency?: boolean;
  showLastChecked?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ConnectionStatusBadge = ({
  status,
  isProbing = false,
  showLatency = true,
  showLastChecked = false,
  size = 'md',
  className,
}: ConnectionStatusBadgeProps) => {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const getStatusConfig = () => {
    if (isProbing) {
      return {
        variant: 'outline' as const,
        icon: <Loader2 className={cn(iconSizes[size], 'animate-spin')} />,
        text: 'Verificando...',
        bgClass: 'bg-muted/50',
      };
    }

    switch (status.status) {
      case 'connected':
        return {
          variant: 'default' as const,
          icon: <CheckCircle2 className={cn(iconSizes[size], 'text-green-500')} />,
          text: showLatency && status.latency 
            ? `Conectado (${status.latency}ms)` 
            : 'Conectado',
          bgClass: 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400',
        };
      case 'failed':
        return {
          variant: 'destructive' as const,
          icon: <XCircle className={cn(iconSizes[size])} />,
          text: 'Falhou',
          bgClass: 'bg-destructive/10 border-destructive/30',
        };
      case 'checking':
        return {
          variant: 'outline' as const,
          icon: <Loader2 className={cn(iconSizes[size], 'animate-spin')} />,
          text: 'Verificando...',
          bgClass: 'bg-muted/50',
        };
      default:
        return {
          variant: 'secondary' as const,
          icon: <Circle className={cn(iconSizes[size], 'text-muted-foreground')} />,
          text: 'Aguardando',
          bgClass: '',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Badge 
        variant={config.variant}
        className={cn(sizeClasses[size], config.bgClass, 'flex items-center gap-1.5')}
      >
        {config.icon}
        {config.text}
      </Badge>
      {showLastChecked && status.lastChecked && (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {status.lastChecked.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
};
