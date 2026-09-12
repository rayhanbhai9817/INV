"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";

import { MAX_IMAGE_BYTES } from "@/lib/db/storage";
import { cn } from "@/lib/utils";

/** Square thumbnail used in tables and detail panels. */
export function Thumb({
  url,
  alt,
  size = "h-10 w-10",
}: {
  url: string | null;
  alt: string;
  size?: string;
}) {
  if (!url) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-xl bg-[#f4f7fe] text-[9px] font-black uppercase tracking-widest text-[#a3aed0] shadow-sm",
          size,
        )}
      >
        N/A
      </div>
    );
  }

  // Signed storage URLs are not a configured next/image host, so a plain img
  // keeps this working without widening the image config.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      loading="lazy"
      className={cn("shrink-0 rounded-xl object-cover shadow-sm ring-1 ring-black/5", size)}
    />
  );
}

/**
 * Picks an image and previews it. The parent keeps the chosen File and uploads
 * it on save, so nothing reaches storage until the record is written.
 */
export function ImageField({
  file,
  existingUrl,
  onSelect,
  onClear,
  busy = false,
  label = "Product Image",
}: {
  file: File | null;
  existingUrl: string | null;
  onSelect: (file: File | null) => void;
  onClear: () => void;
  busy?: boolean;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const shown = preview ?? existingUrl;

  function handleChange(nextFile: File | null) {
    setError(null);
    if (!nextFile) {
      onSelect(null);
      return;
    }
    if (!nextFile.type.startsWith("image/")) {
      setError("Choose an image file (JPG, PNG, GIF or WebP).");
      return;
    }
    if (nextFile.size > MAX_IMAGE_BYTES) {
      setError("Image must be smaller than 5MB.");
      return;
    }
    onSelect(nextFile);
  }

  return (
    <div className="space-y-2">
      <span className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
        {label}
      </span>

      <div className="flex items-center gap-4">
        <div className="relative">
          {shown ? (
            <>
              <Thumb url={shown} alt="Preview" size="h-24 w-24" />
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  onSelect(null);
                  onClear();
                  if (inputRef.current) inputRef.current.value = "";
                }}
                aria-label="Remove image"
                className="absolute -right-2 -top-2 rounded-full bg-white p-1 text-[#ee5d50] shadow-md ring-1 ring-black/5 transition hover:bg-[#ee5d50]/10"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl border-2 border-dashed border-[#e0e5f2] bg-[#f4f7fe] text-[#a3aed0]">
              {busy ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ImagePlus className="h-6 w-6" />
              )}
            </div>
          )}
        </div>

        <div className="flex-1">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={(event) => handleChange(event.target.files?.[0] ?? null)}
            className="w-full cursor-pointer rounded-xl border border-[#f4f7fe] bg-[#f4f7fe] text-xs text-[#2b3674] file:mr-4 file:cursor-pointer file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-xs file:font-black file:text-[#2b3674] hover:file:bg-[#f4f7fe]"
          />
          <p className="mt-2 text-[10px] font-medium uppercase tracking-wider text-[#a3aed0]">
            JPG, PNG or GIF. Max 5MB.
          </p>
          {error && <p className="mt-1 text-[10px] font-bold text-[#ee5d50]">{error}</p>}
        </div>
      </div>
    </div>
  );
}
