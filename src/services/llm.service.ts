import axios from 'axios';
import { anthropicConfig } from '../config.js';
import { logInfo, logError, logDebug } from '../utils/logger.js';
import { whatsAppService } from './whatsapp.service.js';
import {
  CustomerSegmentationData,
  SegmentationResult,
  LLMServiceError,
} from '../types/waha.types.js';
import { databaseService } from './database.service.js';

export class LLMService {
  private static instance: LLMService;
  private apiClient;

  private constructor() {
    this.apiClient = axios.create({
      baseURL: anthropicConfig.baseURL,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicConfig.apiKey,
        'anthropic-version': '2023-06-01',
      },
      timeout: 30000,
    });
  }

  public static getInstance(): LLMService {
    if (!LLMService.instance) {
      LLMService.instance = new LLMService();
    }
    return LLMService.instance;
  }

  /**
   * Segment customer based on conversation history
   */
  public async segmentCustomer(customerId: number): Promise<SegmentationResult> {
    try {
      logInfo('Starting customer segmentation', { customerId });

      const customerData = await whatsAppService.getCustomerConversationHistory(customerId);
      
      const analysisData = this.formatCustomerDataForAnalysis(customerData);
      
      const prompt = this.createSegmentationPrompt(analysisData);
      
      const response = await this.callAnthropicAPI(prompt);
      
      const segmentationResult = this.parseSegmentationResponse(response);
      
      await whatsAppService.updateCustomerSegment(customerId, segmentationResult.segment);
      
      logInfo('Customer segmentation completed', { 
        customerId, 
        segment: segmentationResult.segment,
        confidence: segmentationResult.confidence 
      });
      
      return segmentationResult;
    } catch (error) {
      logError('Customer segmentation failed', error as Error, { customerId });
      throw new LLMServiceError('Failed to segment customer', error as Error);
    }
  }

  /**
   * Format customer data for LLM analysis
   */
  private formatCustomerDataForAnalysis(data: any): CustomerSegmentationData {
    const messages = data.recentMessages || [];
    const messagesByHour = messages.reduce((acc: Record<number, number>, msg: any) => {
      const hour = new Date(msg.timestamp).getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {});

    const mostActiveHours = Object.entries(messagesByHour)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));

    const allText = messages
      .filter((msg: any) => !msg.isFromMe && msg.messageBody)
      .map((msg: any) => msg.messageBody.toLowerCase())
      .join(' ');
    
    const commonWords = this.extractCommonTopics(allText);

    return {
      customerId: data.customerId,
      phoneNumber: data.phoneNumber,
      totalMessages: data.totalMessages,
      firstMessageAt: data.firstMessageAt,
      lastMessageAt: data.lastMessageAt,
      totalSessions: data.totalSessions,
      avgMessagesPerSession: data.avgMessagesPerSession,
      daysAsCustomer: data.daysAsCustomer,
      recentMessages: messages.slice(0, 20),
      conversationPatterns: {
        mostActiveHours,
        averageResponseTime: this.calculateAverageResponseTime(messages),
        commonTopics: commonWords,
      },
    };
  }

  /**
   * Extract common topics from conversation text
   */
  private extractCommonTopics(text: string): string[] {
    const commonWords = text
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !/^(yang|untuk|dengan|adalah|akan|jadi|bisa|kalo|gimana|kenapa)$/.test(word))
      .reduce((acc: Record<string, number>, word) => {
        acc[word] = (acc[word] || 0) + 1;
        return acc;
      }, {});

    return Object.entries(commonWords)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * Calculate average response time between messages
   */
  private calculateAverageResponseTime(messages: any[]): number {
    if (messages.length < 2) return 0;

    const sortedMessages = messages.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let totalResponseTime = 0;
    let responseCount = 0;

    for (let i = 1; i < sortedMessages.length; i++) {
      const current = sortedMessages[i];
      const previous = sortedMessages[i - 1];
      
      if (!current.isFromMe && previous.isFromMe) {
        const responseTime = new Date(current.timestamp).getTime() - new Date(previous.timestamp).getTime();
        totalResponseTime += responseTime;
        responseCount++;
      }
    }

    return responseCount > 0 ? totalResponseTime / responseCount / 1000 : 0;
  }

  /**
   * Create segmentation prompt for Anthropic
   */
  private createSegmentationPrompt(data: CustomerSegmentationData): string {
    return `Anda adalah seorang ahli analisis pelanggan yang tugasnya melakukan segmentasi pelanggan berdasarkan data percakapan WhatsApp mereka. 

Analisis data pelanggan berikut dan tentukan segmen yang paling sesuai:

DATA PELANGGAN:
- ID: ${data.customerId}
- Nomor Telepon: ${data.phoneNumber}
- Total Pesan: ${data.totalMessages}
- Hari sebagai Pelanggan: ${data.daysAsCustomer}
- Total Sesi Chat: ${data.totalSessions}
- Rata-rata Pesan per Sesi: ${data.avgMessagesPerSession.toFixed(2)}
- Jam Paling Aktif: ${data.conversationPatterns.mostActiveHours.join(', ')}
- Waktu Respons Rata-rata: ${data.conversationPatterns.averageResponseTime.toFixed(2)} detik
- Topik Umum: ${data.conversationPatterns.commonTopics.join(', ')}

PESAN TERBARU:
${data.recentMessages.map((msg, idx) => 
  `${idx + 1}. [${msg.isFromMe ? 'BISNIS' : 'PELANGGAN'}] ${new Date(msg.timestamp).toLocaleString('id-ID')}: ${msg.messageBody}`
).join('\n')}

SEGMEN YANG TERSEDIA:
1. "VIP_CUSTOMER" - Pelanggan dengan value tinggi, sering berinteraksi, loyal
2. "REGULAR_CUSTOMER" - Pelanggan biasa dengan pola interaksi normal
3. "POTENTIAL_CUSTOMER" - Prospek yang menunjukkan minat tapi belum commit
4. "SUPPORT_SEEKER" - Terutama mencari bantuan atau support
5. "PRICE_SENSITIVE" - Sangat memperhatikan harga dan penawaran
6. "INACTIVE_CUSTOMER" - Pelanggan yang sudah jarang berinteraksi
7. "NEW_CUSTOMER" - Pelanggan baru yang baru mulai berinteraksi

INSTRUKSI:
Analisis pola percakapan, frekuensi interaksi, topik pembahasan, dan perilaku pelanggan. Berikan respons dalam format JSON yang valid:

{
  "segment": "NAMA_SEGMEN",
  "confidence": 0.85,
  "reasoning": "Penjelasan singkat mengapa pelanggan masuk ke segmen ini",
  "characteristics": ["karakteristik1", "karakteristik2", "karakteristik3"]
}

Pastikan confidence score antara 0.0-1.0 dan reasoning dalam bahasa Indonesia yang jelas dan singkat.`;
  }

  /**
   * Call Anthropic API
   */
  private async callAnthropicAPI(prompt: string): Promise<string> {
    try {
      logDebug('Calling Anthropic API for customer segmentation');

      const response = await this.apiClient.post('/v1/messages', {
        model: anthropicConfig.model,
        max_tokens: anthropicConfig.maxTokens,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      if (!response.data || !response.data.content || !response.data.content[0]) {
        throw new Error('Invalid response structure from Anthropic API');
      }

      return response.data.content[0].text;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error?.message || error.message;
        logError('Anthropic API request failed', new Error(message));
        throw new LLMServiceError(`Anthropic API error: ${message}`, error);
      }
      throw new LLMServiceError('Failed to call Anthropic API', error as Error);
    }
  }

  /**
   * Parse and validate segmentation response from LLM
   */
  private parseSegmentationResponse(response: string): SegmentationResult {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in LLM response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      const validSegments = [
        'VIP_CUSTOMER', 'REGULAR_CUSTOMER', 'POTENTIAL_CUSTOMER',
        'SUPPORT_SEEKER', 'PRICE_SENSITIVE', 'INACTIVE_CUSTOMER', 'NEW_CUSTOMER'
      ];

      if (!validSegments.includes(parsed.segment)) {
        throw new Error(`Invalid segment: ${parsed.segment}`);
      }

      if (typeof parsed.confidence !== 'number' || parsed.confidence < 0 || parsed.confidence > 1) {
        throw new Error('Invalid confidence score');
      }

      return {
        segment: parsed.segment,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning || 'No reasoning provided',
        characteristics: Array.isArray(parsed.characteristics) ? parsed.characteristics : [],
      };
    } catch (error) {
      logError('Failed to parse LLM segmentation response', error as Error, { response });
      
      return {
        segment: 'REGULAR_CUSTOMER',
        confidence: 0.5,
        reasoning: 'Failed to parse LLM response, assigned default segment',
        characteristics: ['parsing_error'],
      };
    }
  }

  /**
   * Batch segment multiple customers
   */
  public async batchSegmentCustomers(customerIds: number[]): Promise<Map<number, SegmentationResult>> {
    const results = new Map<number, SegmentationResult>();
    
    logInfo('Starting batch customer segmentation', { customerCount: customerIds.length });

    for (const customerId of customerIds) {
      try {
        const result = await this.segmentCustomer(customerId);
        results.set(customerId, result);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        logError('Failed to segment customer in batch', error as Error, { customerId });
      }
    }

    logInfo('Batch customer segmentation completed', { 
      total: customerIds.length,
      successful: results.size 
    });

    return results;
  }

  /**
   * Get segmentation statistics
   */
  public async getSegmentationStats(): Promise<Record<string, number>> {
    try {
      const query = `
        SELECT segment, COUNT(*) as count
        FROM customers 
        WHERE segment IS NOT NULL
        GROUP BY segment
        ORDER BY count DESC
      `;
      
      const result = await databaseService.query(query);
      
      return result.rows.reduce((acc: Record<string, number>, row) => {
        acc[row.segment] = parseInt(row.count);
        return acc;
      }, {});
    } catch (error) {
      logError('Failed to get segmentation statistics', error as Error);
      throw new LLMServiceError('Failed to retrieve segmentation statistics', error as Error);
    }
  }
}
export const llmService = LLMService.getInstance();