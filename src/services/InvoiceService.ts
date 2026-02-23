import { TOTAL_TOLERANCE } from "../types/Constant";
import {
  ComparisonResult,
  InvoiceData,
  VerificationResult,
} from "../types/Invoice";

/* -------------------------------------------------------------------------- */
/*                              Field Comparisons                             */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*                             QR Verification Core                           */
/* -------------------------------------------------------------------------- */

export class InvoiceService {
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
