import { Response, Request } from "express";
import { nanoid } from "nanoid";
import EnvConfig from "./AppEnv";
import { Logger } from "./Logger";

import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);

export class ApiUtility {
  static logInfo(req: Request, message: string, ...otherProps: any[]) {
    if (otherProps?.length) {
      message = message + ` (Attached in jsonPayload: ${otherProps?.length})`;
    }
    const entry = Object.assign({
      severity: "INFO",
      message,
      otherProps: otherProps?.length ? otherProps : null,
    });
    // Serialize to a JSON string and output.
    Logger.info(JSON.stringify(entry));
  }

  static logError(
    req: Request,
    message: string,
    err?: Error | null,
    ...otherProps: any[]
  ) {
    if (otherProps?.length) {
      message =
        message +
        ` (Attached in jsonPayload: ${otherProps?.length}, error: ${
          err ? "Yes" : "No"
        })`;
    }
    const entry = Object.assign({
      severity: "ERROR",
      message,
      error: err?.stack ?? null,
      otherProps: otherProps?.length ? otherProps : null,
    });
    // Serialize to a JSON string and output.
    Logger.error(JSON.stringify(entry));
  }

  static getIsTestMode(): boolean {
    return EnvConfig.env;
  }

  static generateNanoId(length?: number | null): string {
    return nanoid(length);
  }

  static dateFormat(
    date?: string | Date,
    formatString: string = "YYYY-MM-DD"
  ): string {
    // If date is not provided, use current date
    if (!date) {
      return dayjs().format(formatString);
    }

    // Attempt to parse the date
    const parsedDate = dayjs(date, formatString, true);

    // If the date is invalid, return a fallback or log an error
    if (!parsedDate.isValid()) {
      console.error(`Invalid date format: ${date}`);
      return dayjs().format(formatString); // Return current date as fallback
    }

    return parsedDate.format(formatString);
  }
}
