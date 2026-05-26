const g = globalThis;

if (!g.__MULTI_PG_STORE__) {
  g.__MULTI_PG_STORE__ = {
    config: {
      providers: [
        { key: "stripe", label: "Stripe", enabled: true, priority: 1 },
        { key: "paypal", label: "PayPal", enabled: true, priority: 2 },
        { key: "xendit", label: "Xendit", enabled: false, priority: 3 }
      ],
      routing: {
        card: "stripe",
        wallet: "paypal",
        international: "stripe"
      },
      fallbackEnabled: true,
      fallbackChain: "stripe>paypal>xendit",
      timeoutMs: 8000
    },
    healthRows: [
      {
        provider: "stripe",
        status: "UP",
        latency_ms: 120,
        checked_at: new Date().toISOString(),
        message: "Default seed status"
      },
      {
        provider: "paypal",
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

