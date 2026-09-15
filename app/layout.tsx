import type { Metadata } from "next";
import { headers } from "next/headers";
import { Cormorant_Garamond, DM_Mono, Inter } from "next/font/google";
import "./globals.css";
import ThemeToggle from "./theme-toggle";
import { Suspense } from "react";
import NetworkBar from "./network/network-bar";
import { networkPlaces } from "./network/data";
import "./network/network.css";

const display = Cormorant_Garamond({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600"], style: ["normal", "italic"] });
const sans = Inter({ variable: "--font-sans", subsets: ["latin"] });
const mono = DM_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["300", "400", "500"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const image = `${origin}/og-knowledge.png`;
  const title = "Britannica Atlas — British World Knowledge Base";
  const description = "A living, citable knowledge base for the United Kingdom, Crown Dependencies, Overseas Territories, Commonwealth and their connected histories.";
  return {
    metadataBase: new URL(origin), title, description,
    applicationName: "Britannica Atlas",
    authors: [{ name: "Britannica Atlas editorial project" }], creator: "Britannica Atlas editorial project", publisher: "Britannica Atlas editorial project", category: "reference",
    keywords: ["British history", "United Kingdom", "Crown Dependencies", "British Overseas Territories", "Commonwealth", "knowledge base"],
    alternates: { canonical: "/", types: { "application/atom+xml": "/feed.xml", "text/plain": "/llms.txt", "application/json": "/api/knowledge" } },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: { title, description, type: "website", siteName: "Britannica Atlas", url: origin, images: [{ url: image, width: 1200, height: 630, alt: "Britannica Atlas — a living knowledge base of the British world" }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
    other: { "content-language": "en-GB", llms: "/llms.txt" },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const themeScript = `(function(){try{var t=localStorage.getItem('britannic-theme');if(!t)t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='light'}})()`;
  return <html lang="en-GB" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head><body className={`${display.variable} ${sans.variable} ${mono.variable}`}><Suspense fallback={<nav className="family-bar" aria-label="British world app family"><a className="family-home" href="/network">THE BRITISH WORLD · Apps &amp; knowledge</a></nav>}><NetworkBar places={networkPlaces} /></Suspense>{children}<ThemeToggle /></body></html>;
}
