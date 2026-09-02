import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sb = supabaseAdmin();
    let all:any[] = [];
    let from = 0;
    const step = 1000;
    while (true) {
      const { data, error } = await sb
        .from("sales_rows")
        .select("id,report_date,sku,product,size,color,qty,line_count,revenue,row_type")
        .order("report_date", {ascending:true})
        .range(from, from+step-1);
      if (error) throw error;
      all.push(...(data||[]));
      if (!data || data.length < step) break;
      from += step;
    }
    const { data:uploads, error:uerr } = await sb.from("uploads").select("*").order("report_date",{ascending:false});
    if (uerr) throw uerr;
    return NextResponse.json({rows:all, uploads:uploads||[]}, {headers:{"Cache-Control":"no-store"}});
  } catch (e:any) {
    return NextResponse.json({error:e.message||"Failed to load data"}, {status:500});
  }
}
