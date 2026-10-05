import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

type RequiredR2Env =
  | "R2_ENDPOINT"
  | "R2_ACCESS_KEY_ID"
  | "R2_SECRET_ACCESS_KEY"
  | "R2_BUCKET_NAME"
  | "R2_PUBLIC_URL";

let s3Client: S3Client | null = null;

const getRequiredEnv = (key: RequiredR2Env): string => {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const getR2Client = (): S3Client => {
  if (!s3Client) {
    s3Client = new S3Client({
      region: "auto",
      endpoint: getRequiredEnv("R2_ENDPOINT"),
      credentials: {
        accessKeyId: getRequiredEnv("R2_ACCESS_KEY_ID"),
        secretAccessKey: getRequiredEnv("R2_SECRET_ACCESS_KEY"),
      },
    });
  }
  return s3Client;
};

const parseDataUrl = (base64Image: string): Buffer => {
  const sanitized = base64Image.trim();
  const match = sanitized.match(
    /^data:(image\/[A-Za-z0-9.+-]+);base64,([\s\S]+)$/i,
  );

  if (!match) {
    throw new Error("Invalid image payload. Expected a base64 image data URL.");
  }

  return Buffer.from(match[2], "base64");
};

const sanitizeKey = (key: string): string =>
  key
    .trim()
    .replace(/[^a-zA-Z0-9/_-]/g, "_")
    .replace(/_+/g, "_");

const compressAvatar = async (buffer: Buffer): Promise<Buffer> => {
  return sharp(buffer)
    .rotate()
    .resize({
      width: 1024,
      height: 1024,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 78, progressive: true, mozjpeg: true })
    .toBuffer();
};

export const uploadFileToR2 = async (
  buffer: Buffer,
  filename: string,
  contentType: string,
): Promise<string> => {
  const key = sanitizeKey(filename);
  const bucket = getRequiredEnv("R2_BUCKET_NAME");
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  });

  await getR2Client().send(command);

  const publicUrl = getRequiredEnv("R2_PUBLIC_URL").replace(/\/+$/, "");
  return `${publicUrl}/${key}`;
};

export const uploadBase64ToR2 = async (
  base64Image: string,
  filename: string,
): Promise<string> => {
  try {
    const sourceBuffer = parseDataUrl(base64Image);
    const optimizedBuffer = await compressAvatar(sourceBuffer);
    const key = `${filename}.jpg`;
    
    // Check if R2_ENDPOINT is present to decide whether to attempt upload
    if (!process.env.R2_ENDPOINT) {
      console.warn("R2 storage not configured locally. Using base64 directly.");
      return base64Image;
    }

    return await uploadFileToR2(optimizedBuffer, key, "image/jpeg");
  } catch (error: any) {
    console.warn("R2 upload failed or not configured, falling back to base64:", error.message);
    return base64Image;
  }
};
