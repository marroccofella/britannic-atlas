import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MANX — Isle of Man focused intelligence | Britannic Atlas",
  description: "A source-led Isle of Man intelligence layer connecting constitutional, legal, tax, regulatory, mobility, registry and cultural context.",
  keywords: ["MANX", "Isle of Man", "Ellan Vannin", "Crown Dependency", "Tynwald", "Manx law", "Isle of Man research"],
  alternates: { canonical: "/manx", types: { "application/json": "/api/manx" } },
  openGraph: { type: "website", title: "MANX — Isle of Man focused intelligence", description: "Ten connected intelligence modules for precise Isle of Man research." },
};

export default function ManxLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
