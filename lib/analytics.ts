export type SaleRow = {
  id?: number;
  report_date: string;
  sku: string | null;
  product: string | null;
  size: string | null;
  color: string | null;
  qty: number;
  line_count: number;
  revenue: number;
  row_type: "product" | "shipping" | "discount" | "total";
};

export type Filters = {
  from: string;
  to: string;
  products: string[];
  colors: string[];
  sizes: string[];
};

const n = (v: any) => Number(v || 0);
export const money = (v: number) =>
  new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 2 }).format(v);

export function dateOnlyFilter(rows: SaleRow[], from: string, to: string) {
  return rows.filter(r => r.report_date >= from && r.report_date <= to);
}

export function productFilter(rows: SaleRow[], f: Filters) {
  return rows.filter(r => {
    if (r.row_type !== "product") return false;
    if (r.report_date < f.from || r.report_date > f.to) return false;
    if (f.products.length && !f.products.includes(r.product || "")) return false;
    if (f.colors.length && !f.colors.includes(r.color || "")) return false;
    if (f.sizes.length && !f.sizes.includes(r.size || "")) return false;
    return true;
  });
}

export function metrics(rows: SaleRow[]) {
  const productRows = rows.filter(r => r.row_type === "product");
  const shipping = rows.filter(r => r.row_type === "shipping");
  const discounts = rows.filter(r => r.row_type === "discount");
  const totals = rows.filter(r => r.row_type === "total");

  const orders = shipping.reduce((a,r)=>a+n(r.qty),0);
  const units = productRows.reduce((a,r)=>a+n(r.qty),0);
  const productRevenue = productRows.reduce((a,r)=>a+n(r.revenue),0);
  const discount = Math.abs(discounts.reduce((a,r)=>a+n(r.revenue),0));
  const shippingRevenue = shipping.reduce((a,r)=>a+n(r.revenue),0);
  const totalStored = totals.reduce((a,r)=>a+n(r.revenue),0);
  const revenue = totalStored || (productRevenue - discount + shippingRevenue);
  const products = new Set(productRows.map(r=>r.product).filter(Boolean)).size;
  const lines = productRows.reduce((a,r)=>a+n(r.line_count),0);

  return {
    revenue, orders, units, products, productRevenue, discount, shippingRevenue, lines,
    aov: orders ? revenue/orders : 0,
    avgUnitsOrder: orders ? units/orders : 0,
    avgUnitsLine: lines ? units/lines : 0,
    discountShare: productRevenue ? discount/productRevenue : 0
  };
}

export function filteredMetrics(productRows: SaleRow[], periodOrders: number) {
  const units = productRows.reduce((a,r)=>a+n(r.qty),0);
  const revenue = productRows.reduce((a,r)=>a+n(r.revenue),0);
  const products = new Set(productRows.map(r=>r.product).filter(Boolean)).size;
  return {
    products, units, revenue,
    avgUnitsOrder: periodOrders ? units/periodOrders : 0,
    revenuePerUnit: units ? revenue/units : 0
  };
}

export function groupBy(rows: SaleRow[], key: "product"|"color"|"size") {
  const m = new Map<string, {name:string, units:number, revenue:number, lines:number}>();
  rows.forEach(r => {
    const name = (r[key] || "—") as string;
    const x = m.get(name) || {name, units:0, revenue:0, lines:0};
    x.units += n(r.qty); x.revenue += n(r.revenue); x.lines += n(r.line_count);
    m.set(name,x);
  });
  return [...m.values()].map(x => ({...x, revenuePerUnit:x.units?x.revenue/x.units:0}));
}

export function variants(rows: SaleRow[]) {
  const m = new Map<string, any>();
  rows.forEach(r => {
    const key = `${r.product||"—"}|||${r.color||"—"}|||${r.size||"—"}`;
    const x = m.get(key) || {product:r.product||"—", color:r.color||"—", size:r.size||"—", units:0, revenue:0, lines:0};
    x.units += n(r.qty); x.revenue += n(r.revenue); x.lines += n(r.line_count);
    m.set(key,x);
  });
  return [...m.values()].map(x=>({...x,revenuePerUnit:x.units?x.revenue/x.units:0}));
}

export function daily(rows: SaleRow[]) {
  const days = [...new Set(rows.map(r=>r.report_date))].sort();
  return days.map(date => {
    const m = metrics(rows.filter(r=>r.report_date===date));
    return {date, revenue:m.revenue, orders:m.orders, units:m.units, aov:m.aov, discount:m.discount};
  });
}

export function pct(current:number, previous:number) {
  if (!previous) return current ? 100 : 0;
  return ((current-previous)/previous)*100;
}

export function comparePeriods(rows: SaleRow[], from:string, to:string) {
  const date = new Date(to+"T12:00:00");
  const iso = (d:Date)=>d.toISOString().slice(0,10);
  const shift = (d:Date, days:number)=>{ const x=new Date(d); x.setDate(x.getDate()+days); return x; };

  const today = metrics(dateOnlyFilter(rows, to, to));
  const yesterdayDate = iso(shift(date,-1));
  const yesterday = metrics(dateOnlyFilter(rows, yesterdayDate, yesterdayDate));

  const weekStart = iso(shift(date,-6));
  const prevWeekStart = iso(shift(date,-13));
  const prevWeekEnd = iso(shift(date,-7));
  const wowNow = metrics(dateOnlyFilter(rows, weekStart, to));
  const wowPrev = metrics(dateOnlyFilter(rows, prevWeekStart, prevWeekEnd));

  const monthStart = `${to.slice(0,7)}-01`;
  const prevMonthEndD = new Date(monthStart+"T12:00:00"); prevMonthEndD.setDate(0);
  const prevMonthStart = `${prevMonthEndD.getFullYear()}-${String(prevMonthEndD.getMonth()+1).padStart(2,"0")}-01`;
  const dayOfMonth = date.getDate();
  const prevEquivalent = new Date(prevMonthStart+"T12:00:00");
  prevEquivalent.setDate(Math.min(dayOfMonth, prevMonthEndD.getDate()));
  const momNow = metrics(dateOnlyFilter(rows, monthStart, to));
  const momPrev = metrics(dateOnlyFilter(rows, prevMonthStart, iso(prevEquivalent)));

  const year = Number(to.slice(0,4));
  const ytdStart = `${year}-01-01`;
  const priorStart = `${year-1}-01-01`;
  const priorEnd = `${year-1}-${to.slice(5)}`;
  const ytdNow = metrics(dateOnlyFilter(rows, ytdStart, to));
  const ytdPrev = metrics(dateOnlyFilter(rows, priorStart, priorEnd));

  return {
    today:{current:today,previous:yesterday},
    wow:{current:wowNow,previous:wowPrev},
    mom:{current:momNow,previous:momPrev},
    ytd:{current:ytdNow,previous:ytdPrev}
  };
}
