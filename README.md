# Lillelam Sales Analytics — Supabase + Vercel

This is a separate Lillelam sales application. It is not MondayFox.

## What is included

- Daily Odoo Excel upload
- Persistent Supabase PostgreSQL database
- Vercel/Next.js frontend
- Fixed top KPIs for the selected date range
- Product/Color/Size filters that affect the analysis below
- Today vs yesterday
- WoW: last 7 days vs previous 7 days
- MoM: month-to-date vs equivalent part of previous month
- YTD vs same period last year
- Bestsellers
- Slow movers among products that sold at least 1 unit
- Color performance
- Size performance
- Product × color × size variants
- Discount amount, discount share, Odoo Antall bestilt and Antall
- Daily revenue/units/orders trends
- Product details XLSX export
- Duplicate Excel protection by SHA-256 file hash
- Delete/reimport an uploaded day
- Optional shared viewer password
- Separate admin upload password

## 1. Create Supabase project

1. Go to Supabase and create a new project.
2. Open **SQL Editor**.
3. Copy everything from `supabase/schema.sql`.
4. Run it.
5. Go to **Project Settings → API** and copy:
   - Project URL
   - `service_role` key

IMPORTANT: Never expose the service-role key in browser code. In this project it is used only in Next.js server routes.

## 2. Put the project on GitHub

Create a new repository, for example:

`lillelam-sales-analytics`

Upload the contents of this folder to the repository root.

## 3. Deploy on Vercel

1. New Project → import the GitHub repository.
2. Framework should be detected as **Next.js**.
3. Add these Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxxxx
ADMIN_UPLOAD_PASSWORD=choose-a-strong-password
SESSION_SECRET=choose-a-long-random-secret
DASHBOARD_PASSWORD=optional-viewer-password
```

If `DASHBOARD_PASSWORD` is left empty, anyone with the Vercel URL can view the dashboard.

4. Click **Deploy**.

## 4. Import the first Odoo report

Open the deployed app.

Click **Admin / Import**.

Choose:
- report date
- Odoo `.xlsx`
- your `ADMIN_UPLOAD_PASSWORD`

Click **Import report**.

Every following daily report is appended to Supabase, so analytics accumulate automatically.

## Odoo fields

The parser reads:
- `Total (eks. mva)`
- `Antall bestilt`
- `Antall`

Interpretation used:
- `Antall bestilt` = quantity/units
- `Antall` = number of Odoo report lines/count
- WooCommerce Shipping Product = order/shipping aggregate
- WooCommerce Discount Product = discount aggregate

The discount line is aggregated by Odoo and does not identify which physical product/color/size received the discount. Therefore this app does not falsely assign those discount units to individual products.

## Slow movers

With the current Odoo sales export we know only products that appear in sales. Therefore "Slow movers" means the bottom-selling products **among products that sold at least one unit in the selected period**.

To show true zero-sale products, connect a product catalog/stock export later.

## Local test

Install Node.js 20+ and run:

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

Create `.env.local` from `.env.example` first.
