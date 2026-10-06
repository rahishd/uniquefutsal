import { randomBytes } from "crypto";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { AppError } from "../middlewares/error.middleware";
import { uploadFileToR2 } from "./r2storage";

// Photos attached to a complaint. They arrive as image data URLs (the app shrinks them first), are checked by
// really decoding them (the declared type is never trusted), stripped of location data, re-encoded as small JPEGs,
// and saved under a name WE choose. Storage is Cloudflare R2 when it is configured, otherwise the local uploads folder.

export const MAX_PHOTOS = 3;
const MAX_BYTES = 8 * 1024 * 1024; // per photo, before compression
const DATA_URL = /^data:image\/(?:jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/i;
const DIR = path.join(process.cwd(), "uploads", "complaints");

async function compress(dataUrl: unknown): Promise<Buffer> {
  const m = typeof dataUrl === "string" ? DATA_URL.exec(dataUrl.trim()) : null;
  if (!m) throw new AppError(400, "Photos must be JPG, PNG or WebP images.");
  const raw = Buffer.from(m[1], "base64");
  if (raw.length === 0 || raw.length > MAX_BYTES) throw new AppError(400, "A photo is too large. Each photo can be up to 8 MB.");
  try {
    // rotate() applies the camera orientation; metadata (GPS, device) is dropped because we do not call withMetadata()
    return await sharp(raw, { limitInputPixels: 60_000_000 })
      .rotate()
      .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
  } catch {
    throw new AppError(400, "One of the photos could not be read. Please choose a different image.");
  }
}

// Returns the public location of each photo: an absolute URL (R2) or a path under /uploads (local).
export async function savePhotos(code: string, photos: unknown): Promise<string[]> {
  if (photos === undefined || photos === null) return [];
  if (!Array.isArray(photos)) throw new AppError(400, "Photos must be a list.");
  if (photos.length > MAX_PHOTOS) throw new AppError(400, `You can attach up to ${MAX_PHOTOS} photos.`);
  const buffers = await Promise.all(photos.map(compress)); // validate every photo before saving any
  const out: string[] = [];
  for (const [i, buf] of buffers.entries()) {
    const name = `${code}-${i + 1}-${randomBytes(4).toString("hex")}.jpg`;
    if (process.env.R2_ENDPOINT) {
      out.push(await uploadFileToR2(buf, `complaints/${name}`, "image/jpeg"));
    } else {
      fs.mkdirSync(DIR, { recursive: true });
      fs.writeFileSync(path.join(DIR, name), buf);
      out.push(`/uploads/complaints/${name}`);
    }
  }
  return out;
}

export const localComplaintDir = DIR;
