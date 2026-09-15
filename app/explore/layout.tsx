import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explore Britain & the Territories | Britannic Atlas",
  description: "A visual, interactive atlas of the United Kingdom, Crown Dependencies and British Overseas Territories, with official population and earnings context.",
  alternates: { canonical: "/explore" },
};

export default function ExploreLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
