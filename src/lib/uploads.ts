import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile, unlink, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { prisma } from "./db";
import { env } from "./env";
import { ApiError } from "./security";

export type ImageMime = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

/** Identify an image by its magic bytes — never trust the client-supplied MIME type or extension. */
export function sniffImage(buf: Buffer): ImageMime | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf.toString("ascii", 0, 6) === "GIF87a" || buf.toString("ascii", 0, 6) === "GIF89a") return "image/gif";
  return null;
}

const EXT: Record<ImageMime, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };

function uploadRoot() {
  // Serverless platforms only allow writes to /tmp
  return process.env.VERCEL ? "/tmp/ams-uploads" : path.resolve(/* turbopackIgnore: true */ env.UPLOAD_DIR);
}

export async function validateImageFile(file: File): Promise<{ buffer: Buffer; mime: ImageMime }> {
  if (file.size === 0) throw new ApiError(400, "The file is empty.", "EMPTY_FILE");
  if (file.size > env.UPLOAD_MAX_BYTES) throw new ApiError(413, `Images must be smaller than ${Math.round(env.UPLOAD_MAX_BYTES / 1024 / 1024)} MB.`, "FILE_TOO_LARGE");
  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = sniffImage(buffer);
  if (!mime) throw new ApiError(415, "Unsupported file. Upload a PNG, JPEG, WebP or GIF image.", "UNSUPPORTED_TYPE");
  return { buffer, mime };
}

/** Persist an upload outside the web root with a random name and an expiry for automatic cleanup. */
export async function storeUpload(buffer: Buffer, mime: ImageMime, owner: { userId: string | null; guestId: string }) {
  const day = new Date().toISOString().slice(0, 10);
  const name = `${randomBytes(16).toString("hex")}.${EXT[mime]}`;
  const dir = path.join(/* turbopackIgnore: true */ uploadRoot(), day);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await writeFile(path.join(/* turbopackIgnore: true */ dir, name), buffer, { mode: 0o600 });
  const storageKey = `${day}/${name}`;
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const expiresAt = new Date(Date.now() + env.UPLOAD_TTL_HOURS * 3600_000);
  const record = process.env.DATABASE_URL
    ? await prisma.upload
        .create({ data: { userId: owner.userId, guestId: owner.userId ? null : owner.guestId, storageKey, mimeType: mime, sizeBytes: buffer.length, sha256, expiresAt } })
        .catch(() => null)
    : null;
  return { id: record?.id ?? null, storageKey, sha256 };
}

/** Delete expired uploads from disk and mark them deleted. Safe to run from cron. */
export async function cleanupUploads(): Promise<{ deleted: number; orphans: number }> {
  let deleted = 0;
  let orphans = 0;
  const root = uploadRoot();
  if (process.env.DATABASE_URL) {
    const expired = await prisma.upload.findMany({ where: { expiresAt: { lt: new Date() }, status: { not: "DELETED" } }, take: 1000 });
    for (const u of expired) {
      await unlink(path.join(/* turbopackIgnore: true */ root, u.storageKey)).catch(() => undefined);
      await prisma.upload.update({ where: { id: u.id }, data: { status: "DELETED" } });
      deleted++;
    }
  }
  // Remove stray files older than the TTL (e.g. if the DB write failed)
  const cutoff = Date.now() - env.UPLOAD_TTL_HOURS * 3600_000;
  try {
    for (const day of await readdir(root)) {
      const dir = path.join(/* turbopackIgnore: true */ root, day);
      for (const f of await readdir(dir)) {
        const p = path.join(/* turbopackIgnore: true */ dir, f);
        const st = await stat(p);
        if (st.mtimeMs < cutoff) {
          await unlink(p).catch(() => undefined);
          orphans++;
        }
      }
    }
  } catch {
    /* directory may not exist yet */
  }
  return { deleted, orphans };
}
