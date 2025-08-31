import app from './app.js';
import { appConfig } from './config.js';
import { logInfo, logError } from './utils/logger.js';
import { databaseService } from './services/database.service.js';

/**
 * Start the Express server
 */
async function startServer(): Promise<void> {
  try {
    logInfo('Checking database connection...');
    const dbHealthy = await databaseService.healthCheck();
    
    if (!dbHealthy) {
      throw new Error('Database connection failed. Please check your database configuration.');
    }
    
    logInfo('Database connection successful');

    const fs = await import('fs');
    const path = await import('path');
    
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
      logInfo('Created logs directory');
    }

    const server = app.listen(appConfig.PORT, () => {
      logInfo('🚀 WhatsApp Analytics Server Started', {
        port: appConfig.PORT,
        environment: appConfig.NODE_ENV,
        nodeVersion: process.version,
        platform: process.platform,
        memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        endpoints: {
          webhook: `http://localhost:${appConfig.PORT}/api/webhook`,
          health: `http://localhost:${appConfig.PORT}/api/health`,
          segmentationStats: `http://localhost:${appConfig.PORT}/api/segmentation/stats`,
        },
      });
    });

    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logError(`Port ${appConfig.PORT} is already in use`, error);
      } else {
        logError('Server error occurred', error);
      }
      process.exit(1);
    });

    const gracefulShutdown = (signal: string) => {
      logInfo(`Received ${signal}, shutting down gracefully...`);
      
      server.close(async (err) => {
        if (err) {
          logError('Error during server shutdown', err);
          process.exit(1);
        }
        
        try {
          await databaseService.close();
          logInfo('Database connections closed');
        } catch (dbError) {
          logError('Error closing database connections', dbError as Error);
        }
        
        logInfo('Server shut down successfully');
        process.exit(0);
      });

      setTimeout(() => {
        logError('Forcing shutdown due to timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logError('Failed to start server', error as Error);
    process.exit(1);
  }
}

startServer().catch((error) => {
  logError('Fatal error during server startup', error);
  process.exit(1);
});