import { InvoiceData } from './Invoice.js';

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
  apiKey: string;
  model?: string;
}

export interface ProcessFromGcsResult {
  data: InvoiceData;
  verificationStatus: 'VALID' | 'QR_MISMATCH' | 'TAMPERED';
  warning: string | null;
  saveDisabled: boolean;
}

export interface InvoiceProcessingRequestBody {
  fileUrl: string;
  options: ProcessFromGcsOptions;
}
