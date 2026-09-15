import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Doctoral Comparative Law Knowledge Base | Britannic Atlas",
  description: "A primary-source-led doctoral module on formal validity, service, company identity, vehicle registration and cross-border recognition across Britain, Ireland and the Crown Dependencies.",
  alternates: { canonical: "/doctoral" },
  openGraph: { type: "website", title: "Formal validity has borders", description: "Five completed comparative private-law dossiers with rules, authority matrices and recognition chains." },
};

export default function DoctoralLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
