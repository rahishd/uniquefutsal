import { AppError } from "../middlewares/error.middleware";
import env from "../config/env";

// The payment gateway behind the QR codes.
//
// A REAL Fonepay dynamic QR can only be created by this server with the venue's merchant account.
// Until those keys exist, the "test" gateway makes a clearly fake QR and a test endpoint can simulate
// the payment. The test gateway is refused in production (see config/env.ts).

export type OnlineMethod = "fonepay";

export interface QrRequest {
  orderCode: string;
  method: OnlineMethod;
  amount: number;
  remarks: string;
}

export interface QrResult {
  qrPayload: string;
  gatewayRef?: string;
}

export interface PaymentGateway {
  name: string;
  createQr(req: QrRequest): Promise<QrResult>;
}

class TestGateway implements PaymentGateway {
  name = "test";
  async createQr(req: QrRequest): Promise<QrResult> {
    return { qrPayload: `UF-TEST|${req.method}|NPR ${req.amount}|${req.remarks}` };
  }
}

class NotConfiguredGateway implements PaymentGateway {
  name = "not-configured";
  async createQr(): Promise<QrResult> {
    throw new AppError(503, "Online payment is not available yet. Please choose Pay at venue or try again later.");
  }
}

export function getGateway(): PaymentGateway {
  // TODO(real gateways): return a FonepayGateway here once the merchant keys exist.
  return env.PAYMENT_GATEWAY === "test" ? new TestGateway() : new NotConfiguredGateway();
}

export const isTestGateway = () => env.PAYMENT_GATEWAY === "test" && env.NODE_ENV !== "production";
