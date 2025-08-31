import { Request, Response } from 'express';
import { logInfo, logError } from '../../utils/logger.js';
import fs from 'fs';
import path from 'path';

export class DebugController {
  /**
   * Webhook tanpa validasi - terima semua payload untuk debugging
   */
  public static async rawWebhook(req: Request, res: Response): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      
      // Log semua detail request
      const debugData = {
        timestamp,
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body,
        query: req.query,
        params: req.params,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      };

      logInfo('RAW WEBHOOK RECEIVED', debugData);

      // Simpan ke file untuk analisis lebih detail
      try {
        const debugFile = path.join(process.cwd(), 'logs', `webhook-debug-${Date.now()}.json`);
        fs.writeFileSync(debugFile, JSON.stringify(debugData, null, 2));
        logInfo('Debug data saved to file', { file: debugFile });
      } catch (fileError) {
        logError('Failed to save debug file', fileError as Error);
      }

      // Analisis struktur payload
      if (req.body) {
        logInfo('PAYLOAD ANALYSIS', {
          payloadType: typeof req.body,
          isArray: Array.isArray(req.body),
          keys: typeof req.body === 'object' ? Object.keys(req.body) : 'N/A',
          eventField: req.body.event || 'NOT_FOUND',
          sessionField: req.body.session || 'NOT_FOUND',
          payloadField: req.body.payload ? 'PRESENT' : 'NOT_FOUND',
        });

        // Analisis payload.payload jika ada
        if (req.body.payload) {
          logInfo('NESTED PAYLOAD ANALYSIS', {
            payloadType: typeof req.body.payload,
            payloadKeys: typeof req.body.payload === 'object' ? Object.keys(req.body.payload) : 'N/A',
            messageId: req.body.payload.id || 'NOT_FOUND',
            messageType: req.body.payload.type || 'NOT_FOUND',
            fromField: req.body.payload.from || 'NOT_FOUND',
            timestampField: req.body.payload.timestamp || 'NOT_FOUND',
          });
        }
      }

      // Selalu return 200 untuk mencegah retry
      res.status(200).json({
        success: true,
        message: 'Raw webhook received and logged',
        timestamp,
        dataLogged: true,
      });

    } catch (error) {
      logError('Error in raw webhook handler', error as Error);
      
      // Tetap return 200 untuk debugging
      res.status(200).json({
        success: false,
        message: 'Error logged',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get recent debug logs
   */
  public static async getDebugLogs(req: Request, res: Response): Promise<void> {
    try {
      const logsDir = path.join(process.cwd(), 'logs');
      const files = fs.readdirSync(logsDir)
        .filter(file => file.startsWith('webhook-debug-'))
        .sort()
        .slice(-5); // Get last 5 debug files

      const logs = files.map(file => {
        const filePath = path.join(logsDir, file);
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          return {
            file,
            timestamp: file.replace('webhook-debug-', '').replace('.json', ''),
            data: JSON.parse(content),
          };
        } catch (e) {
          return {
            file,
            error: 'Failed to read file',
          };
        }
      });

      res.status(200).json({
        success: true,
        debugLogs: logs,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logError('Failed to get debug logs', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve debug logs',
      });
    }
  }

  /**
   * Test endpoint untuk memverifikasi aplikasi berjalan
   */
  public static async testEndpoint(req: Request, res: Response): Promise<void> {
    logInfo('Test endpoint called');
    
    res.status(200).json({
      success: true,
      message: 'Test endpoint working',
      timestamp: new Date().toISOString(),
      server: 'WhatsApp Analytics App',
      version: '1.0.0',
    });
  }
}