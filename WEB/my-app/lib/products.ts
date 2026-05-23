export type RawProductRow = Record<string, unknown>;

export type ProductRecord = {
  id: string;
  category: string;
  subcategory: string;
  partNumber: string;
  datasheetUrl: string | null;
  associatedColumns: string[];
  raw: RawProductRow;
};

export type ProductFilters = {
  category?: string;
  subcategory?: string;
  partNumber?: string;
  search?: string;
};

type GroupedProduct = {
  category: string;
  subcategories: Array<{
    name: string;
    products: ProductRecord[];
  }>;
};

const RESERVED_KEYS = new Set([
  "id",
  "category",
  "product_category",
  "subcategory",
  "sub_category",
  "part_number",
  "partnumber",
  "partNumber",
  "part_no",
  "partNo",
  "sku",
  "name",
  "product_name",
  "datasheet_url",
  "datasheetUrl",
  "datasheet",
  "associated_columns",
  "association_columns",
  "associations",
  "created_at",
  "updated_at",
  "raw",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(toText).filter(Boolean).join(", ");
  }

  if (isObject(value)) {
    return JSON.stringify(value);
  }

  return String(value).trim();
}

function firstText(row: RawProductRow, keys: string[]): string {
  for (const key of keys) {
    const value = toText(row[key]);
    if (value) {
      return value;
    }
  }

  return "";
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function parseAssociatedColumns(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(toText).filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map(toText).filter(Boolean);
      }
    } catch {
      return trimmed
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
  }

  return [];
}

export function isAssociatedCellValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 || trimmed === "-";
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return true;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (isObject(value)) {
    return Object.keys(value).length > 0;
  }

  return false;
}

function deriveAssociatedColumns(row: RawProductRow): string[] {
  const explicit = parseAssociatedColumns(
    row.associated_columns ?? row.association_columns ?? row.associations
  );

  if (explicit.length > 0) {
    return explicit;
  }

  return Object.entries(row)
    .filter(([key, value]) => {
      if (RESERVED_KEYS.has(key)) {
        return false;
      }

      return isAssociatedCellValue(value);
    })
    .map(([key]) => key)
    .sort((left, right) => left.localeCompare(right));
}

export function normalizeProduct(
  row: RawProductRow,
  index: number
): ProductRecord {
  const category = firstText(row, ["category", "product_category"]) || "Uncategorized";
  const subcategory =
    firstText(row, ["subcategory", "sub_category"]) || "General";
  const partNumber =
    firstText(row, ["part_number", "partNumber", "part_no", "partNo", "sku"]) ||
    `part-${index + 1}`;
  const datasheetUrl = firstText(row, ["datasheet_url", "datasheetUrl", "datasheet"]) || null;

  return {
    id:
      toText(row.id) ||
      `${normalizeKey(category)}-${normalizeKey(subcategory)}-${normalizeKey(partNumber)}-${index}`,
    category,
    subcategory,
    partNumber,
    datasheetUrl,
    associatedColumns: deriveAssociatedColumns(row),
    raw: row,
  };
}

export function normalizeProducts(rows: RawProductRow[]): ProductRecord[] {
  return rows.map((row, index) => normalizeProduct(row, index));
}

export function filterProducts(
  products: ProductRecord[],
  filters: ProductFilters
): ProductRecord[] {
  const categoryFilter = filters.category?.trim().toLowerCase();
  const subcategoryFilter = filters.subcategory?.trim().toLowerCase();
  const partNumberFilter = filters.partNumber?.trim().toLowerCase();
  const searchFilter = filters.search?.trim().toLowerCase();

  return products.filter((product) => {
    if (
      categoryFilter &&
      !product.category.trim().toLowerCase().includes(categoryFilter)
    ) {
      return false;
    }

    if (
      subcategoryFilter &&
      !product.subcategory.trim().toLowerCase().includes(subcategoryFilter)
    ) {
      return false;
    }

    if (
      partNumberFilter &&
      !product.partNumber.trim().toLowerCase().includes(partNumberFilter)
    ) {
      return false;
    }

    if (searchFilter) {
      const searchableValues = [
        product.category,
        product.subcategory,
        product.partNumber,
        product.datasheetUrl ?? "",
        ...Object.values(product.raw),
      ];

      const matchesSearch = searchableValues.some((value) => {
        if (value === null || value === undefined) {
          return false;
        }

        if (typeof value === "string") {
          return value.toLowerCase().includes(searchFilter);
        }

        if (typeof value === "number" || typeof value === "boolean") {
          return String(value).toLowerCase().includes(searchFilter);
        }

        if (Array.isArray(value)) {
          return value
            .map((entry) => String(entry).toLowerCase())
            .some((entry) => entry.includes(searchFilter));
        }

        return JSON.stringify(value).toLowerCase().includes(searchFilter);
      });

      if (!matchesSearch) {
        return false;
      }
    }

    return true;
  });
}

export function groupProducts(products: ProductRecord[]): GroupedProduct[] {
  const categoryMap = new Map<string, Map<string, ProductRecord[]>>();

  for (const product of products) {
    const category = product.category || "Uncategorized";
    const subcategory = product.subcategory || "General";

    if (!categoryMap.has(category)) {
      categoryMap.set(category, new Map());
    }

    const subcategoryMap = categoryMap.get(category);

    if (!subcategoryMap.has(subcategory)) {
      subcategoryMap.set(subcategory, []);
    }

    subcategoryMap.get(subcategory)?.push(product);
  }

  return [...categoryMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([category, subcategoryMap]) => ({
      category,
      subcategories: [...subcategoryMap.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, groupedProducts]) => ({
          name,
          products: groupedProducts.sort((left, right) =>
            left.partNumber.localeCompare(right.partNumber)
          ),
        })),
    }));
}

export function buildSummary(products: ProductRecord[]) {
  const categories = new Set(products.map((product) => product.category));
  const subcategories = new Set(
    products.map((product) => `${product.category}::${product.subcategory}`)
  );
  const associations = new Set<string>();

  for (const product of products) {
    for (const column of product.associatedColumns) {
      associations.add(column);
    }
  }

  return {
    productCount: products.length,
    categoryCount: categories.size,
    subcategoryCount: subcategories.size,
    associationCount: associations.size,
  };
}
