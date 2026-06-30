import { NextResponse } from "next/server";
import { getMultiPgStore } from "../_store/multiPgStore";

export async function GET() {
  const store = getMultiPgStore();
  return NextResponse.json({ success: true, rows: store.healthRows || [] });
}

