import { Pool, PoolClient } from 'pg';
import { dbConfig } from '../config.js';
import { logInfo, logError } from '../utils/logger.js';
import { DatabaseServiceError } from '../types/waha.types.js';

const pool = new Pool(dbConfig);

pool.on('connect', (client) => {
  logInfo('New database client connected');
});

pool.on('error', (err) => {
  logError('Unexpected error on idle database client', err);
});

process.on('SIGINT', async () => {
  logInfo('Shutting down database connection pool...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logInfo('Shutting down database connection pool...');
  await pool.end();
  process.exit(0);
});

export class DatabaseService {
  private static instance: DatabaseService;
  private pool: Pool;

  private constructor() {
    this.pool = pool;
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public async getClient(): Promise<PoolClient> {
    try {
      return await this.pool.connect();
    } catch (error) {
      logError('Failed to get database client from pool', error as Error);
      throw new DatabaseServiceError('Failed to connect to database', error as Error);
    }
  }

  public async query(text: string, params?: any[]) {
    const client = await this.getClient();
    try {
      const result = await client.query(text, params);
      return result;
    } catch (error) {
      logError('Database query failed', error as Error, { query: text, params });
      throw new DatabaseServiceError('Query execution failed', error as Error);
    } finally {
      client.release();
    }
  }

  public async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logError('Transaction failed and was rolled back', error as Error);
      throw new DatabaseServiceError('Transaction failed', error as Error);
    } finally {
      client.release();
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const result = await this.query('SELECT 1 as health_check');
      return result.rows.length > 0;
    } catch (error) {
      logError('Database health check failed', error as Error);
      return false;
    }
  }

  public getPoolStats() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}

export const databaseService = DatabaseService.getInstance();

export { pool };