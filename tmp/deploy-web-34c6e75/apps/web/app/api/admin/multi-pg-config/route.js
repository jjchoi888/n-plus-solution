import { NextResponse } from "next/server";
import { getMultiPgStore } from "../_store/multiPgStore";

export async function GET() {
  const store = getMultiPgStore();
  return NextResponse.json({ success: true, config: store.config });
}

export async function POST(req) {
  try {
    const body = await req.json();
    const store = getMultiPgStore();
    store.config = {
      ...store.config,
      ...body
    };
    return NextResponse.json({ success: true, config: store.config });
  } catch (e) {
    return NextResponse.json({ success: false, message: "Invalid request body" }, { status: 400 });
  }
}

