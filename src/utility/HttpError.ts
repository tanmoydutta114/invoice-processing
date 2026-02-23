import { Response, Request } from "express";
import { HttpStatusCode } from "./HttpStatusCode";
import { ApiUtility } from "./ApiUtility";
import { Logger } from "./Logger";

export class HttpError extends Error {
  errorCode: HttpStatusCode;
  errorInfo: {
    message: string;
    objects?: Array<any> | Record<string, string>;
  } | null;

  constructor(
    errorCode: HttpStatusCode,
    m: string | null,
    errorInfo: {
      message: string;
      objects?: Array<any> | Record<string, string>;
    } | null = null
  ) {
    super(m ?? "");
    this.errorCode = errorCode;
    this.errorInfo = errorInfo;
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, HttpError.prototype);
  }

  sendResponse(res: Response) {
    return res
      .status(this.errorCode)
      .send({ isSuccess: false, message: this.message });
  }
}

export async function sendErrorResponse(
  err: Error,
  req: Request,
  res: Response,
  defaultMsg: string | null = null
) {
  Logger.info(`Action: `, {
    url: req.url,
    method: req.method,
    req,
  });
  const errorMessage =
    (err instanceof HttpError && err?.errorInfo?.message) ||
    err?.message ||
    defaultMsg ||
    "Error occurred";

  if (err instanceof HttpError) {
    Logger.error(err?.errorInfo?.message ?? err?.message ?? "Error occurred", {
      req,
      err,
      errorObj: err.errorInfo?.objects,
      url: req.url,
      method: req.method,
    });
    err.sendResponse(res);
  } else {
    Logger.error(err?.message ?? "Error occurred", {
      req,
      err,
      url: req.url,
      method: req.method,
    });
    res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).send({
      isSuccess: false,
      message: defaultMsg ?? err?.message ?? "An unknown error occurred",
    });
  }
}
