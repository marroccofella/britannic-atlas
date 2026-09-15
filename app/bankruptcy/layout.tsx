import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "1,400 Territory Insolvency Answers | Britannic Atlas",
  description: "One hundred source-linked insolvency and bankruptcy answers for each of the 14 British Overseas Territories.",
  alternates: { canonical: "/bankruptcy" },
  openGraph: { type: "website", title: "Insolvency, territory by territory", description: "Fourteen permanent territory libraries with 100 locally researched answers each." },
};

export default function BankruptcyLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
