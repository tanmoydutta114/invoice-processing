// src/services/invoice-extractor.service.t
import { GoogleGenAI } from '@google/genai';
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
import { Logger } from '../utility/Logger.js';

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
      Logger.error('Gemini API key is missing in options');
      throw new Error('API key is required.');
    }

    if (!base64Image || !mimeType) {
      Logger.error('Base64 image data or MIME type is missing', { base64Image, mimeType });
      throw new Error('Invalid image input.');
    }

    const ai = new GoogleGenAI({ apiKey });

    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType,
      },
    };

    // Logger.info('Prepared image part for Gemini API', { imagePart });

    // const textPart = {
    //   text: INVOICE_GENERATION_PROMPT,
    // };

    const textPart = {
      text: "You are a world-class OCR expert specializing in deciphering handwritten and complex invoices. Your primary goal is perfect accuracy.\n\n**E-Invoice QR Code Protocol (ABSOLUTE HIGHEST PRIORITY):**\n- Your **FIRST and MOST IMPORTANT task** is to locate and decode any E-Invoice QR code on the document. This data is digitally signed and represents the absolute source of truth.\n- If a valid E-Invoice QR code is found, you MUST extract its data and populate the `qrCodeData` object in the JSON output. All other text on the invoice should be considered secondary to the QR code data.\n- If the visual text for a field (e.g., Invoice Number) conflicts with the QR code data for that same field, the QR code data is ALWAYS correct. You should still extract the visual text into its field, but the `qrCodeData` object MUST contain the data from the QR code itself.\n- If no E-Invoice QR code is present or it is unreadable, you may omit the `qrCodeData` object.\n\n**Expert Handwriting Analysis Protocol (Secondary Priority):**\nThis protocol requires you to act as a forensic document analyst. Scrutinize every handwritten character. Do not make assumptions. Your tolerance for error on critical fields is ZERO.\n\n1.  **Core Invoice Identifiers (Invoice No, Date, E-Way Bill):**\n    - **Invoice Number:** This is a CRITICAL field. Meticulously locate labels like 'Invoice No.', 'Bill No.', 'Inv. No.'. The value can be a mix of letters, numbers, slashes, and hyphens. Decipher it character-by-character. For example, `CP/23-24/AB-001` must be extracted exactly.\n    - **Invoice Date:** THIS IS A CRITICAL FIELD. Locate labels like 'Date', 'Dt.'. Handwritten dates can be messy (e.g., `1-4-24`, `05.10.2023`, `16 APR 24`). You must decipher them. Your final output for the date MUST be reformatted to `YYYY-MM-DD`.\n    - **E-Way Bill Number:** This is an important logistical number. Actively search for labels like 'E-Way Bill No.', 'EWB No.', or 'E-Way No.'. Extract this alphanumeric value if it is present on the invoice. If not found, return an empty string.\n\n2.  **GSTIN (Goods and Services Tax Identification Number):**\n    - This is a legally critical 15-character alphanumeric code. It is mandatory for tax purposes and MUST be extracted with perfect accuracy.\n    - Locate the 'GSTIN' label for both the dealer and the customer.\n    - Apply extreme scrutiny to common character confusions: 'O' vs '0', 'I' vs '1', 'L' vs '1', 'S' vs '5', 'Z' vs '2', 'G' vs '6', 'B' vs '8'. Double-check the length. If it's not 15 characters, re-examine the handwriting.\n\n3.  **Product Table Analysis (EXTREME PRECISION REQUIRED):**\n    - Process the table strictly row-by-row. Your primary goal is to isolate the columns for 'Product Code', 'Quantity', 'Rate', and 'Amount'.\n    - **Product Name/Description:** THIS IS THE MOST CRITICAL DESCRIPTIVE FIELD. It identifies what was sold. It is often in the widest column of the table. You MUST extract it.\n    - **Unit of Measurement (UOM):** THIS IS A FREQUENTLY MISSED, CRITICAL FIELD. Do not assume it will be in its own column.\n        - **PRIMARY SEARCH PATTERN:** Your **first action** MUST be to look for the UOM written *directly next to the quantity*. For example: '10 Pcs', '5 Nos', '20 Mtr'. This pattern is extremely common in handwritten invoices. You MUST check for this pattern first before looking for a separate column.\n        - **Secondary Search:** Only if you find no UOM next to the quantity should you then look for a separate column labeled 'UOM' or 'Unit'.\n        - Common UOMs include: Pcs, Nos, Sq.Ft., Mtr, Kg, Set, Box. You MUST extract it.\n    - **Product Code (HSN/SAC):** THIS IS A CRITICAL FIELD. Locate the column labeled 'HSN', 'SAC', 'Code', or 'Item Code'. Apply forensic-level character analysis, same as for GSTINs (e.g., 'O' vs '0', 'S' vs '5'). Extract it exactly as it appears. This is NOT the product name or description.\n    - **Rate (Price per Unit):** THIS IS A CRITICAL FIELD. Find the column labeled 'Rate', 'Price', or 'Unit Price'.\n        - **Strict Definition:** The 'Rate' is the price for a SINGLE unit of the item, before any taxes.\n        - **Crucial Distinction:** DO NOT confuse 'Rate' with the line item 'Amount' or 'Total'. The 'Amount' is the final value for that row, calculated from 'Quantity' multiplied by 'Rate'.\n        - **MANDATORY Verification Protocol:** You MUST verify your extraction. The formula `Quantity × Rate = Amount` must be your guide.\n            - **Step 1:** Extract Quantity, Rate, and Amount from their respective columns.\n            - **Step 2:** Mathematically check if `your_extracted_quantity * your_extracted_rate` is approximately equal to `your_extracted_amount`.\n            - **Step 3:** If it matches, your extraction is correct. Proceed.\n            - **Step 4:** If it does NOT match, it signifies a potential misreading. You MUST re-read the handwritten 'Quantity' and 'Rate' values with extreme care. A common error is mistaking '1' for '7' or '0' for '6'. After re-analysis, if the numbers still don't logically multiply to the 'Amount', prioritize the printed 'Amount' as it's the final calculation, but still report the 'Rate' as it is written in its column.\n            - **Sanity Check:** The 'Rate' should almost never be equal to the 'Amount' unless the 'Quantity' is exactly 1. If you find they are equal for a quantity greater than 1, you have likely extracted the wrong column for 'Rate'. Re-evaluate the table structure.\n    - **Smart Parsing for Thickness and Size:** This is a CRITICAL step. Thickness and Size are often embedded *within the product description string itself*, not in dedicated columns. You MUST parse the description to find them.\n        - **Primary Action:** If you find dedicated 'Thickness' or 'Size' columns, prioritize data from them.\n        - **Secondary Action (MANDATORY):** If those columns are absent, you MUST perform the following analysis on the full product name/description string you've identified:\n            - **Thickness Pattern Recognition:** Actively scan for patterns like `12mm`, `0.8 mm`, `19MM`. If found, extract this value into the `thickness` field. After extraction, the `name` field should be cleaned of this value. For example, from \"Century Plywood 12mm BWP\", the `thickness` becomes \"12mm\" and the `name` becomes \"Century Plywood BWP\".\n            - **Size Pattern Recognition:** Actively scan for dimensional patterns like `8x4`, `8'x4'`, `10 x 5`, or `2440x1220`. If found, extract this value into the `size` field. The `name` field should then be cleaned. For example, from \"Laminate Sheet 8x4\", the `size` becomes \"8x4\" and the `name` becomes \"Laminate Sheet\".\n    - **Final Extraction:** After completing the above steps, extract the remaining standard details like Quantity and Amount.\n\n4.  **General Rules:**\n    - **Addresses:** Find 'Bill To' and 'Ship To' sections. If 'Ship To' is missing or says 'Same', you MUST duplicate the billing address details into the shipping fields.\n    - **Illegibility:** If a field is genuinely impossible to read after all checks, return an empty string. DO NOT GUESS.\n    - **Data Formatting:** If a field is not present on the document, return an empty string (''). Do not use placeholders like 'N/A'.",
    };

    Logger.info('Starting invoice data extraction with Gemini API', { model, maxRetries });

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        Logger.info(`Attempt ${attempt + 1} to extract invoice data from image`);
        const response = (await ai.models.generateContent({
          model,
          contents: { parts: [imagePart, textPart] },
          config: {
            responseMimeType: 'application/json',
            responseSchema: INVOICE_SCHEMA,
          },
        })) as GenerateInvoiceResponse;

        Logger.info('Received response from Gemini API', { response });

        if (!response?.text) {
          Logger.error('Gemini API returned empty response', { attempt });
          throw new Error('Empty AI response.');
        }

        Logger.info('Raw AI Response:', response.text);

        const parsed = JSON.parse(ApiUtility.sanitizeJson(response.text)) as InvoiceData;

        Logger.info('Parsed AI Response:', parsed);

        if (!parsed.invoiceNo) {
          Logger.error('Parsed invoice data is missing invoice number', { parsed });
          throw new Error('Invoice number is required in the extracted data and was not found.');
        }
        const products = ApiUtility.attachIds<ProductItem>(
          ApiUtility.ensureArray<ProductItem>(parsed.products),
        );

        const otherCharges = ApiUtility.attachIds<OtherCharge>(
          ApiUtility.ensureArray<OtherCharge>(parsed.otherCharges),
        );

        const invoiceDate: InvoiceData = {
          ...parsed,
          products,
          otherCharges,
          remarks: ApiUtility.cleanRemarks(parsed.remarks, DISALLOWED_REMARKS),
        };
        return invoiceDate;
      } catch (error) {
        const message =
          error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
        Logger.error('Error during invoice data extraction attempt', { attempt, error });

        if (ApiUtility.isHardQuotaError(message)) {
          throw error;
        }

        if (ApiUtility.isTransientRateLimitError(message) && attempt < maxRetries - 1) {
          Logger.info('Transient error detected, applying backoff before retrying...', { attempt });
          const backoff = initialBackoffMs * 2 ** attempt + Math.random() * 1000;

          await ApiUtility.delay(backoff);
          continue;
        }

        throw error;
      }
    }
    Logger.error('Invoice extraction failed after maximum retries', { maxRetries });
    throw new Error('Invoice extraction failed after retries.');
  }
}
