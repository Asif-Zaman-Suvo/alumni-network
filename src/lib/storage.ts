import { createClient } from "@supabase/supabase-js";
import { clientEnv, serverEnv } from "@/env";

/**
 * Server-only Supabase client. Uses the service role key, so it must never be imported
 * into a client component. Two buckets with deliberately different exposure:
 *
 *  - avatars (public read): served through next/image.
 *  - verification-documents (private): SSC certificates, readable only via short-lived
 *    signed URLs minted in the admin DAL.
 */
const supabase = createClient(
  clientEnv.NEXT_PUBLIC_SUPABASE_URL,
  serverEnv.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

export const CERTIFICATE_BUCKET = serverEnv.SUPABASE_CERTIFICATE_BUCKET;
export const AVATAR_BUCKET = serverEnv.SUPABASE_AVATAR_BUCKET;

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ALLOWED_DOCUMENT_TYPES = [...ALLOWED_IMAGE_TYPES, "application/pdf"] as const;

const CERTIFICATE_URL_TTL_SECONDS = 120;

function extensionFor(contentType: string): string {
  switch (contentType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "application/pdf":
      return "pdf";
    default:
      return "jpg";
  }
}

export type UploadResult = { ok: true; path: string } | { ok: false; error: string };

export async function uploadCertificate(
  userId: string,
  file: File,
): Promise<UploadResult> {
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "File must be 5 MB or smaller." };
  }
  if (!ALLOWED_DOCUMENT_TYPES.includes(file.type as (typeof ALLOWED_DOCUMENT_TYPES)[number])) {
    return { ok: false, error: "Upload a JPG, PNG, WebP or PDF file." };
  }

  const path = `${userId}/${Date.now()}.${extensionFor(file.type)}`;
  const { error } = await supabase.storage
    .from(CERTIFICATE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    console.error("[storage] certificate upload failed:", error);
    return { ok: false, error: "Could not store the file. Please try again." };
  }

  return { ok: true, path };
}

export async function uploadAvatar(userId: string, file: File): Promise<UploadResult> {
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Image must be 5 MB or smaller." };
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return { ok: false, error: "Upload a JPG, PNG or WebP image." };
  }

  const path = `${userId}/avatar-${Date.now()}.${extensionFor(file.type)}`;
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });

  if (error) {
    console.error("[storage] avatar upload failed:", error);
    return { ok: false, error: "Could not store the image. Please try again." };
  }

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return { ok: true, path: data.publicUrl };
}

/**
 * Mints a short-lived URL for a certificate. Only the admin DAL may call this.
 */
export async function createCertificateSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(CERTIFICATE_BUCKET)
    .createSignedUrl(path, CERTIFICATE_URL_TTL_SECONDS);

  if (error || !data) {
    console.error("[storage] could not sign certificate URL:", error);
    return null;
  }

  return data.signedUrl;
}

export async function removeAvatar(publicUrl: string): Promise<void> {
  const marker = `/${AVATAR_BUCKET}/`;
  const index = publicUrl.indexOf(marker);
  if (index === -1) return;

  const path = publicUrl.slice(index + marker.length);
  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([path]);
  if (error) console.error("[storage] could not remove avatar:", error);
}
