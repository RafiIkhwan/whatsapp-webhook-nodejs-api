import { Router } from 'express';
import { WebhookController } from '../controllers/webhook.controller.js';
import { DebugController } from '../controllers/debug.controller.js';

const router = Router();

router.post('/webhook', WebhookController.handleWebhook);

router.all('/webhook/raw', DebugController.rawWebhook);

router.all('/webhook/debug', WebhookController.debugWebhook);

router.get('/health', WebhookController.healthCheck);

router.get('/segmentation/stats', WebhookController.getSegmentationStats);
router.post('/segmentation/customer/:customerId', WebhookController.segmentCustomer);

export default router;