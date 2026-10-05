import nodemailer from "nodemailer";
import logger from "../config/logger";

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "localhost",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  async send(options: EmailOptions): Promise<boolean> {
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || "noreply@unique.com",
        ...options,
      });
      logger.info(`Email sent to ${options.to}`);
      return true;
    } catch (error) {
      logger.error("Failed to send email", error);
      return false;
    }
  }

  async sendBatch(emails: EmailOptions[]): Promise<boolean[]> {
    return Promise.all(emails.map((email) => this.send(email)));
  }
}

export default new EmailService();
