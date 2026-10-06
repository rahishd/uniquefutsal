// The customer's Digital ID: a random QR value from the server (GET /me/digital-id). The QR holds no personal data, and
// only staff signed in to the Unique Futsal admin portal can turn it back into a customer.
import { api } from "@/lib/api";

export interface DigitalId {
  name: string;
  phone: string;
  payload: string; // "UFID1." + random token: what goes inside the QR
  createdAt: string;
  replacedAt: string | null;
}

export const loadDigitalId = () => api<DigitalId>("/me/digital-id");
export const replaceDigitalId = () => api<DigitalId>("/me/digital-id/replace", { method: "POST" });
