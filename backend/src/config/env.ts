import dotenv from "dotenv";

dotenv.config();

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "host.docker.internal"]);

/**
 * Safety guard for customer data: outside production the database MUST be local.
 * A development or test run can therefore never touch the real (Neon) customer database,
 * even if someone pastes the production connection string into .env by mistake.
 */
export function assertSafeDatabaseUrl(databaseUrl: string, nodeEnv: string): void {
  if (nodeEnv === "production") return;
  let host = "";
  try {
    host = new URL(databaseUrl).hostname.toLowerCase();
  } catch {
    throw new Error("DATABASE_URL is not a valid URL.");
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `Refusing to start: NODE_ENV=${nodeEnv} but DATABASE_URL points to "${host}". ` +
        "Development and tests must use a local database (see docker-compose.yml) so real customer records are never touched.",
    );
  }
}

const PLACEHOLDER = /^(your_|change[-_ ]?me|secret$)/i;

function requireSecret(name: string, value: string | undefined): string {
  if (!value || value.length < 16 || PLACEHOLDER.test(value)) {
    throw new Error(`${name} must be set to a random string of at least 16 characters.`);
  }
  return value;
}

const NODE_ENV = process.env.NODE_ENV || "development";
const DATABASE_URL = process.env.DATABASE_URL || "";

if (!DATABASE_URL) throw new Error("DATABASE_URL is required.");
assertSafeDatabaseUrl(DATABASE_URL, NODE_ENV);

if (NODE_ENV === "production" && (process.env.PAYMENT_GATEWAY || "test") === "test") {
  throw new Error("PAYMENT_GATEWAY=test is not allowed in production. Configure a real payment gateway first.");
}

export const env = {
  NODE_ENV,
  PORT: Number(process.env.PORT) || 5000,
  DATABASE_URL,
  JWT_SECRET: requireSecret("JWT_SECRET", process.env.JWT_SECRET),
  JWT_EXPIRE: process.env.JWT_EXPIRE || "7d",
  REFRESH_TOKEN_SECRET: requireSecret("REFRESH_TOKEN_SECRET", process.env.REFRESH_TOKEN_SECRET),
  REFRESH_TOKEN_EXPIRE: process.env.REFRESH_TOKEN_EXPIRE || "30d",
  // OTP / SMS verification is switched OFF. Signup and login use phone + password only.
  OTP_ENABLED: process.env.OTP_ENABLED === "true",
  // Which payment gateway adapter to use: "test" (local fake) until the real Fonepay keys exist.
  PAYMENT_GATEWAY: process.env.PAYMENT_GATEWAY || "test",
  // Web Push (closed-app alerts). Keys come from `npx web-push generate-vapid-keys`; empty = push is off.
  VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY || "",
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY || "",
  VAPID_SUBJECT: process.env.VAPID_SUBJECT || "mailto:admin@example.com",
  // Google sign-in used as the second factor for password reset. Empty = reset is unavailable.
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
};

export default env;
