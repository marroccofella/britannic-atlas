import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "18,000 templated research baselines | Britannic Atlas",
  description: "1,000 templated research baselines for each of the UK, the Crown Dependencies and every British Overseas Territory, composed from jurisdiction, domain and lens templates with evidence requirements and official source routes.",
  alternates: { canonical: "/questions" },
  openGraph: { type: "website", title: "18,000 templated research baselines | Britannic Atlas", description: "18 jurisdictions · 1,000 templated research baselines each · official source routes", images: [{ url: "/og-questions.png", width: 1200, height: 630, alt: "Britannic Atlas territory answer library" }] },
  twitter: { card: "summary_large_image", title: "18,000 templated research baselines | Britannic Atlas", description: "18 jurisdictions · 1,000 templated research baselines each · official source routes", images: ["/og-questions.png"] },
};

export default function QuestionsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
