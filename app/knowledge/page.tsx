import type { Metadata } from "next";
import Link from "next/link";
import FreshnessPanel from "../freshness-panel";
import { serialiseStructuredData } from "../structured-data";
import { articles, siteUpdatedAt } from "./content";

export const metadata: Metadata = {
  title: "Knowledge base | Britannic Atlas",
  description: "Citable, date-stamped explainers about the United Kingdom, Crown Dependencies, Overseas Territories, Commonwealth and imperial afterlives.",
  alternates: { canonical: "/knowledge" },
};

export default function KnowledgeIndex() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Britannic Atlas knowledge base",
    dateModified: siteUpdatedAt,
    hasPart: articles.map((article) => ({ "@type": "Article", headline: article.title, url: `/knowledge/${article.slug}` })),
  };

  return (
    <main className="kb-shell">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialiseStructuredData(schema) }} />
      <header className="kb-header">
        <Link className="brand" href="/"><span className="brand-mark">BA</span><span><b>BRITANNIC ATLAS</b><small>THE BRITISH WORLD, PROPERLY MAPPED</small></span></Link>
        <div className="kb-header-links"><Link className="kb-back" href="/manx">MANX intelligence</Link><Link className="kb-back" href="/context">Structural context</Link><Link className="kb-back" href="/doctoral">Doctoral law</Link><Link className="kb-back" href="/explore">Visual explore</Link><Link className="kb-back" href="/bankruptcy">1,400 insolvency answers</Link><Link className="kb-back" href="/questions">18,000 templated baselines</Link><Link className="kb-back" href="/">← Interactive atlas</Link></div>
      </header>
      <section className="kb-hero">
        <div><p className="kb-eyebrow">LIVING REFERENCE · REVIEWED {siteUpdatedAt}</p><h1>Knowledge,<br /><em>with provenance.</em></h1></div>
        <div className="kb-intro"><p>Short, citable explainers built for people, search engines and AI systems. Every page carries a summary, review date, topic vocabulary and direct official sources.</p><a href="#articles">Browse the reference →</a></div>
      </section>
      <FreshnessPanel />
      <section className="kb-index" id="articles">
        <div className="kb-section-head"><span>01 / EXPLAINERS</span><h2>Begin with the relationship.</h2><p>{articles.length} foundational entries make the atlas readable before the deeper comparison work begins.</p></div>
        <div className="kb-card-grid">
          {articles.map((article, index) => <Link className="kb-card" href={`/knowledge/${article.slug}`} key={article.slug}>
            <span>{(index + 1).toString().padStart(2, "0")} · {article.eyebrow}</span>
            <h3>{article.title}</h3><p>{article.description}</p><b>READ DOSSIER ↗</b>
          </Link>)}
        </div>
      </section>
      <section className="machine-strip"><div><span>02 / MACHINE ACCESS</span><h2>Open by design.</h2></div><p>Canonical pages, JSON-LD, XML sitemap, Atom feed, JSON APIs and <code>llms.txt</code> make the editorial structure and answer banks available to crawlers and knowledge engines.</p><div className="machine-links"><a href="/llms.txt">LLMS.TXT</a><a href="/api/manx">MANX API</a><a href="/api/knowledge">KNOWLEDGE API</a><a href="/api/doctoral">DOCTORAL API</a><a href="/api/context">CONTEXT API</a><a href="/api/questions">QUESTIONS API</a><a href="/api/answers">ANSWERS API</a><a href="/api/bankruptcy">BANKRUPTCY API</a><a href="/sitemap.xml">SITEMAP</a></div></section>
    </main>
  );
}
