/**
 * Frontend Configuration Helper
 * Centralizes all environment variable access for the frontend
 */

// API Configuration
export const getApiUrl = (): string => {
  // In Docker, VITE_API_URL is /api (proxied by nginx)
  // In development, it might be the full URL
  const apiUrl = import.meta.env.VITE_API_URL || '/api';
  
  // Remove trailing slash if present
  return apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
};

// Supabase Configuration
export const getSupabaseConfig = () => ({
  url: import.meta.env.VITE_SUPABASE_URL || '',
  anonKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
  projectId: import.meta.env.VITE_SUPABASE_PROJECT_ID || '',
});

// Check if running in production
export const isProduction = (): boolean => {
  return import.meta.env.PROD === true;
};

// Check if running in development
export const isDevelopment = (): boolean => {
  return import.meta.env.DEV === true;
};

// Check if running in Docker environment
export const isDockerEnvironment = (): boolean => {
  // In Docker, VITE_API_URL is typically /api (relative)
  // In local dev, it's usually http://localhost:3001/api or similar
  const apiUrl = import.meta.env.VITE_API_URL || '';
  return apiUrl === '/api' || import.meta.env.VITE_DOCKER === 'true';
};

// Build API endpoint URL
export const buildApiUrl = (endpoint: string): string => {
  const baseUrl = getApiUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseUrl}${cleanEndpoint}`;
};

// Get environment info for display
export const getEnvironmentInfo = () => {
  const apiUrl = import.meta.env.VITE_API_URL || '/api';
  const isDocker = isDockerEnvironment();
  
  return {
    apiUrl,
    isDocker,
    isProduction: isProduction(),
    isDevelopment: isDevelopment(),
    displayMode: isDocker ? 'Docker' : (isProduction() ? 'Produção' : 'Desenvolvimento'),
  };
};

// Validate configuration
export const validateFrontendConfig = (): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  const apiUrl = import.meta.env.VITE_API_URL;
  if (!apiUrl && isProduction()) {
    errors.push('VITE_API_URL is not configured');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
};
