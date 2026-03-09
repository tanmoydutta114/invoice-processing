import { Type } from '@google/genai';

export const QR_CODE_SCHEMA = {
  type: Type.OBJECT,
  description:
    'Data extracted from the E-Invoice QR Code. If no valid E-Invoice QR code is found, this object can be omitted.',
  properties: {
    sellerGstin: { type: Type.STRING, description: "Seller's GSTIN from QR code." },
    buyerGstin: { type: Type.STRING, description: "Buyer's GSTIN from QR code." },
    docNo: { type: Type.STRING, description: 'Document/Invoice number from QR code.' },
    docType: { type: Type.STRING, description: 'Document type (e.g., INV) from QR code.' },
    docDate: { type: Type.STRING, description: 'Document date in DD/MM/YYYY format from QR code.' },
    totInvVal: { type: Type.NUMBER, description: 'Total invoice value from QR code.' },
    itemCnt: { type: Type.NUMBER, description: 'Number of line items from QR code.' },
    irn: { type: Type.STRING, description: 'Invoice Reference Number from QR code.' },
  },
};

export const INVOICE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    qrCodeData: QR_CODE_SCHEMA,
    dealer: {
      type: Type.OBJECT,
      properties: {
        name: {
          type: Type.STRING,
          description: 'The name of the dealer or company issuing the invoice.',
        },
        address: { type: Type.STRING, description: 'Full address of the dealer.' },
        mobile: { type: Type.STRING, description: 'Contact mobile number of the dealer.' },
        gstin: { type: Type.STRING, description: 'GST Identification Number of the dealer.' },
      },
    },
    billingCustomer: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'Name of the customer being billed.' },
        address: { type: Type.STRING, description: 'Billing address of the customer.' },
        city: { type: Type.STRING },
        state: { type: Type.STRING },
        pin: { type: Type.STRING, description: 'Pincode of the billing address.' },
        mobile: { type: Type.STRING, description: 'Mobile number of the customer.' },
        gstin: { type: Type.STRING, description: 'GSTIN of the customer.' },
      },
    },
    shippingCustomer: {
      type: Type.OBJECT,
      description:
        "Details for the shipping recipient. If the shipping address is the same as the billing address, duplicate the billing customer's details here.",
      properties: {
        name: {
          type: Type.STRING,
          description: 'Name for shipping. If same as billing, copy from there.',
        },
        address: {
          type: Type.STRING,
          description: 'Shipping address. If same as billing, copy from there.',
        },
        city: { type: Type.STRING },
        state: { type: Type.STRING },
        pin: { type: Type.STRING, description: 'Pincode of the shipping address.' },
        mobile: { type: Type.STRING, description: 'Mobile number for shipping contact.' },
        gstin: {
          type: Type.STRING,
          description: 'GSTIN for shipping. If same as billing, copy from there.',
        },
      },
    },
    invoiceNo: { type: Type.STRING, description: 'The unique invoice number.' },
    invoiceDate: {
      type: Type.STRING,
      description: 'The date the invoice was issued. Extract the date and format it as YYYY-MM-DD.',
    },
    ewayBillNo: { type: Type.STRING, description: 'E-Way Bill number, if present.' },
    irnNo: { type: Type.STRING, description: 'Invoice Reference Number (IRN), if present.' },
    products: {
      type: Type.ARRAY,
      description: 'List of all items in the invoice.',
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: 'Product or item name/description.' },
          thickness: {
            type: Type.STRING,
            description: "Thickness of the product, if specified (e.g., '12mm').",
          },
          size: {
            type: Type.STRING,
            description: "Size of the product, if specified (e.g., '8x4').",
          },
          productCode: { type: Type.STRING, description: 'HSN or product code.' },
          quantity: { type: Type.NUMBER, description: 'Quantity of the item.' },
          uom: {
            type: Type.STRING,
            description: 'Unit of Measurement for the quantity (e.g., pcs, kg, mtrs, sqft).',
          },
          rate: { type: Type.NUMBER, description: 'Price or rate per unit.' },
          amount: {
            type: Type.NUMBER,
            description: 'Total amount for the line item (quantity * rate).',
          },
        },
      },
    },
    subTotal: { type: Type.NUMBER, description: 'The total amount before taxes.' },
    cgst: {
      type: Type.OBJECT,
      description:
        'Central Goods and Services Tax (CGST). Include percentage and amount. Omit if not applicable.',
      properties: {
        percentage: { type: Type.NUMBER, description: 'The CGST rate percentage.' },
        amount: { type: Type.NUMBER, description: 'The calculated CGST amount.' },
      },
    },
    sgst: {
      type: Type.OBJECT,
      description:
        'State Goods and Services Tax (SGST). Include percentage and amount. Omit if not applicable.',
      properties: {
        percentage: { type: Type.NUMBER, description: 'The SGST rate percentage.' },
        amount: { type: Type.NUMBER, description: 'The calculated SGST amount.' },
      },
    },
    igst: {
      type: Type.OBJECT,
      description:
        'Integrated Goods and Services Tax (IGST). Include percentage and amount. Omit if not applicable.',
      properties: {
        percentage: { type: Type.NUMBER, description: 'The IGST rate percentage.' },
        amount: { type: Type.NUMBER, description: 'The calculated IGST amount.' },
      },
    },
    taxAmount: {
      type: Type.NUMBER,
      description: 'Total tax amount (e.g., sum of CGST, SGST, IGST).',
    },
    otherCharges: {
      type: Type.ARRAY,
      description:
        'List of any additional charges found on the invoice that are not part of the line items, such as delivery fees, packing charges, or rounding adjustments. Each item should have a description and its corresponding amount.',
      items: {
        type: Type.OBJECT,
        properties: {
          description: {
            type: Type.STRING,
            description: "Description of the charge (e.g., 'Delivery Charges').",
          },
          amount: { type: Type.NUMBER, description: 'The amount of the charge.' },
        },
      },
    },
    grandTotal: {
      type: Type.NUMBER,
      description: 'The final total amount to be paid (subTotal + taxAmount + other charges).',
    },
    isTampered: {
      type: Type.BOOLEAN,
      description:
        'Set to true if there are any signs of visual digital manipulation, such as inconsistent fonts, pixelation around numbers, or misaligned text. This check is crucial if no verifiable QR code is found. Otherwise, set to false.',
    },
    remarks: {
      type: Type.STRING,
      description:
        'Any other relevant notes or remarks from the invoice. If none, return an empty string.',
    },
  },
};
