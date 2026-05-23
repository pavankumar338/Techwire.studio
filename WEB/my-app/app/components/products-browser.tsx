"use client";

import type { ProductRecord } from "@/lib/products";
import { useEffect, useMemo, useState } from "react";

type ProductsResponse = {
  filters: {
    category?: string;
    subcategory?: string;
    partNumber?: string;
    search?: string;
  };
  summary: {
    productCount: number;
    categoryCount: number;
    subcategoryCount: number;
    associationCount: number;
  };
  products: ProductRecord[];
};

type FilterState = {
  category: string;
  subcategory: string;
  partNumber: string;
};

const initialFilters: FilterState = {
  category: "",
  subcategory: "",
  partNumber: "",
};

const hiddenColumns = new Set(["id", "created_at"]);

function buildQueryString(filters: FilterState) {
  const params = new URLSearchParams();

  if (filters.category.trim()) {
    params.set("category", filters.category.trim());
  }

  if (filters.subcategory.trim()) {
    params.set("subcategory", filters.subcategory.trim());
  }

  if (filters.partNumber.trim()) {
    params.set("partNumber", filters.partNumber.trim());
  }

  return params.toString();
}

function buildSearchQueryString(searchTerm: string) {
  const params = new URLSearchParams();

  if (searchTerm.trim()) {
    params.set("search", searchTerm.trim());
  }

  return params.toString();
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(formatCellValue).join(", ");
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function formatColumnLabel(column: string) {
  return column;
}

function getRawColumns(products: ProductRecord[]) {
  const columns: string[] = [];
  const seen = new Set<string>();

  for (const product of products) {
    for (const column of Object.keys(product.raw)) {
      if (hiddenColumns.has(column)) {
        continue;
      }

      if (seen.has(column)) {
        continue;
      }

      seen.add(column);
      columns.push(column);
    }
  }

  return columns;
}

export function ProductsBrowser() {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [searchTerm, setSearchTerm] = useState("");
  const [data, setData] = useState<ProductsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProducts() {
      setLoading(true);
      setError(null);

      try {
        const queryString = buildQueryString(filters);
        const searchQueryString = buildSearchQueryString(searchTerm);
        const requestQueryString = [queryString, searchQueryString]
          .filter(Boolean)
          .join("&");
        const response = await fetch(
          requestQueryString ? `/api/products?${requestQueryString}` : "/api/products",
          {
            signal: controller.signal,
            cache: "no-store",
          }
        );

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as
            | { message?: string; details?: string }
            | null;
          throw new Error(
            payload?.details || payload?.message || "Failed to fetch products."
          );
        }

        const payload = (await response.json()) as ProductsResponse;
        setData(payload);
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }

        setError(
          loadError instanceof Error ? loadError.message : "Failed to load products."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadProducts();

    return () => controller.abort();
  }, [filters, searchTerm]);

  const products = data?.products ?? [];

  const tableColumns = useMemo(() => {
    return getRawColumns(products);
  }, [products]);

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <div className="grid gap-6 rounded-[2rem] border border-[var(--card-border)] bg-[var(--card)] p-6 shadow-[0_24px_80px_rgba(17,17,17,0.08)] backdrop-blur-xl lg:p-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--accent)]">
              REST API + Supabase catalog
            </p>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Browse the Supabase products table with the same columns and rows.
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base">
              The table view preserves the raw product rows returned by the API, while CSV
              association rules are still interpreted server-side for the product metadata.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:w-[32rem]">
            <Metric label="Products" value={data?.summary.productCount ?? 0} />
            <Metric label="Categories" value={data?.summary.categoryCount ?? 0} />
            <Metric label="Subcategories" value={data?.summary.subcategoryCount ?? 0} />
            <Metric label="Associations" value={data?.summary.associationCount ?? 0} />
          </div>
        </div>

        <div className="grid gap-3 rounded-[1.5rem] border border-[var(--card-border)] bg-white/70 p-4 shadow-sm lg:grid-cols-[1.2fr_1.2fr_1fr_auto] lg:items-end">
          <label className="space-y-2 text-sm font-medium text-[var(--foreground)] lg:col-span-4">
            Search table
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search any column or value"
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-[var(--foreground)]">
            Category
            <input
              value={filters.category}
              onChange={(event) =>
                setFilters((current) => ({ ...current, category: event.target.value }))
              }
              placeholder="Filter by category"
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-[var(--foreground)]">
            Subcategory
            <input
              value={filters.subcategory}
              onChange={(event) =>
                setFilters((current) => ({ ...current, subcategory: event.target.value }))
              }
              placeholder="Filter by subcategory"
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-[var(--foreground)]">
            Part number
            <input
              value={filters.partNumber}
              onChange={(event) =>
                setFilters((current) => ({ ...current, partNumber: event.target.value }))
              }
              placeholder="Search part number"
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
            />
          </label>

          <button
            type="button"
            onClick={() => setFilters(initialFilters)}
            className="inline-flex h-12 items-center justify-center rounded-2xl border border-black/10 bg-[var(--foreground)] px-5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Reset
          </button>
        </div>

        {error ? (
          <div className="rounded-[1.25rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="overflow-hidden rounded-[1.5rem] border border-black/5 bg-white/75">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-black/5 text-left text-sm">
                <thead className="bg-white/80 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Loading table
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 bg-white/70">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <tr key={index}>
                      <td className="px-4 py-4">
                        <div className="h-5 w-full animate-pulse rounded bg-black/5" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : products.length > 0 ? (
          <div className="overflow-hidden rounded-[1.5rem] border border-[var(--card-border)] bg-white/75">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-black/5 text-left text-sm">
                <thead className="bg-white/80 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                  <tr>
                    {tableColumns.map((column) => (
                      <th
                        key={column}
                        scope="col"
                        className="px-4 py-3 font-semibold whitespace-nowrap"
                      >
                        {formatColumnLabel(column)}
                      </th>
                    ))}
                    {tableColumns.length === 0 ? (
                      <th scope="col" className="px-4 py-3 font-semibold">
                        No columns found
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 bg-white/70">
                  {products.map((product) => (
                    <tr key={product.id} className="align-top transition hover:bg-white">
                      {tableColumns.map((column) => (
                        <td key={column} className="px-4 py-4 text-[var(--foreground)]">
                          {formatCellValue(product.raw[column])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-[1.5rem] border border-dashed border-black/15 bg-white/75 p-10 text-center">
            <h3 className="text-xl font-semibold">No products matched the current search.</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Try a different search term or clear the filters.
            </p>
            <p className="mt-4 text-xs text-[var(--muted)]">
              Showing {products.length} record(s) from the API.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--card-border)] bg-white/80 p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}