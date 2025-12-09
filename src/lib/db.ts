import { Pool, PoolConfig } from 'pg';

let pool: Pool | null = null;

export interface DbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean | { rejectUnauthorized: boolean };
}

// Get database configuration from environment variables
export const getDbConfigFromEnv = (): DbConfig => {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'layout_app',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  };
};

export const initializeDatabase = (config: DbConfig) => {
  const poolConfig: PoolConfig = {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };

  if (config.ssl) {
    poolConfig.ssl = typeof config.ssl === 'boolean' 
      ? { rejectUnauthorized: false }
      : config.ssl;
  }

  pool = new Pool(poolConfig);

  pool.on('error', (err) => {
    console.error('Unexpected database error:', err);
  });

  return pool;
};

// Initialize database from environment variables
export const initializeDatabaseFromEnv = () => {
  const config = getDbConfigFromEnv();
  return initializeDatabase(config);
};

export const getDatabase = (): Pool => {
  if (!pool) {
    throw new Error('Database not initialized. Call initializeDatabase first.');
  }
  return pool;
};

export const closeDatabase = async () => {
  if (pool) {
    await pool.end();
    pool = null;
  }
};

// Helper para executar queries
export const query = async (text: string, params?: any[]) => {
  const db = getDatabase();
  return db.query(text, params);
};
