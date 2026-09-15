import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "1,400 Structural Legal Context Answers | Britannic Atlas",
  description: "One hundred critical-thinking questions answered separately for all 14 British Overseas Territories, tracing territorial limits, recognition mechanisms and residual legal gaps.",
  alternates: { canonical: "/context" },
};

export default function ContextLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }
