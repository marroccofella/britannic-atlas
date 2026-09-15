import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { serialiseStructuredData } from "../../structured-data";
import { articles, getArticle, getSources, siteUpdatedAt } from "../content";

export function generateStaticParams() {
  return articles.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return { title: "Entry not found" };
  return {
    title: `${article.title} | Britannic Atlas`,
    description: article.description,
    keywords: article.keywords,
    alternates: { canonical: `/knowledge/${article.slug}` },
    openGraph: { type: "article", title: article.title, description: article.description, modifiedTime: `${siteUpdatedAt}T00:00:00Z` },
  };
}

export default async function KnowledgeEntry({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();
  const citations = getSources(article.sourceIds);
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    datePublished: "2026-08-15",
    dateModified: siteUpdatedAt,
    isAccessibleForFree: true,
    about: article.keywords.map((name) => ({ "@type": "Thing", name })),
    citation: citations.map((source) => source.url),
    author: { "@type": "Organization", name: "Britannic Atlas editorial project" },
  };
  const currentIndex = articles.findIndex((item) => item.slug === article.slug);
  const next = articles[(currentIndex + 1) % articles.length];

  return <main className="entry-shell">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialiseStructuredData(schema) }} />
    <header className="kb-header"><Link className="brand" href="/"><span className="brand-mark">BA</span><span><b>BRITANNIC ATLAS</b><small>THE BRITISH WORLD, PROPERLY MAPPED</small></span></Link><Link className="kb-back" href="/knowledge">← Knowledge base</Link></header>
    <article className="entry-article">
      <header className="entry-title"><div><span>{article.eyebrow}</span><span>REVIEWED {siteUpdatedAt}</span></div><h1>{article.title}</h1><p>{article.description}</p></header>
      <aside className="entry-summary"><span>ANSWER IN BRIEF</span><p>{article.summary}</p><div>{article.keywords.map((keyword) => <b key={keyword}>{keyword}</b>)}</div></aside>
      <div className="entry-body">{article.sections.map((section, index) => <section key={section.heading}><span>{(index + 1).toString().padStart(2, "0")}</span><div><h2>{section.heading}</h2><p>{section.body}</p></div></section>)}</div>
      {article.relatedLinks && <section className="entry-related"><span>CONNECTED INTELLIGENCE</span><h2>Continue in context</h2><div>{article.relatedLinks.map((link) => link.href.startsWith("/api/") ? <a href={link.href} key={link.href}><strong>{link.label}</strong><p>{link.description}</p><b>→</b></a> : <Link href={link.href} key={link.href}><strong>{link.label}</strong><p>{link.description}</p><b>→</b></Link>)}</div></section>}
      <section className="entry-sources"><span>SOURCES &amp; PROVENANCE</span><h2>Primary references</h2><p>These official sources establish the current summary. The review date records when this page was checked; it is not the publication date of each source.</p><ol>{citations.map((source) => <li key={source.id}><a href={source.url} rel="external">{source.title}</a><span>{source.publisher} · reviewed {source.lastReviewed}</span></li>)}</ol></section>
      <Link className="entry-next" href={`/knowledge/${next.slug}`}><span>NEXT DOSSIER</span><strong>{next.title}</strong><b>→</b></Link>
    </article>
  </main>;
}
