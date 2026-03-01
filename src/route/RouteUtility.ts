import { NextFunction, Request, Response } from 'express';
import { ApiUtility } from '../utility/ApiUtility.js';
import EnvConfig from '../utility/AppEnv.js';
import { HttpError, sendErrorResponse } from '../utility/HttpError.js';
import { HttpStatusCode } from '../utility/HttpStatusCode.js';
import { produce } from 'immer';
import { Logger } from '../utility/Logger.js';

export class RouteUtility {
  static verifyAuth() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        let authVerified: boolean = false;
        if (ApiUtility.getIsTestMode()) {
          authVerified = true;
        } else {
          const apiKey =
            req.header('x-api-key') ||
            req.header('X-API-KEY') ||
            req.header('x-api-Key') ||
            req.header('X-API-Key');

          if (EnvConfig.validKey !== apiKey) {
            authVerified = false;
            throw new HttpError(
              HttpStatusCode.FORBIDDEN,
              'A valid key is needed to call the backend!',
              {
                message: `A valid key is needed to call the backend!`,
              },
            );
          }
        }
        authVerified = true;
        Logger.info('Auth verified', {
          method: req.method,
          url: req.originalUrl,
          ip: req.ip,
          headers: {
            'x-api-key': req.header('x-api-key'),
          },
        });
        next();
      } catch (err: any) {
        sendErrorResponse(err, req, res);
      }
    };
  }
  static sanitizeObjFunc(obj: any) {
    if (obj === undefined || obj === null) {
      return obj;
    }
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        obj[i] = this.sanitizeObjFunc(obj[i]);
      }
      return obj;
    }
    return obj;
  }
  static sanitizeObjRecursively(obj: any) {
    if (obj === undefined || obj === null) {
      return obj;
    }
    return produce(obj, (draft: any) => RouteUtility.sanitizeObjFunc(draft));
  }

  static callableWrapper(fn: (req: Request, res: Response) => Promise<Response>) {
    return async (request: Request, response: Response) => {
      const requestId = ApiUtility.generateNanoId();
      try {
        // For output sanitization, need to recursively go through the body and sanitize the strings if any
        const oldSend = response.send;
        const oldJson = response.json;

        response.send = function (body: any) {
          if (Buffer.isBuffer(body ?? {})) {
            return oldSend.call(this, body);
          }
          const sanitizedBody = RouteUtility.sanitizeObjRecursively(body);
          const isJson = !!sanitizedBody && typeof sanitizedBody === 'object';
          if (isJson && !this.get('Content-Type')) {
            this.set('Content-Type', 'application/json');
          }
          return oldSend.call(this, isJson ? JSON.stringify(sanitizedBody) : sanitizedBody);
        };

        response.json = function (body: any) {
          const sanitizedBody = RouteUtility.sanitizeObjRecursively(body);
          return oldJson.call(this, sanitizedBody);
        };
        response.on('finish', () => {
          const logMessage = `Response: Status = ${response.statusCode}, Request ID = ${requestId}, Request URL = ${request.originalUrl}, Request Method = ${request.method}`;
          if (response.statusCode >= 400) {
            Logger.error(logMessage);
          } else {
            Logger.info(logMessage);
          }
        });
        await fn(request, response);
      } catch (err: any) {
        await sendErrorResponse(err, request, response);
      }
    };
  }
}
