import { errorMessage } from "@/lib/supabase";
import type { Paginated } from "@/types";

export const DEFAULT_PAGE_SIZE = 25;

export interface PageParams {
  page?: number;
  pageSize?: number;
}

/** Converts a 1-based page into the inclusive range PostgREST expects. */
export function rangeFor({ page = 1, pageSize = DEFAULT_PAGE_SIZE }: PageParams): [number, number] {
  const safePage = Math.max(1, Math.trunc(page));
  const from = (safePage - 1) * pageSize;
  return [from, from + pageSize - 1];
}

export function assertOk(error: unknown): void {
  if (error) throw new Error(errorMessage(error));
}

export function paginated<T>(
  rows: T[] | null,
  count: number | null,
  { page = 1, pageSize = DEFAULT_PAGE_SIZE }: PageParams,
): Paginated<T> {
  return { rows: rows ?? [], count: count ?? 0, page, pageSize };
}
