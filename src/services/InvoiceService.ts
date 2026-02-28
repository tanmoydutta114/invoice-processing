import { Request, Response } from 'express';
import { GoogleStorageController } from '../controllers/GoogleStorageController.js';
import { InvoiceController } from '../controllers/InvoiceController.js';
import {
  InvoiceProcessingRequestBody,
  ProcessFromGcsOptions,
  ProcessFromGcsResult,
} from '../types/types.js';
import { GeminiService } from './GeminiService.js';
import EnvConfig from '../utility/AppEnv.js';

export class InvoiceService {
  static async processInvoiceFromGCPBucket(
    fileUrl: string,
    options: ProcessFromGcsOptions,
  ): Promise<ProcessFromGcsResult> {
    if (!fileUrl) {
      throw new Error('GCS file URL is required.');
    }

    const { fetchFileFromUrl } = new GoogleStorageController();

    const { base64, mimeType } = await fetchFileFromUrl(fileUrl);

    const extracted = await GeminiService.extractInvoiceData(base64, mimeType, {
      apiKey: EnvConfig.geminiApiKey,
      model: EnvConfig.geminiModel,
    });

    const processedData = InvoiceController.autoCorrectFromQR(extracted);

    const verification = await InvoiceController.verifyInvoiceAuthenticity(processedData);

    return {
      data: processedData,
      verificationStatus: verification.status,
      warning: verification.status !== 'VALID' ? verification.error : null,
      QRMismatch: verification.status === 'QR_MISMATCH',
    };
  }
  static async processInvoices(req: Request, res: Response) {
    const invoicePath: InvoiceProcessingRequestBody = req.body
      ?.invoicePath as InvoiceProcessingRequestBody;

    try {
      const response = await InvoiceService.processInvoiceFromGCPBucket(
        invoicePath.fileUrl,
        invoicePath.options,
      );
      return res.status(200).json(response);
    } catch (err) {
      return res.status(500).json({ error: 'Order failed', details: err });
    }
  }
}
