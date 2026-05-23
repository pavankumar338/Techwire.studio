import { supabase } from "@/lib/supabase";
import {
  buildSummary,
  filterProducts,
  normalizeProducts,
  type ProductFilters,
} from "@/lib/products";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const productsTable = process.env.SUPABASE_PRODUCTS_TABLE ?? "products";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const filters: ProductFilters = {
    category: url.searchParams.get("category") ?? undefined,
    subcategory: url.searchParams.get("subcategory") ?? undefined,
    partNumber:
      url.searchParams.get("partNumber") ?? url.searchParams.get("part_number") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
  };

  const { data, error } = await supabase.from(productsTable).select("*");

  if (error) {
    return Response.json(
      {
        message: "Unable to load products from Supabase.",
        details: error.message,
      },
      { status: 500 }
    );
  }

  const normalized = normalizeProducts((data ?? []) as Record<string, unknown>[]);
  const products = filterProducts(normalized, filters);

  return Response.json({
    filters,
    summary: buildSummary(products),
    products,
  });
}