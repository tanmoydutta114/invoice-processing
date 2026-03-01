import express, { Response } from 'express';
import { RouteUtility } from './RouteUtility.js';
import { InvoiceService } from '../services/InvoiceService.js';

const app = express();
app.use(express.json());

// Setup Express endpoint for sending messages

app.get(
  '/api/test-server',
  RouteUtility.verifyAuth(),
  RouteUtility.callableWrapper(InvoiceService.testServer),
);

app.post(
  '/api/process-invoice',
  RouteUtility.verifyAuth(),
  RouteUtility.callableWrapper(InvoiceService.processInvoices),
);

export default app;
