import { PoolClient } from 'pg';
import { databaseService } from './database.service.js';
import { logInfo, logError, logDebug, logWarn } from '../utils/logger.js';
import {
  WahaMessagePayload,
  WahaMessageStatusPayload,
  Customer,
  ChatSession,
  Message,
  WhatsAppServiceError,
} from '../types/waha.types.js';

export class WhatsAppService {
  private static instance: WhatsAppService;

  private constructor() {}

  public static getInstance(): WhatsAppService {
    if (!WhatsAppService.instance) {
      WhatsAppService.instance = new WhatsAppService();
    }
    return WhatsAppService.instance;
  }

  /**
   * Handle incoming message from WAHA webhook
   */
  public async handleIncomingMessage(payload: WahaMessagePayload): Promise<void> {
    try {
      logInfo('Processing incoming message', { 
        messageId: payload.id, 
        from: payload.from,
        fromMe: payload.fromMe,
      });

      if (payload.fromMe) {
        logDebug('Skipping message from self', { messageId: payload.id });
        return;
      }

      await databaseService.transaction(async (client) => {
        const phoneNumber = this.extractPhoneNumber(payload.from);

        if (!phoneNumber || phoneNumber.length < 10) {
          logWarn('Invalid phone number detected', { from: payload.from, phoneNumber });
          return;
        }

        const customer = await this.findOrCreateCustomer(client, phoneNumber, payload);
        
        const session = await this.findOrCreateChatSession(client, customer.id);
        
        await this.saveMessage(client, customer.id, session.id, payload);
        
        await this.updateCustomerStats(client, customer.id);
        
        await this.updateSessionStats(client, session.id);
      });

      logInfo('Message processed successfully', { messageId: payload.id });
    } catch (error) {
      logError('Failed to handle incoming message', error as Error, { 
        messageId: payload.id,
        payload: payload,
      });
      throw new WhatsAppServiceError('Failed to process incoming message', error as Error);
    }
  }

  /**
   * Handle message status update from WAHA webhook
   */
  public async handleMessageStatus(payload: WahaMessageStatusPayload): Promise<void> {
    try {
      logDebug('Processing message status update', { 
        messageId: payload.id, 
        status: payload.status 
      });

      const query = `
        UPDATE messages 
        SET status = $1, updated_at = NOW() 
        WHERE waha_message_id = $2
      `;
      
      const result = await databaseService.query(query, [payload.status, payload.id]);
      
      if (result.rowCount === 0) {
        logWarn('Message not found for status update', { messageId: payload.id });
      } else {
        logDebug('Message status updated', { 
          messageId: payload.id, 
          status: payload.status 
        });
      }
    } catch (error) {
      logError('Failed to handle message status', error as Error, { 
        messageId: payload.id 
      });
      throw new WhatsAppServiceError('Failed to update message status', error as Error);
    }
  }

  /**
   * Extract phone number from WhatsApp ID
   */
  private extractPhoneNumber(waId: string): string {
    return waId.replace(/@[cg]\.us$/, '');
  }

  /**
   * Find existing customer or create new one
   */
  private async findOrCreateCustomer(
    client: PoolClient, 
    phoneNumber: string, 
    payload: WahaMessagePayload
  ): Promise<Customer> {
    const findQuery = 'SELECT * FROM customers WHERE phone_number = $1';
    const findResult = await client.query(findQuery, [phoneNumber]);

    if (findResult.rows.length > 0) {
      return findResult.rows[0] as Customer;
    }

    const insertQuery = `
      INSERT INTO customers (phone_number, name, first_message_at, last_message_at, total_messages)
      VALUES ($1, $2, $3, $3, 1)
      RETURNING *
    `;
    
    const timestamp = new Date(payload.timestamp * 1000);
    const name = payload._data?.notifyName || null;
    
    const insertResult = await client.query(insertQuery, [
      phoneNumber,
      name,
      timestamp,
    ]);

    logInfo('New customer created', { phoneNumber, name });
    return insertResult.rows[0] as Customer;
  }

  /**
   * Find active chat session or create new one
   */
  private async findOrCreateChatSession(
    client: PoolClient, 
    customerId: number
  ): Promise<ChatSession> {
    const findQuery = `
      SELECT * FROM chat_sessions 
      WHERE customer_id = $1 
        AND is_active = true 
        AND session_start > NOW() - INTERVAL '30 minutes'
      ORDER BY session_start DESC 
      LIMIT 1
    `;
    
    const findResult = await client.query(findQuery, [customerId]);

    if (findResult.rows.length > 0) {
      return findResult.rows[0] as ChatSession;
    }

    await client.query(
      'UPDATE chat_sessions SET is_active = false, session_end = NOW() WHERE customer_id = $1 AND is_active = true',
      [customerId]
    );

    const insertQuery = `
      INSERT INTO chat_sessions (customer_id, session_start, message_count, is_active)
      VALUES ($1, NOW(), 0, true)
      RETURNING *
    `;
    
    const insertResult = await client.query(insertQuery, [customerId]);
    
    logDebug('New chat session created', { customerId });
    return insertResult.rows[0] as ChatSession;
  }

