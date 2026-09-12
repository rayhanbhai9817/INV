"use client";

/**
 * Product image storage.
 *
 * Files live in the private `product-images` bucket, so the app never holds a
 * public URL: it stores the object path on the row and exchanges that path for
 * a short-lived signed URL when rendering.
 */

import { supabase, errorMessage } from "@/lib/supabase";

const BUCKET = "product-images";
const SIGNED_URL_TTL_SECONDS = 60 * 60;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Uploads one image and returns the stored object path. */
export async function uploadImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file (JPG, PNG, GIF or WebP).");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Image must be smaller than 5MB.");
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (error) {
    const message = errorMessage(error);
    if (/bucket/i.test(message) && /not found/i.test(message)) {
      throw new Error(
        "The product-images bucket does not exist yet. Run " +
          "supabase/migrations/20260913_images_descriptions_and_view_fix.sql in the Supabase SQL Editor.",
      );
    }
    throw new Error(message);
  }

  return path;
}

/** Best-effort removal; a failed delete must never block the row update. */
export async function removeImage(path: string | null | undefined): Promise<void> {
  if (!path) return;
  await supabase.storage.from(BUCKET).remove([path]);
}

/** Signs one stored path for display. Returns null when it cannot be signed. */
export async function signedImageUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/** Signs a batch of paths, keyed by path, skipping any that fail. */
export async function signedImageUrls(
  paths: Array<string | null | undefined>,
): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter((path): path is string => Boolean(path))));
  if (unique.length === 0) return {};

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(unique, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return {};

  const map: Record<string, string> = {};
  data.forEach((entry, index) => {
    const path = unique[index];
    if (path && entry.signedUrl) map[path] = entry.signedUrl;
  });
  return map;
}
