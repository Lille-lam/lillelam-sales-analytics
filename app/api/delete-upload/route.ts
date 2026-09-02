import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: Request) {
  try {
    const { upload_id, admin_password } = await req.json();
    if (admin_password !== (process.env.ADMIN_UPLOAD_PASSWORD || "")) {
      return NextResponse.json({error:"Wrong admin password."},{status:401});
    }
    const sb = supabaseAdmin();
    const {error} = await sb.from("uploads").delete().eq("upload_id",upload_id);
    if (error) throw error;
    return NextResponse.json({ok:true});
  } catch(e:any) {
    return NextResponse.json({error:e.message||"Delete failed"},{status:500});
  }
}
