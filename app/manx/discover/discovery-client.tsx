"use client";

import { createElement, useEffect, useState } from "react";

export default function DiscoveryClient() {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const script = document.createElement("script");
    script.type = "module";
    script.src = "/discovery/explorer.mjs";
    script.onerror = () => setFailed(true);
    document.head.append(script);
    return () => { script.onerror = null; script.remove(); };
  }, []);
  return <>
    {failed ? <p role="alert">The explorer could not be opened. Refresh the page to try again.</p> : createElement("manx-discovery", { "data-context": "hosted" })}
  </>;
}
