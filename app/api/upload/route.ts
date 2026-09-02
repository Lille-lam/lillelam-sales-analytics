import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { parseOdooWorkbook } from "@/lib/odoo-parser";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const reportDate = String(form.get("report_date") || "");
    const adminPassword = String(form.get("admin_password") || "");

    if (adminPassword !== (process.env.ADMIN_UPLOAD_PASSWORD || "")) {
      return NextResponse.json({error:"Wrong admin password."},{status:401});
    }
    if (!file || !reportDate) {
      return NextResponse.json({error:"File and report date are required."},{status:400});
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    const rows = parseOdooWorkbook(buffer);
    if (!rows.length) return NextResponse.json({error:"No rows detected in this Odoo report."},{status:400});

    const sb = supabaseAdmin();
    const { data:existing } = await sb.from("uploads").select("upload_id").eq("file_hash",hash).maybeSingle();
    if (existing) return NextResponse.json({error:"This exact file was already imported."},{status:409});

    const { data:upload, error:uerr } = await sb.from("uploads").insert({
      report_date:reportDate, source_file:file.name, file_hash:hash
    }).select("upload_id").single();
    if (uerr) throw uerr;

    const payload = rows.map(r => ({
      upload_id:upload.upload_id,
      report_date:reportDate,
      source_file:file.name,
      ...r
    }));

    for (let i=0;i<payload.length;i+=500) {
      const {error} = await sb.from("sales_rows").insert(payload.slice(i,i+500));
      if (error) {
        await sb.from("uploads").delete().eq("upload_id",upload.upload_id);
        throw error;
      }
    }

    return NextResponse.json({
      ok:true,
      upload_id:upload.upload_id,
      rows:payload.length,
      products:payload.filter(x=>x.row_type==="product").length
    });
  } catch (e:any) {
    return NextResponse.json({error:e.message||"Import failed"},{status:500});
  }
}
