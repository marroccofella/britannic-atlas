"use client";

import { useEffect, useState } from "react";

type Freshness = { checkedAt: string; healthy: number; total: number };

export default function FreshnessPanel() {
  const [freshness, setFreshness] = useState<Freshness | null>(null);
  useEffect(() => {
    fetch("/api/freshness").then((response) => response.ok ? response.json() : null).then(setFreshness).catch(() => setFreshness(null));
  }, []);

  return <section className="freshness-panel" aria-live="polite">
    <div><i /><span>OFFICIAL-SOURCE MONITOR</span></div>
    <p>{freshness ? `${freshness.healthy} of ${freshness.total} primary sources reachable` : "Checking primary sources…"}</p>
    <span>{freshness ? `Last automatic check ${new Date(freshness.checkedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}` : "The monitor retries automatically"}</span>
  </section>;
}
