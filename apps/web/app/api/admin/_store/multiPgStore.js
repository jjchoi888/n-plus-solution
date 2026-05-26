const g = globalThis;

if (!g.__MULTI_PG_STORE__) {
  g.__MULTI_PG_STORE__ = {
    config: {
      providers: [
        { key: "paynplus", label: "Paynplus", enabled: true, priority: 1 },
        { key: "aqwire", label: "Aqwire", enabled: true, priority: 2 },
        { key: "hitpay", label: "HitPay", enabled: true, priority: 3 }
      ],
      routing: {
        card: "paynplus",
        wallet: "aqwire",
        international: "hitpay"
      },
      fallbackEnabled: true,
      fallbackChain: "paynplus>aqwire>hitpay",
      timeoutMs: 8000
    },
    healthRows: [
      {
        provider: "paynplus",
        status: "UP",
        latency_ms: 120,
        checked_at: new Date().toISOString(),
        message: "Default seed status"
      },
      {
        provider: "aqwire",
        status: "UP",
        latency_ms: 180,
        checked_at: new Date().toISOString(),
        message: "Default seed status"
      }
    ]
  };
}

export function getMultiPgStore() {
  return g.__MULTI_PG_STORE__;
}
