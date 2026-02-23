export interface ExtractInvoiceOptions {
  apiKey: string;
  model?: string;
  maxRetries?: number;
  initialBackoffMs?: number;
}

export interface GenerateInvoiceResponse {
  text?: string;
}
