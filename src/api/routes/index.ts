import { Router } from 'express';
import webhookRoutes from './webhook.routes.js';

const router = Router();

router.use('/api', webhookRoutes);

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'WhatsApp Analytics API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      webhook: '/api/webhook',
      health: '/api/health',
      segmentationStats: '/api/segmentation/stats',
      segmentCustomer: '/api/segmentation/customer/:customerId',
    },
  });
});

router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method,
  });
});

export default router;