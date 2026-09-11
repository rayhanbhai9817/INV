"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface SearchableOption {
  value: string;
  label: string;
  /** Optional right-aligned hint, e.g. current stock. */
  meta?: string;
}

export interface SearchableSelectProps {
  label?: string;
  value: string;
  options: SearchableOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  emptyMessage?: string;
}

/** Type-ahead dropdown used wherever a product must be picked. */
export function SearchableSelect({
  label,
  value,
  options,
  onChange,
  placeholder = "Select…",
  error,
  hint,
  required,
  disabled,
  emptyMessage = "No matches",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(term) ||
        (option.meta ?? "").toLowerCase().includes(term),
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div className="w-full" ref={containerRef}>
      {label && (
        <span className="mb-1 block text-sm font-medium text-slate-700">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </span>
      )}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setOpen((previous) => !previous);
            setQuery("");
          }}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm shadow-sm transition",
            "focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50",
            error
              ? "border-red-400 focus:border-red-500 focus:ring-red-100"
              : "border-slate-300 focus:border-brand-500 focus:ring-brand-100",
          )}
        >
          <span className={cn("truncate", selected ? "text-slate-900" : "text-slate-400")}>
            {selected ? selected.label : placeholder}
          </span>
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-slate-400">
            <path
              fillRule="evenodd"
              d="M5.2 7.5a1 1 0 0 1 1.4 0L10 10.9l3.4-3.4a1 1 0 1 1 1.4 1.4l-4.1 4.1a1 1 0 0 1-1.4 0L5.2 8.9a1 1 0 0 1 0-1.4Z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {open && (
          <div className="absolute z-30 mt-1 w-full animate-fade-in overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
            <div className="border-b border-slate-100 p-2">
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Type to search…"
                className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <ul className="max-h-60 overflow-y-auto py-1 text-sm">
              {filtered.length === 0 && (
                <li className="px-3 py-6 text-center text-xs text-slate-500">{emptyMessage}</li>
              )}
              {filtered.map((option) => (
                <li key={option.value}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-slate-50",
                      option.value === value && "bg-brand-50 text-brand-700",
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                    {option.meta && (
                      <span className="shrink-0 text-xs text-slate-500">{option.meta}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}
