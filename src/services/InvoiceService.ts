import { TOTAL_TOLERANCE } from "../types/Constant";
import {
  ComparisonResult,
  InvoiceData,
  VerificationResult,
} from "../types/Invoice";

const normalizeInvoiceNo = (value: string): string =>
  value.replace(/[\s\W_]+/g, "").toLowerCase();

const normalizeGstin = (value: string): string =>
  value.replace(/\s+/g, "").toUpperCase();

const parseISODate = (value: string): Date => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const parseQRDate = (value: string): Date => {
  const [day, month, year] = value.split("/").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

/* -------------------------------------------------------------------------- */
/*                              Field Comparisons                             */
/* -------------------------------------------------------------------------- */

const compareDates = (
  invoiceDate: string,
  qrDate: string,
): ComparisonResult => {
  const formDate = parseISODate(invoiceDate);
  const qrParsed = parseQRDate(qrDate);

  const match = formDate.getTime() === qrParsed.getTime();

  return {
    isValid: match,
    errors: match
      ? []
      : [`Date mismatch (Invoice: ${invoiceDate}, QR: ${qrDate})`],
  };
};

const compareInvoiceNumbers = (
  invoiceNo: string,
  qrInvoiceNo: string,
): ComparisonResult => {
  const match =
    normalizeInvoiceNo(invoiceNo) === normalizeInvoiceNo(qrInvoiceNo);

  return {
    isValid: match,
    errors: match
      ? []
      : [`Invoice # mismatch (Invoice: "${invoiceNo}", QR: "${qrInvoiceNo}")`],
  };
};

const compareGstins = (
  dealerGstin: string,
  qrSellerGstin: string,
): ComparisonResult => {
  const match = normalizeGstin(dealerGstin) === normalizeGstin(qrSellerGstin);

  return {
    isValid: match,
    errors: match
      ? []
      : [
          `Seller GSTIN mismatch (Invoice: "${dealerGstin}", QR: "${qrSellerGstin}")`,
        ],
  };
};

const compareTotals = (
  grandTotal: number,
  qrTotal: number,
): ComparisonResult => {
  const difference = Math.abs(grandTotal - qrTotal);
  const match = difference <= TOTAL_TOLERANCE;

  return {
    isValid: match,
    errors: match
      ? []
      : [`Total mismatch (Invoice: ${grandTotal}, QR: ${qrTotal})`],
  };
};

/* -------------------------------------------------------------------------- */
/*                             QR Verification Core                           */
/* -------------------------------------------------------------------------- */

const verifyAgainstQr = (data: InvoiceData): ComparisonResult => {
  const qr = data.qrCodeData;

  if (!qr?.irn) {
    return { isValid: true, errors: [] };
  }

  const results = [
    compareDates(data.invoiceDate, qr.docDate),
    compareInvoiceNumbers(data.invoiceNo, qr.docNo),
    compareGstins(data.dealer.gstin, qr.sellerGstin),
    compareTotals(data.grandTotal, qr.totInvVal),
  ];

  const errors = results.flatMap((r) => r.errors);

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export class InvoiceService {
  async verifyInvoiceAuthenticity(
    data: InvoiceData,
  ): Promise<VerificationResult> {
    try {
      const qrVerification = verifyAgainstQr(data);

      if (!qrVerification.isValid) {
        return {
          status: "QR_MISMATCH",
          error: `QR verification failed: ${qrVerification.errors.join("; ")}`,
        };
      }

      if (data.isTampered) {
        return {
          status: "TAMPERED",
          error:
            "AI flagged potential visual manipulation. Manual review recommended.",
        };
      }

      return { status: "VALID", error: null };
    } catch {
      return {
        status: "QR_MISMATCH",
        error: "Verification failed due to malformed invoice or QR data.",
      };
    }
  }

  autoCorrectFromQr = (data: InvoiceData): InvoiceData => {
    const qr = data.qrCodeData;

    if (!qr?.irn) return data;

    const updated: InvoiceData = { ...data };

    if (qr.docNo) updated.invoiceNo = qr.docNo;

    if (qr.docDate) {
      const [day, month, year] = qr.docDate.split("/");
      if (day && month && year) {
        updated.invoiceDate = `${year}-${month.padStart(
          2,
          "0",
        )}-${day.padStart(2, "0")}`;
      }
    }

    if (typeof qr.totInvVal === "number") {
      updated.grandTotal = qr.totInvVal;
    }

    if (qr.sellerGstin) {
      updated.dealer = {
        ...updated.dealer,
        gstin: qr.sellerGstin,
      };
    }

    if (qr.buyerGstin) {
      updated.billingCustomer = {
        ...updated.billingCustomer,
        gstin: qr.buyerGstin,
      };
      updated.shippingCustomer = {
        ...updated.shippingCustomer,
        gstin: qr.buyerGstin,
      };
    }

    return updated;
  };

  processInvoiceFromGcs = async (
    fileUrl: string,
    options: ProcessFromGcsOptions,
  ): Promise<ProcessFromGcsResult> => {
    if (!fileUrl) {
      throw new Error("GCS file URL is required.");
    }

    const { base64, mimeType } = await fetchFileFromUrl(fileUrl);

    const extracted = await extractInvoiceData(base64, mimeType, {
      apiKey: options.apiKey,
      model: options.model,
    });

    const processedData = autoCorrectFromQr(extracted);

    const verification = await this.verifyInvoiceAuthenticity(processedData);

    return {
      data: processedData,
      verificationStatus: verification.status,
      warning: verification.status !== "VALID" ? verification.error : null,
      saveDisabled: verification.status === "QR_MISMATCH",
    };
  };
}
