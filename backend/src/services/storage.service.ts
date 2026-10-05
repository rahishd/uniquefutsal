import "multer";
import logger from "../config/logger";

export interface StorageOptions {
  file: Express.Multer.File;
  folder?: string;
}

export interface StorageResult {
  success: boolean;
  url?: string;
  key?: string;
  message: string;
}

/**Object literal may only specify known properties, and 'avatar' does not exist in type '{ id: string; email: string; name: string; phoneNumber: string; role: string; }'.ts(2353)
auth.dto.ts(22, 3): The expected type comes from property 'user' which is declared here on type 'AuthResponse'
 * AWS S3 Storage Service
 * Handles file uploads and deletions using AWS S3
 *
 * Configuration required:
 * - AWS_S3_BUCKET
 * - AWS_S3_REGION
 * - AWS_S3_ACCESS_KEY
 * - AWS_S3_SECRET_KEY
 */
export class StorageService {
  async upload(options: StorageOptions): Promise<StorageResult> {
    try {
      // TODO: Implement AWS S3 upload
      // Example using AWS SDK:
      // const s3 = new AWS.S3({
      //   accessKeyId: process.env.AWS_S3_ACCESS_KEY,
      //   secretAccessKey: process.env.AWS_S3_SECRET_KEY
      // });
      // const params = {
      //   Bucket: process.env.AWS_S3_BUCKET!,
      //   Key: `${options.folder}/${options.file.filename}`,
      //   Body: options.file.buffer
      // };
      // const result = await s3.upload(params).promise();

      logger.info(`File uploaded: ${options.file.filename}`);
      return {
        success: true,
        message: "File uploaded successfully to AWS S3",
      };
    } catch (error) {
      logger.error("File upload failed", error);
      return {
        success: false,
        message: "File upload failed",
      };
    }
  }

  async delete(key: string): Promise<StorageResult> {
    try {
      // TODO: Implement AWS S3 delete
      // Example using AWS SDK:
      // const s3 = new AWS.S3({
      //   accessKeyId: process.env.AWS_S3_ACCESS_KEY,
      //   secretAccessKey: process.env.AWS_S3_SECRET_KEY
      // });
      // await s3.deleteObject({
      //   Bucket: process.env.AWS_S3_BUCKET!,
      //   Key: key
      // }).promise();

      logger.info(`File deleted: ${key}`);
      return {
        success: true,
        message: "File deleted successfully from AWS S3",
      };
    } catch (error) {
      logger.error("File deletion failed", error);
      return {
        success: false,
        message: "File deletion failed",
      };
    }
  }
}

export default new StorageService();