  /**
   * Save message to database
   */
  private async saveMessage(
    client: PoolClient,
    customerId: number,
    sessionId: number,
    payload: WahaMessagePayload
  ): Promise<Message> {
    const insertQuery = `
      INSERT INTO messages (
        customer_id, session_id, waha_message_id, chat_id, from_number, 
        to_number, message_body, timestamp, is_from_me, reply_to
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const timestamp = new Date(payload.timestamp * 1000);
    const messageBody = payload.body || payload.caption || null;
    const toNumber = payload.to ? this.extractPhoneNumber(payload.to) : null;

    const result = await client.query(insertQuery, [
      customerId,
      sessionId,
      payload.id,
      payload.from,
      this.extractPhoneNumber(payload.from),
      toNumber,
      messageBody,
      timestamp,
      payload.fromMe,
      payload.replyTo || null,
    ]);

    return result.rows[0] as Message;
  }

  /**
   * Update customer statistics
   */
  private async updateCustomerStats(client: PoolClient, customerId: number): Promise<void> {
    const updateQuery = `
      UPDATE customers 
      SET 
        total_messages = total_messages + 1,
        last_message_at = NOW()
      WHERE id = $1
    `;
    
    await client.query(updateQuery, [customerId]);
  }

  /**
   * Update session statistics
   */
  private async updateSessionStats(client: PoolClient, sessionId: number): Promise<void> {
    const updateQuery = `
      UPDATE chat_sessions 
      SET message_count = message_count + 1
      WHERE id = $1
    `;
    
    await client.query(updateQuery, [sessionId]);
  }

  /**
   * Get customer conversation history for LLM analysis
   */
  public async getCustomerConversationHistory(customerId: number) {
    try {
      const customerQuery = 'SELECT * FROM customers WHERE id = $1';
      const customerResult = await databaseService.query(customerQuery, [customerId]);
      
      if (customerResult.rows.length === 0) {
        throw new WhatsAppServiceError(`Customer with ID ${customerId} not found`);
      }

      const customer = customerResult.rows[0] as Customer;

      const messagesQuery = `
        SELECT message_body, timestamp, is_from_me
        FROM messages 
        WHERE customer_id = $1 
          AND message_body IS NOT NULL
        ORDER BY timestamp DESC 
        LIMIT 100
      `;
      
      const messagesResult = await databaseService.query(messagesQuery, [customerId]);

      const sessionStatsQuery = `
        SELECT 
          COUNT(*) as total_sessions,
          AVG(message_count) as avg_messages_per_session,
          MAX(session_start) as last_session_start
        FROM chat_sessions 
        WHERE customer_id = $1
      `;
      
      const sessionStatsResult = await databaseService.query(sessionStatsQuery, [customerId]);
      const sessionStats = sessionStatsResult.rows[0];

      const daysAsCustomer = Math.floor(
        (Date.now() - new Date(customer.first_message_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        customerId: customer.id,
        phoneNumber: customer.phone_number,
        name: customer.name,
        totalMessages: customer.total_messages,
        firstMessageAt: customer.first_message_at,
        lastMessageAt: customer.last_message_at,
        totalSessions: parseInt(sessionStats.total_sessions) || 0,
        avgMessagesPerSession: parseFloat(sessionStats.avg_messages_per_session) || 0,
        daysAsCustomer,
        recentMessages: messagesResult.rows.map(row => ({
          messageBody: row.message_body,
          timestamp: row.timestamp,
          isFromMe: row.is_from_me,
        })),
      };
    } catch (error) {
      logError('Failed to get customer conversation history', error as Error, { customerId });
      throw new WhatsAppServiceError('Failed to retrieve conversation history', error as Error);
    }
  }

  /**
   * Update customer segment
   */
  public async updateCustomerSegment(
    customerId: number, 
    segment: string
  ): Promise<void> {
    try {
      const updateQuery = `
        UPDATE customers 
        SET segment = $1, segment_updated_at = NOW()
        WHERE id = $2
      `;
      
      await databaseService.query(updateQuery, [segment, customerId]);
      
      logInfo('Customer segment updated', { customerId, segment });
    } catch (error) {
      logError('Failed to update customer segment', error as Error, { customerId, segment });
      throw new WhatsAppServiceError('Failed to update customer segment', error as Error);
    }
  }

  /**
   * Get customers that need segmentation (no segment or segment older than 7 days)
   */
  public async getCustomersForSegmentation(limit: number = 50): Promise<Customer[]> {
    try {
      const query = `
        SELECT * FROM customers 
        WHERE (segment IS NULL OR segment_updated_at < NOW() - INTERVAL '7 days')
          AND total_messages >= 3
        ORDER BY last_message_at DESC
        LIMIT $1
      `;
      
      const result = await databaseService.query(query, [limit]);
      return result.rows as Customer[];
    } catch (error) {
      logError('Failed to get customers for segmentation', error as Error);
      throw new WhatsAppServiceError('Failed to retrieve customers for segmentation', error as Error);
    }
  }
}

export const whatsAppService = WhatsAppService.getInstance();