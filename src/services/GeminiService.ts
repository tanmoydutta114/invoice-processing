// src/services/invoice-extractor.service.t
import { Type, GoogleGenAI } from '@google/genai';
import {
  DISALLOWED_REMARKS,
  DEFAULT_MODEL,
  DEFAULT_MAX_RETRIES,
  DEFAULT_BACKOFF,
} from '../types/Constant/index.js';
import { InvoiceData, ProductItem, OtherCharge } from '../types/Invoice.js';
import { ExtractInvoiceOptions, GenerateInvoiceResponse } from '../types/types.js';
import { ApiUtility } from '../utility/ApiUtility.js';
import { INVOICE_SCHEMA } from '../types/Constant/InvoiceQR.js';

export class GeminiService {
  static async extractInvoiceData(
    base64Image: string,
    mimeType: string,
    options: ExtractInvoiceOptions,
  ): Promise<InvoiceData> {
    const {
      apiKey,
      model = DEFAULT_MODEL,
      maxRetries = DEFAULT_MAX_RETRIES,
      initialBackoffMs = DEFAULT_BACKOFF,
    } = options;

    if (!apiKey) {
      throw new Error('API key is required.');
    }

    if (!base64Image || !mimeType) {
      throw new Error('Invalid image input.');
    }

    const ai = new GoogleGenAI({ apiKey });

    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType,
      },
    };

    const textPart = {
      text: 'Extract structured invoice data strictly as JSON.',
    };

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = (await ai.models.generateContent({
          model,
          contents: { parts: [imagePart, textPart] },
          config: {
            responseMimeType: 'application/json',
            responseSchema: INVOICE_SCHEMA,
          },
        })) as GenerateInvoiceResponse;

        if (!response?.text) {
          throw new Error('Empty AI response.');
        }

        const parsed = JSON.parse(ApiUtility.sanitizeJson(response.text)) as Partial<InvoiceData>;

        const products = ApiUtility.attachIds<ProductItem>(
          ApiUtility.ensureArray<ProductItem>(parsed.products),
        );

        const otherCharges = ApiUtility.attachIds<OtherCharge>(
          ApiUtility.ensureArray<OtherCharge>(parsed.otherCharges),
        );

        return {
          ...parsed,
          products,
          otherCharges,
          remarks: ApiUtility.cleanRemarks(parsed.remarks, DISALLOWED_REMARKS),
        } as InvoiceData;
      } catch (error) {
        const message =
          error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

        if (ApiUtility.isHardQuotaError(message)) {
          throw error;
        }

        if (ApiUtility.isTransientRateLimitError(message) && attempt < maxRetries - 1) {
          const backoff = initialBackoffMs * 2 ** attempt + Math.random() * 1000;

          await ApiUtility.delay(backoff);
          continue;
        }

        throw error;
      }
    }

    throw new Error('Invoice extraction failed after retries.');
  }
}
