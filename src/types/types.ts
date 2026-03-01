import { InvoiceData, VerificationStatus } from './Invoice.js';

export interface ExtractInvoiceOptions {
  apiKey: string;
  model?: string;
  maxRetries?: number;
  initialBackoffMs?: number;
}

export interface GenerateInvoiceResponse {
  text?: string;
}

export interface ProcessFromGcsOptions {
  apiKey?: string;
  model?: string;
  fileType?: string;
}

export interface ProcessFromGcsResult {
  data: InvoiceData;
  verificationStatus: 'VALID' | 'QR_MISMATCH' | 'TAMPERED';
  warning: string | null;
  QRMismatch: boolean;
}

export interface InvoiceProcessingRequestBody {
  fileUrl: string;
  options: ProcessFromGcsOptions;
}

export interface InvoiceProcessingResponse {
  extractedRawInvoice: InvoiceData;
  processedInvoice: InvoiceData;
  verificationStatus: VerificationStatus;
  warning: string | null;
  QRMismatch: boolean;
}

export interface InvoiceProcessingResponseBody {
  isSuccess: boolean;
  data: InvoiceProcessingResponse;
}
