/**
 * Centralized Configuration Module
 * All environment variables are loaded and validated here
 */

// Database Configuration
export const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'layout_app',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

// API Configuration
export const apiConfig = {
  port: parseInt(process.env.API_PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || '*',
};

// JWT Configuration
export const jwtConfig = {
  secret: process.env.VITE_JWT_SECRET,
  expiresIn: '7d',
};

// Validation function
export function validateConfig(): void {
  const errors: string[] = [];

  if (!jwtConfig.secret) {
    errors.push('VITE_JWT_SECRET environment variable is required');
  }

  if (apiConfig.nodeEnv === 'production' && !dbConfig.password) {
    errors.push('DB_PASSWORD is required in production');
  }

  if (errors.length > 0) {
    console.error('❌ Configuration errors:');
    errors.forEach(err => console.error(`   - ${err}`));
    if (apiConfig.nodeEnv === 'production') {
      process.exit(1);
    }
  }
}

// Log configuration (without sensitive data)
export function logConfig(): void {
  console.log('📋 Configuration:');
  console.log(`   Environment: ${apiConfig.nodeEnv}`);
  console.log(`   API Port: ${apiConfig.port}`);
  console.log(`   Database: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
  console.log(`   CORS Origin: ${apiConfig.corsOrigin}`);
  console.log(`   JWT Secret: ${jwtConfig.secret ? '✓ configured' : '✗ missing'}`);
}

// Get full database connection string
export function getDatabaseUrl(): string {
  const { host, port, database, user, password } = dbConfig;
  const sslParam = dbConfig.ssl ? '?sslmode=require' : '';
  return `postgresql://${user}:${password}@${host}:${port}/${database}${sslParam}`;
}

// Get API base URL
export function getApiBaseUrl(): string {
  const host = process.env.API_HOST || 'localhost';
  return `http://${host}:${apiConfig.port}`;
}
