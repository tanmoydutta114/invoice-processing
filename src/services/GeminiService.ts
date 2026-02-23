// src/services/invoice-extractor.service.ts

import { GoogleGenAI, Type } from "@google/genai";
import {
  DISALLOWED_REMARKS,
  DEFAULT_MODEL,
  DEFAULT_MAX_RETRIES,
  DEFAULT_BACKOFF,
} from "../types/Constant";
import { InvoiceData, ProductItem, OtherCharge } from "../types/Invoice";
import { ExtractInvoiceOptions, GenerateInvoiceResponse } from "../types/types";

/* -------------------------------------------------------------------------- */
/*                               Schema Builders                              */
/* -------------------------------------------------------------------------- */

const qrCodeSchema = {
  type: Type.OBJECT,
  properties: {
    sellerGstin: { type: Type.STRING },
    buyerGstin: { type: Type.STRING },
    docNo: { type: Type.STRING },
    docType: { type: Type.STRING },
    docDate: { type: Type.STRING },
    totInvVal: { type: Type.NUMBER },
    itemCnt: { type: Type.NUMBER },
    irn: { type: Type.STRING },
  },
};

const invoiceSchema = {
  type: Type.OBJECT,
  properties: {
    qrCodeData: qrCodeSchema,
    dealer: { type: Type.OBJECT },
    billingCustomer: { type: Type.OBJECT },
    shippingCustomer: { type: Type.OBJECT },
    invoiceNo: { type: Type.STRING },
    invoiceDate: { type: Type.STRING },
    ewayBillNo: { type: Type.STRING },
    irnNo: { type: Type.STRING },
    products: {
      type: Type.ARRAY,
      items: { type: Type.OBJECT },
    },
    subTotal: { type: Type.NUMBER },
    cgst: { type: Type.OBJECT },
    sgst: { type: Type.OBJECT },
    igst: { type: Type.OBJECT },
    taxAmount: { type: Type.NUMBER },
    otherCharges: {
      type: Type.ARRAY,
      items: { type: Type.OBJECT },
    },
    grandTotal: { type: Type.NUMBER },
    isTampered: { type: Type.BOOLEAN },
    remarks: { type: Type.STRING },
  },
};

/* -------------------------------------------------------------------------- */
/*                              Utility Functions                             */
/* -------------------------------------------------------------------------- */

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const sanitizeJson = (raw: string): string =>
  raw
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

const isTransientRateLimitError = (message: string): boolean =>
  message.includes("429") || message.includes("rate limit");

const isHardQuotaError = (message: string): boolean =>
  (message.includes("429") || message.includes("quota")) &&
  (message.includes("billing") || message.includes("plan"));

const ensureArray = <T>(value: unknown): T[] =>
  Array.isArray(value) ? (value as T[]) : [];

const attachIds = <T extends object>(items: T[]): (T & { id: string })[] =>
  items.map((item) => ({
    ...item,
    id: crypto.randomUUID(),
  }));

const cleanRemarks = (remarks?: string): string => {
  if (!remarks) return "";
  const normalized = remarks.trim().toLowerCase();
  const blocked = DISALLOWED_REMARKS.some((text) => normalized.includes(text));
  return blocked ? "" : remarks.trim();
};

export class GeminiService {
  async uploadFile(
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
      throw new Error("API key is required.");
    }

    if (!base64Image || !mimeType) {
      throw new Error("Invalid image input.");
    }

    const ai = new GoogleGenAI({ apiKey });

    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType,
      },
    };

    const textPart = {
      text: "Extract structured invoice data strictly as JSON.",
    };

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = (await ai.models.generateContent({
          model,
          contents: { parts: [imagePart, textPart] },
          config: {
            responseMimeType: "application/json",
            responseSchema: invoiceSchema,
          },
        })) as GenerateInvoiceResponse;

        if (!response?.text) {
          throw new Error("Empty AI response.");
        }

        const parsed = JSON.parse(
          sanitizeJson(response.text),
        ) as Partial<InvoiceData>;

        const products = attachIds<ProductItem>(
          ensureArray<ProductItem>(parsed.products),
        );

        const otherCharges = attachIds<OtherCharge>(
          ensureArray<OtherCharge>(parsed.otherCharges),
        );

        return {
          ...parsed,
          products,
          otherCharges,
          remarks: cleanRemarks(parsed.remarks),
        } as InvoiceData;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message.toLowerCase()
            : String(error).toLowerCase();

        if (isHardQuotaError(message)) {
          throw error;
        }

        if (isTransientRateLimitError(message) && attempt < maxRetries - 1) {
          const backoff =
            initialBackoffMs * 2 ** attempt + Math.random() * 1000;

          await delay(backoff);
          continue;
        }

        throw error;
      }
    }

    throw new Error("Invoice extraction failed after retries.");
  }
}
