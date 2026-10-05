import logger from "../config/logger";

export interface SmsOptions {
  phoneNumber: string;
  message: string;
}

export class SmsService {
  private readonly apiUrl = "http://api.sparrowsms.com/v2/sms/";
  private readonly token = process.env.SPARROW_SMS_TOKEN || "";
  private readonly identity = process.env.SPARROW_SMS_IDENTITY || "";

  async send(options: SmsOptions): Promise<boolean> {
    try {
      if (!this.token || !this.identity) {
        logger.error("Sparrow SMS credentials missing in environment variables");
        return false;
      }

      const params = new URLSearchParams({
        token: this.token,
        from: this.identity,
        to: options.phoneNumber,
        text: options.message,
      });

      const response = await fetch(`${this.apiUrl}?${params.toString()}`, {
        method: "GET",
      });

      const data = (await response.json()) as any;

      if (response.ok && data.response_code === 200) {
        logger.info(`SMS sent successfully to ${options.phoneNumber}: ${data.response}`);
        return true;
      } else {
        logger.error(`Sparrow SMS error: ${data.response || "Unknown error"} (Code: ${data.response_code})`);
        return false;
      }
    } catch (error) {
      logger.error("Failed to send SMS via Sparrow", error);
      return false;
    }
  }

  async sendBatch(sms: SmsOptions[]): Promise<boolean[]> {
    return Promise.all(sms.map((message) => this.send(message)));
  }
}

export default new SmsService();
