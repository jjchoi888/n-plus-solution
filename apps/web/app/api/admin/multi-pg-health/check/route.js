import { NextResponse } from "next/server";
import { getMultiPgStore } from "../../_store/multiPgStore";

function randomLatency() {
  return Math.floor(80 + Math.random() * 220);
}

export async function POST() {
  const store = getMultiPgStore();
  const providers = (store.config?.providers || []).filter((p) => p.enabled);
  const now = new Date().toISOString();

  const rows = providers.map((p) => {
    const latency = randomLatency();
    const isUp = latency < (store.config?.timeoutMs || 8000);
    return {
      provider: p.key,
      status: isUp ? "UP" : "DOWN",
      latency_ms: latency,
      checked_at: now,
      message: isUp ? "Healthy" : "Timeout or unstable response"
    };
  });

  store.healthRows = rows;
  return NextResponse.json({ success: true, rows });
}

