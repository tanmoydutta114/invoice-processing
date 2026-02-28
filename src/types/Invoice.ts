export type ID = string;
export type ISODateString = string;
export type Currency = number;
export type Percentage = number;

export interface BaseEntity {
  id?: ID;
}

export interface PersonBase {
  name: string;
  address: string;
  mobile: string;
  gstin: string;
}

export interface Customer extends PersonBase {
  city: string;
  state: string;
  pin: string;
}

export interface Dealer extends PersonBase {}

export interface ProductItem extends BaseEntity {
  name: string;
  thickness: string;
  size: string;
  productCode: string;
  quantity: number;
  uom: string;
  rate: Currency;
  amount: Currency;
}

export interface TaxInfo {
  percentage: Percentage;
  amount: Currency;
}

export interface InvoiceTaxes {
  cgst?: TaxInfo;
  sgst?: TaxInfo;
  igst?: TaxInfo;
  total: Currency;
}

export interface OtherCharge extends BaseEntity {
  description: string;
  amount: Currency;
}

export interface QRCodePayload {
  sellerGstin: string;
  buyerGstin: string;
  docNo: string;
  docType: string;
  docDate: string; // DD/MM/YYYY
  totInvVal: Currency;
  itemCnt: number;
  irn: string;
}

export interface InvoiceMeta {
  savedAt?: ISODateString;
  confidenceScore?: number;
  userEmail?: string;
  invoiceFileUrl?: string;
  isTampered?: boolean;
}

export interface InvoiceData extends BaseEntity, InvoiceMeta {
  qrCodeData?: QRCodePayload;

  dealer: Dealer;
  billingCustomer: Customer;
  shippingCustomer: Customer;

  invoiceNo: string;
  invoiceDate: string; // ISODateString
  ewayBillNo: string; //
  irnNo: string;

  products: ProductItem[];

  subTotal: Currency;
  taxes: InvoiceTaxes;
  otherCharges?: OtherCharge[];
  grandTotal: Currency;

  remarks: string;
}

export interface FileMeta {
  fileName: string;
  fileSize: number;
  fileLastModified: number;
  fileType: string;
  fileDataUrl: string;
}

export interface InvoiceDraft {
  formData: InvoiceData;
  file: FileMeta;
}

export type VerificationStatus = 'VALID' | 'QR_MISMATCH' | 'TAMPERED';

export interface VerificationResult {
  status: VerificationStatus;
  error: string | null;
}

export interface ComparisonResult {
  isValid: boolean;
  errors: string[];
}
