import express, { NextFunction, Request, Response } from "express";
import { HttpError, sendErrorResponse } from "../utility/HttpError";
import { HttpStatusCode } from "../utility/HttpStatusCode";
import { get, set } from "lodash";
import { CheckPermSchemaParams } from "../types/Auth";
import { RouteUtility } from "./RouteUtility";
import { PrimarySalesService } from "../services/PrimarySalesService";

const app = express();
app.use(express.json());

// Setup Express endpoint for sending messages
app.post(
  "/api/process-invoice",
  // RouteUtility.verifyAuth(),
  // checkPermissionAndReqSchema({}),
  RouteUtility.callableWrapper(PrimarySalesService.processPrimarySales)
);

app.post(
  "/api/report-generation",
  // RouteUtility.verifyAuth(),
  // checkPermissionAndReqSchema({}),
  RouteUtility.callableWrapper(PrimarySalesService.reportGenerationAndEmail)
);

export default app;

function checkPermissionAndReqSchema<T>(params: CheckPermSchemaParams) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (params.expectedProps) {
        if (params.expectedProps.body?.length) {
          for (const bodyProp of params.expectedProps.body) {
            if (get(req.body, bodyProp) === undefined) {
              throw new HttpError(
                HttpStatusCode.BAD_REQUEST,
                "Invalid request",
                {
                  message: `${bodyProp} is missing from request body properties`,
                }
              );
            }
          }
        }
        if (params.expectedProps.params?.length) {
          for (const paramProp of params.expectedProps.params) {
            if (!get(req.params, paramProp)) {
              throw new HttpError(
                HttpStatusCode.BAD_REQUEST,
                "Invalid request",
                {
                  message: `${paramProp} is missing from request url params`,
                }
              );
            }
          }
        }
        if (params.expectedProps?.query?.length) {
          for (const queryProp of params.expectedProps.query) {
            if (!get(req.query, queryProp)) {
              throw new HttpError(
                HttpStatusCode.BAD_REQUEST,
                "Invalid request",
                {
                  message: `${queryProp} is missing from request url query`,
                }
              );
            }
          }
        }
      }

      if (params.zodValidation) {
        for (const validation of params.zodValidation) {
          const zodObject = validation.zodSchema;
          const obj = validation.bodyProp
            ? get(req.body, validation.bodyProp)
            : req.body;
          const result = zodObject.safeParse(obj);
          if (!result.success) {
            throw new HttpError(
              500,
              `System encountered an internal error. Please contact the technical support team.`,
              {
                message: `Failed to validate the request schema for ${
                  validation.bodyProp
                    ? `${validation.bodyProp} in req body`
                    : "req body"
                }`,
                objects: result.error.errors,
              }
            );
          } else {
            // Mutate the body props to remove unwanted parts of the schema such as any extra keys
            if (validation.bodyProp) {
              set(req.body, validation.bodyProp, result.data);
            } else {
              req.body = result.data;
            }
          }
        }
      }

      next();
    } catch (err: any) {
      sendErrorResponse(err, req, res);
    }
  };
}
