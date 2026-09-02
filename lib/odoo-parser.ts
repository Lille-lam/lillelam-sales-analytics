import * as XLSX from "xlsx";

export type ParsedRow = {
  sku: string | null;
  product: string | null;
  size: string | null;
  color: string | null;
  qty: number;
  line_count: number;
  revenue: number;
  row_type: "product" | "shipping" | "discount" | "total";
};

function num(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v).trim().replace(/\s/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function clean(v: unknown): string {
  return String(v ?? "").replace(/\u00a0/g, " ").trim();
}

function looksLikeSize(s: string) {
  return /^\d{1,3}(?:\/\d{1,3})?$/.test(s) || /^\d{1,3}-\d{1,3}$/.test(s) || /^\d{2,3}\+$/.test(s);
}

function parseVariant(label: string) {
  // [SKU] Product name (98, Lyng)
  const skuMatch = label.match(/^\[([^\]]+)\]\s*(.+)$/);
  if (!skuMatch) return null;
  const sku = skuMatch[1].trim();
  let rest = skuMatch[2].trim();

  let product = rest;
  let size: string | null = null;
  let color: string | null = null;

  const paren = rest.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  if (paren) {
    product = paren[1].trim();
    const options = paren[2].split(",").map(x => x.trim()).filter(Boolean);
    if (options.length >= 2) {
      size = options[0];
      color = options.slice(1).join(", ");
    } else if (options.length === 1) {
      if (looksLikeSize(options[0])) size = options[0];
      else color = options[0];
    }
  }
  return { sku, product, size, color };
}

export function parseOdooWorkbook(buffer: Buffer): ParsedRow[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true, defval: "" });

  let headerRow = -1;
  let descCol = 0, revenueCol = -1, qtyCol = -1, countCol = -1;

  for (let r = 0; r < Math.min(matrix.length, 20); r++) {
    const row = matrix[r].map(clean);
    const rev = row.findIndex(x => /total.*eks.*mva/i.test(x));
    const qty = row.findIndex(x => /antall\s*bestilt/i.test(x));
    const cnt = row.findIndex(x => /^antall$/i.test(x));
    if (rev >= 0 && qty >= 0) {
      headerRow = r;
      revenueCol = rev;
      qtyCol = qty;
      countCol = cnt;
      // Description is normally the first non-metric column before revenue.
      descCol = Math.max(0, rev - 1);
      while (descCol > 0 && row[descCol] !== "") descCol--;
      descCol = 0; // Odoo export used by Lillelam has description in first column.
      break;
    }
  }

  if (headerRow < 0) {
    // Fallback to known Lillelam layout.
    headerRow = 0;
    descCol = 0;
    revenueCol = 1;
    qtyCol = 2;
    countCol = 3;
  }

  type PendingParent = ParsedRow & { label: string };
  const output: ParsedRow[] = [];
  let pending: PendingParent | null = null;

  const flushPending = () => {
    if (pending) {
      const { label, ...row } = pending;
      output.push(row);
      pending = null;
    }
  };

  for (let r = headerRow + 1; r < matrix.length; r++) {
    const row = matrix[r];
    const label = clean(row[descCol]);
    if (!label) continue;

    const revenue = num(row[revenueCol]);
    const qty = num(row[qtyCol]);
    const line_count = countCol >= 0 ? num(row[countCol]) : 0;
    const lower = label.toLowerCase();

    if (/^total$/i.test(label)) {
      flushPending();
      output.push({ sku:null, product:null, size:null, color:null, qty, line_count, revenue, row_type:"total" });
      continue;
    }
    if (lower.includes("woocommerce shipping product") || lower.includes("woo_shipping_fees")) {
      flushPending();
      output.push({ sku:"woo_shipping_fees", product:"WooCommerce Shipping Product", size:null, color:null, qty, line_count, revenue, row_type:"shipping" });
      continue;
    }
    if (lower.includes("woocommerce discount product") || lower.includes("woo_discount")) {
      flushPending();
      output.push({ sku:"woo_discount", product:"WooCommerce Discount Product", size:null, color:null, qty, line_count, revenue, row_type:"discount" });
      continue;
    }

    const variant = parseVariant(label);
    if (variant) {
      // A variant means the preceding parent line was an aggregate: do not double-count it.
      pending = null;
      output.push({
        sku: variant.sku,
        product: variant.product,
        size: variant.size,
        color: variant.color,
        qty, line_count, revenue, row_type:"product"
      });
      continue;
    }

    // Parent/product row. We keep it only if no SKU child appears before the next parent.
    flushPending();
    pending = {
      label,
      sku:null,
      product:label,
      size:null,
      color:null,
      qty, line_count, revenue, row_type:"product"
    };
  }

  flushPending();
  return output;
}
