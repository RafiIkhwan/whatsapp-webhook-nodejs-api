import express, { Application, Request, Response, NextFunction } from 'express';
import { appConfig, isDevelopment } from './config.js';
import { logInfo, logError } from './utils/logger.js';
import routes from './api/routes/index.js';

const app: Application = express();

app.set('trust proxy', 1);

app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
  
    (req as any).rawBody = buf;
  }
}));

app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logInfo('HTTP Request', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });
  });
  
  next();
});

app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  next();
});

app.use('/', routes);

app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  logError('Unhandled application error', error, {
    method: req.method,
    url: req.originalUrl,
    body: req.body,
    headers: req.headers,
  });


  const errorResponse = {
    success: false,
    message: isDevelopment ? error.message : 'Internal server error',
    ...(isDevelopment && { stack: error.stack }),
    timestamp: new Date().toISOString(),
  };

  res.status(500).json(errorResponse);
});

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method,
  });
});

const gracefulShutdown = (signal: string) => {
  return () => {
    logInfo(`Received ${signal}, starting graceful shutdown...`);
    
  
    setTimeout(() => {
      logInfo('Shutting down application');
      process.exit(0);
    }, 1000);
  };
};

process.on('SIGTERM', gracefulShutdown('SIGTERM'));
process.on('SIGINT', gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error: Error) => {
  logError('Uncaught exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown, promise: Promise<any>) => {
  logError('Unhandled promise rejection', new Error(String(reason)), {
    promise: promise.toString(),
  });
  process.exit(1);
});

export default app;