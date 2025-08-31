import { Request, Response } from "express";
import { z } from "zod";
import {
  WahaWebhookSchema,
  WahaMessageWebhook,
  WahaMessageStatusWebhook,
} from "../../types/waha.types.js";
import { whatsAppService } from "../../services/whatsapp.service.js";
import { llmService } from "../../services/llm.service.js";
import { databaseService } from "../../services/database.service.js";
import { logInfo, logError, logWarn } from "../../utils/logger.js";

export class WebhookController {
  /**
   * Handle WAHA webhook events
   */
  public static async handleWebhook(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      logInfo("Received webhook", {
        event: req.body?.event,
        session: req.body?.session,
        headers: req.headers,
        fullPayload: req.body,
      });

      const validationResult = WahaWebhookSchema.safeParse(req.body);

      if (!validationResult.success) {
        logWarn("Invalid webhook payload received", {
          errors: validationResult.error.errors,
          body: req.body,
          zodErrors: validationResult.error.format(),
        });

        res.status(400).json({
          success: false,
          error: "Invalid webhook payload",
          details: validationResult.error.errors,
        });
        return;
      }

      const webhook = req.body;

      switch (webhook.event) {
        case "message":
          await WebhookController.handleMessageEvent(
            webhook as WahaMessageWebhook
          );
          break;

        case "session.status":
          await WebhookController.handleMessageStatusEvent(
            webhook as WahaMessageStatusWebhook
          );
          break;

        default:
          logWarn("Unhandled webhook event type", {
            event: (webhook as any).event,
          });
          break;
      }

      res.status(200).json({
        success: true,
        message: "Webhook processed successfully",
        event: webhook.event,
      });
    } catch (error) {
      logError("Health check failed", error as Error);
      res.status(503).json({
        success: false,
        message: "Health check failed",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Debug endpoint untuk melihat raw webhook payload
   */
  public static async debugWebhook(req: Request, res: Response): Promise<void> {
    logInfo('Debug webhook endpoint called', {
      method: req.method,
      headers: req.headers,
      body: req.body,
      query: req.query,
      params: req.params,
    });

    res.status(200).json({
      success: true,
      message: 'Debug webhook - payload logged',
      receivedData: {
        method: req.method,
        headers: req.headers,
        body: req.body,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Get segmentation statistics
   */
  public static async getSegmentationStats(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const stats = await llmService.getSegmentationStats();

      res.status(200).json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logError("Failed to get segmentation stats", error as Error);
      res.status(500).json({
        success: false,
        error: "Failed to retrieve segmentation statistics",
      });
    }
  }

  /**
   * Trigger manual segmentation for a customer
   */
  public static async segmentCustomer(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const customerIdSchema = z.object({
        customerId: z.string().transform(Number),
      });

      const { customerId } = customerIdSchema.parse(req.params);

      const result = await llmService.segmentCustomer(customerId);

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: "Invalid customer ID",
          details: error.errors,
        });
        return;
      }

      logError("Manual segmentation failed", error as Error);
      res.status(500).json({
        success: false,
        error: "Failed to segment customer",
      });
    }
  }

  /**
   * Handle message event
   */
  private static async handleMessageEvent(
    webhook: WahaMessageWebhook
  ): Promise<void> {
    try {
      logInfo("Processing message event", {
        messageId: webhook.payload.id,
        from: webhook.payload.from,
        type: webhook.payload.type,
      });

      await whatsAppService.handleIncomingMessage(webhook.payload);

      logInfo("Message event processed successfully", {
        messageId: webhook.payload.id,
      });
    } catch (error) {
      logError("Failed to process message event", error as Error, {
        messageId: webhook.payload.id,
      });
      throw error;
    }
  }

  /**
   * Handle message status event
   */
  private static async handleMessageStatusEvent(
    webhook: WahaMessageStatusWebhook
  ): Promise<void> {
    try {
      logInfo("Processing message status event", {
        messageId: webhook.payload.id,
        status: webhook.payload.status,
      });

      await whatsAppService.handleMessageStatus(webhook.payload);

      logInfo("Message status event processed successfully", {
        messageId: webhook.payload.id,
        status: webhook.payload.status,
      });
    } catch (error) {
      logError("Failed to process message status event", error as Error, {
        messageId: webhook.payload.id,
        status: webhook.payload.status,
      });
      throw error;
    }
  }

  /**
   * Health check endpoint
   */
  public static async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const dbHealth = await databaseService.healthCheck();

      if (!dbHealth) {
        res.status(503).json({
          success: false,
          message: "Database connection failed",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Service is healthy",
        timestamp: new Date().toISOString(),
        database: "connected",
      });
    } catch (error) {
      logError("Webhook processing failed", error as Error, {
        body: req.body,
        headers: req.headers,
      });

      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: "Failed to process webhook",
      });
    }
  }
}
