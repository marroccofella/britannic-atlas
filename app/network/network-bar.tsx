"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { appDestination, currentApp, destinationScope, networkApps, routePlace, type NetworkPlace } from "./routing";

export default function NetworkBar({ places }: { places: NetworkPlace[] }) {
  const path = usePathname();
  const query = useSearchParams();
  const place = routePlace(path, new URLSearchParams(query.toString()), places);
  const active = currentApp(path);
  const directory = place ? `/network?place=${encodeURIComponent(place.slug)}` : "/network";
  return <nav className="family-bar" aria-label="British world app family">
    <Link className="family-home" href={directory}>THE BRITISH WORLD <span>Apps &amp; knowledge</span></Link>
    <span className="family-current">{path === "/network" ? "App directory" : active.name}{place && <> · {place.name}</>}</span>
    <details className="family-switch" key={`${path}?${query.toString()}`}>
      <summary>Switch app <span aria-hidden="true">＋</span></summary>
      <div className="family-menu">
        <p>{place ? `Continue from ${place.name}` : "Choose a way to explore"}</p>
        {networkApps.map(app => {
          const href = appDestination(app, place), local = app.id === "mannin";
          const Destination = local ? "a" : Link;
          return <Destination key={app.id} href={href} aria-current={path !== "/network" && active.id === app.id ? "page" : undefined} target={local ? "_blank" : undefined} rel={local ? "noopener noreferrer" : undefined}>
            <b>{app.name}</b><span>{local ? "Local app · requires Mannin running" : destinationScope(app, place)}</span>
          </Destination>;
        })}
        <Link className="family-all" href={directory}>Compare all apps and their focus →</Link>
      </div>
    </details>
  </nav>;
}
