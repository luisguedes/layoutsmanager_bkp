import { useState, useEffect, useCallback, useRef } from 'react';

export interface ConnectionStatus {
  status: 'idle' | 'checking' | 'connected' | 'failed';
  latency?: number;
  version?: string;
  error?: string;
  lastChecked?: Date;
}

export interface ProbeConfig {
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
}

interface UseConnectionProbeOptions {
  apiUrl: string;
  enabled?: boolean;
  interval?: number; // Auto-retry interval in ms (0 = no auto-retry)
  onStatusChange?: (status: ConnectionStatus) => void;
}

export const useConnectionProbe = (
  config: ProbeConfig | null,
  options: UseConnectionProbeOptions
) => {
  const { apiUrl, enabled = true, interval = 0, onStatusChange } = options;
  const [status, setStatus] = useState<ConnectionStatus>({ status: 'idle' });
  const [isProbing, setIsProbing] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const probe = useCallback(async (): Promise<ConnectionStatus> => {
    if (!config || !config.host || !config.password) {
      return { status: 'idle' };
    }

    // Cancel previous request if still running
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsProbing(true);
    const startTime = Date.now();

    try {
      const response = await fetch(`${apiUrl}/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: config.host,
          port: config.port || '5432',
          database: config.database || 'layout_app',
          user: config.user || 'postgres',
          password: config.password,
          ssl: config.ssl || false,
        }),
        signal: abortControllerRef.current.signal,
      });

      const latency = Date.now() - startTime;
      const data = await response.json();

      if (data.success) {
        const newStatus: ConnectionStatus = {
          status: 'connected',
          latency,
          version: data.version,
          lastChecked: new Date(),
        };
        setStatus(newStatus);
        onStatusChange?.(newStatus);
        return newStatus;
      } else {
        const newStatus: ConnectionStatus = {
          status: 'failed',
          error: data.error || 'Falha na conexão',
          lastChecked: new Date(),
        };
        setStatus(newStatus);
        onStatusChange?.(newStatus);
        return newStatus;
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return status; // Return current status if aborted
      }

      let errorMessage = 'Erro ao conectar';
      if (error.message?.includes('Failed to fetch')) {
        errorMessage = 'Backend não acessível';
      } else if (error.message?.includes('NetworkError')) {
        errorMessage = 'Erro de rede';
      } else if (error.message) {
        errorMessage = error.message;
      }

      const newStatus: ConnectionStatus = {
        status: 'failed',
        error: errorMessage,
        lastChecked: new Date(),
      };
      setStatus(newStatus);
      onStatusChange?.(newStatus);
      return newStatus;
    } finally {
      setIsProbing(false);
    }
  }, [config, apiUrl, onStatusChange, status]);

  // Start/stop auto-probing
  useEffect(() => {
    if (enabled && interval > 0 && config?.password) {
      // Initial probe
      probe();
      
      // Setup interval
      intervalRef.current = setInterval(() => {
        probe();
      }, interval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [enabled, interval, config?.host, config?.port, config?.password, probe]);

  const reset = useCallback(() => {
    setStatus({ status: 'idle' });
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  return {
    status,
    isProbing,
    probe,
    reset,
  };
};
