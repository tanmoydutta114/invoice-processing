import { Request, Response } from 'express';
import { GoogleStorageController } from '../controllers/GoogleStorageController.js';
import { InvoiceController } from '../controllers/InvoiceController.js';
import {
  InvoiceProcessingRequestBody,
  InvoiceProcessingResponse,
  InvoiceProcessingResponseBody,
  ProcessFromGcsOptions,
  ProcessFromGcsResult,
} from '../types/types.js';
import { GeminiService } from './GeminiService.js';
import EnvConfig from '../utility/AppEnv.js';
import { Logger } from '../utility/Logger.js';
import { unknown } from 'zod/v4';

export class InvoiceService {
  static async processInvoiceFromGCPBucket(
    fileUrl: string,
    options: ProcessFromGcsOptions,
  ): Promise<InvoiceProcessingResponse> {
    if (!fileUrl) {
      throw new Error('GCS file URL is required.');
    }

    const { downloadFileAsBase64 } = new GoogleStorageController();

    const { base64, mimeType } = await downloadFileAsBase64(fileUrl);

    Logger.info(`Downloaded file from GCS. Size: ${base64.length} bytes, MIME type: ${mimeType}`);

    const extractedRawInvoice = await GeminiService.extractInvoiceData(base64, mimeType, {
      apiKey: EnvConfig.geminiApiKey,
      model: EnvConfig.geminiModel,
    });

    Logger.info('Extracted Invoice Data:', extractedRawInvoice);

    const processedInvoice = InvoiceController.autoCorrectFromQR(extractedRawInvoice);

    Logger.info('Processed Invoice Data after auto-correction:', processedInvoice);

    const verifiedInvoice = await InvoiceController.verifyInvoiceAuthenticity(processedInvoice);

    Logger.info('Invoice Verification Result:', {
      status: verifiedInvoice.status,
      error: verifiedInvoice.error,
    });

    const response = {
      extractedRawInvoice,
      processedInvoice,
      verifiedInvoice,
      verificationStatus: verifiedInvoice.status,
      warning: verifiedInvoice.status !== 'VALID' ? verifiedInvoice.error : null,
      QRMismatch: verifiedInvoice.status === 'QR_MISMATCH',
    };

    return response;
  }

  static async testServer(req: Request, res: Response) {
    try {
      const response = {
        isSuccess: true,
        message: 'Server is running and test endpoint is working!',
      };
      return res.status(200).json(response);
    } catch (err) {
      return res
        .status(500)
        .json({ isSuccess: false, error: 'Internal server error', details: err });
    }
  }

  static async processInvoices(req: Request, res: Response) {
    const invoicePath: InvoiceProcessingRequestBody = req.body as InvoiceProcessingRequestBody;

    if (!invoicePath?.fileUrl) {
      Logger.error('Invoice path file URL is missing or invalid:', invoicePath);
      return res.status(400).json({
        isSuccess: false,
        error: 'Invoice path file URL is missing or invalid',
        details: invoicePath,
      });
    }
    try {
      const response = await InvoiceService.processInvoiceFromGCPBucket(
        invoicePath.fileUrl,
        invoicePath.options,
      );

      const invoiceProcessingResponseBody: InvoiceProcessingResponseBody = {
        isSuccess: true,
        data: response,
      };

      return res.status(200).json(invoiceProcessingResponseBody);
    } catch (err) {
      Logger.error('Error processing invoice:', err);
      return res.status(500).json({
        isSuccess: false,
        error: 'Failed to process invoice',
        details: {
          message: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        },
      });
    }
  }
}
