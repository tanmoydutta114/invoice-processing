import { Type } from '@google/genai';

export const QR_CODE_SCHEMA = {
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

export const INVOICE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    qrCodeData: QR_CODE_SCHEMA,
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
