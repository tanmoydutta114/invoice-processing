import { TOTAL_TOLERANCE } from '../types/Constant/index.js';
import { ComparisonResult, InvoiceData, VerificationResult } from '../types/Invoice.js';
import { ApiUtility } from '../utility/ApiUtility.js';
import { Logger } from '../utility/Logger.js';

export class InvoiceController {
  static compareDates(invoiceDate: string, QRData: string): ComparisonResult {
    const formDate = ApiUtility.parseISODate(invoiceDate);
    const qrParsed = ApiUtility.parseQRDate(QRData);

    Logger.info(`Comparing dates - Invoice: ${formDate}, QR: ${qrParsed}`);

    let errors: string[] = [];

    const match = formDate.getTime() === qrParsed.getTime(); // Original strict comparison
    // const match = formDate === qrParsed;

    if (!match) {
      errors = [`Date mismatch (Invoice: ${invoiceDate}, QR: ${QRData})`];
    }
    return {
      isValid: match,
      errors,
    };
  }

  static compareInvoiceNumbers(invoiceNo: string, QRInvoiceNo: string): ComparisonResult {
    let errors: string[] = [];

    let invoiceNoNormalized = ApiUtility.normalizeInvoiceNo(invoiceNo);
    let qrInvoiceNoNormalized = ApiUtility.normalizeInvoiceNo(QRInvoiceNo);

    Logger.info(
      `Comparing invoice numbers - Invoice: "${invoiceNoNormalized}", QR: "${qrInvoiceNoNormalized}"`,
    );
    const match = invoiceNoNormalized === qrInvoiceNoNormalized;
    if (!match) {
      errors = [`Invoice # mismatch (Invoice: "${invoiceNo}", QR: "${QRInvoiceNo}")`];
    }

    return {
      isValid: match,
      errors,
    };
  }

  static compareGSTins(dealerGSTin: string, qrSellerGSTin: string): ComparisonResult {
    let errors: string[] = [];
    let dealerGSTinNormalized = ApiUtility.normalizeGSTin(dealerGSTin);
    let qrSellerGSTinNormalized = ApiUtility.normalizeGSTin(qrSellerGSTin);

    Logger;

    const match = dealerGSTinNormalized === qrSellerGSTinNormalized;

    if (!match) {
      errors = [`Seller GSTin mismatch (Invoice: "${dealerGSTin}", QR: "${qrSellerGSTin}")`];
    }

    return {
      isValid: match,
      errors,
    };
  }

  static compareTotals(grandTotal: number, QRTotal: number): ComparisonResult {
    const difference = Math.abs(grandTotal - QRTotal);
    const match = difference <= TOTAL_TOLERANCE;

    Logger.info(
      `Comparing totals - Invoice: ${grandTotal}, QR: ${QRTotal}, Difference: ${difference}, Match: ${match}`,
    );

    let errors: string[] = [];
    if (!match) {
      errors = [
        `Total mismatch (Invoice: ${grandTotal}, QR: ${QRTotal}, Difference: ${difference} exceeds tolerance of ${TOTAL_TOLERANCE})`,
      ];
    }

    return {
      isValid: match,
      errors,
    };
  }

  static verifyAgainstQR = (data: InvoiceData): ComparisonResult => {
    const QR = data.qrCodeData;

    if (!QR?.irn) {
      Logger.error('QR code data is missing or does not contain IRN. Skipping QR verification.');
      return { isValid: true, errors: [] };
    }

    const results = [
      this.compareDates(data.invoiceDate, QR.docDate),
      this.compareInvoiceNumbers(data.invoiceNo, QR.docNo),
      this.compareGSTins(data.dealer.gstin, QR.sellerGstin),
      this.compareTotals(data.grandTotal, QR.totInvVal),
    ];

    const errors = results.flatMap((r) => r.errors);

    return {
      isValid: errors.length === 0,
      errors,
    };
  };

  static async verifyInvoiceAuthenticity(data: InvoiceData): Promise<VerificationResult> {
    let error: string | null = null;
    let status: 'VALID' | 'QR_MISMATCH' | 'TAMPERED' = 'VALID';

    try {
      const qrVerification = this.verifyAgainstQR(data);

      if (!qrVerification.isValid) {
        status = 'QR_MISMATCH';
        error = `QR verification failed: ${qrVerification.errors.join('; ')}`;
      }

      if (data.isTampered) {
        status = 'TAMPERED';
        error = 'AI flagged potential visual manipulation. Manual review recommended.';
      }
    } catch (err) {
      Logger.error('Error during invoice verification', err);
      status = 'QR_MISMATCH';
      error =
        'Verification failed due to malformed invoice or QR data.' +
        (err instanceof Error ? ` Error: ${err.message}` : '');
    } finally {
      return {
        status,
        error,
      };
    }
  }

  static autoCorrectFromQR(data: InvoiceData): InvoiceData {
    const QR = data.qrCodeData;

    if (!QR?.irn) return data;

    const updated: InvoiceData = { ...data };

    if (QR.docNo) updated.invoiceNo = QR.docNo;

    if (QR.docDate) {
      const [day, month, year] = QR.docDate.split('/');
      if (day && month && year) {
        updated.invoiceDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }

    if (typeof QR.totInvVal === 'number') {
      updated.grandTotal = QR.totInvVal;
    }

    if (QR.sellerGstin) {
      updated.dealer = {
        ...updated.dealer,
        gstin: QR.sellerGstin,
      };
    }

    if (QR.buyerGstin) {
      updated.billingCustomer = {
        ...updated.billingCustomer,
        gstin: QR.buyerGstin,
      };
      updated.shippingCustomer = {
        ...updated.shippingCustomer,
        gstin: QR.buyerGstin,
      };
    }

    return updated;
  }
}
