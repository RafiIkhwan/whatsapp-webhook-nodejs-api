import { config } from 'dotenv';
import { z } from 'zod';

config();

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('9000'),
  DATABASE_URL: z.string().min(1, 'Database URL is required'),
  ANTHROPIC_API_KEY: z.string().min(1, 'Anthropic API key is required'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  WAHA_URL: z.string().url().optional(),
  WAHA_API_KEY: z.string().optional(),
});

const parseConfig = () => {
  try {
    return configSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      throw new Error(`Configuration validation failed:\n${missingVars.join('\n')}`);
    }
    throw error;
  }
};

export const appConfig = parseConfig();

export const isDevelopment = appConfig.NODE_ENV === 'development';
export const isProduction = appConfig.NODE_ENV === 'production';

export const dbConfig = {
  connectionString: appConfig.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

export const anthropicConfig = {
  apiKey: appConfig.ANTHROPIC_API_KEY,
  baseURL: 'https://api.anthropic.com',
  maxTokens: 4000,
  model: 'claude-3-7-sonnet-20250219',
};

export const wahaConfig = {
  url: appConfig.WAHA_URL || 'http://localhost:3000',
  apiKey: appConfig.WAHA_API_KEY,
};