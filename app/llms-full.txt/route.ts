import { articles, getSources, siteUpdatedAt } from "../knowledge/content";
import { getManxSources, manxAgentContract, manxModules, manxReviewedAt } from "../manx/data";

export function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const corpus = articles.map((article) => {
    const sections = article.sections.map((section) => `## ${section.heading}\n\n${section.body}`).join("\n\n");
    const citations = getSources(article.sourceIds).map((source) => `- ${source.publisher}: ${source.title} — ${source.url}`).join("\n");
    return `# ${article.title}\n\nCanonical URL: ${origin}/knowledge/${article.slug}\nLast reviewed: ${siteUpdatedAt}\nKeywords: ${article.keywords.join(", ")}\n\n## Answer in brief\n\n${article.summary}\n\n${sections}\n\n## Primary sources\n\n${citations}`;
  }).join("\n\n---\n\n");
  const manxCorpus = manxModules.map((module) => {
    const capabilities = module.capabilities.map((capability) => `- ${capability}`).join("\n");
    const signals = module.signals.map((signal) => `- [${signal.volatility}] ${signal.statement} Implication: ${signal.implication}`).join("\n");
    const guardrails = module.guardrails.map((guardrail) => `- ${guardrail}`).join("\n");
    const sources = getManxSources(module.sourceIds).map((source) => `- ${source.publisher}: ${source.title} — ${source.url}`).join("\n");
    return `## MANX ${module.number}: ${module.title}\n\n${module.strapline}\n\nPurpose: ${module.purpose}\n\n### Agentic capabilities\n\n${capabilities}\n\n### Decision signals\n\n${signals}\n\n### Guardrails\n\n${guardrails}\n\n### Primary routes\n\n${sources}`;
  }).join("\n\n");
  const contract = manxAgentContract.answerSequence.map((step, index) => `${index + 1}. ${step}`).join("\n");
  const hardStops = manxAgentContract.hardStops.map((item) => `- ${item}`).join("\n");
  const manx = `# MANX: Isle of Man focused intelligence\n\nCanonical page: ${origin}/manx\nSpatial view: ${origin}/manx/earth\nMachine API: ${origin}/api/manx\nLast reviewed: ${manxReviewedAt}\nCanonical jurisdiction: ${manxAgentContract.canonicalJurisdiction}\nAliases: ${manxAgentContract.aliases.join(", ")}\n\n${manxAgentContract.classification}\n\n## Agent sequence\n\n${contract}\n\n## Hard stops\n\n${hardStops}\n\n${manxCorpus}`;
  return new Response(`# Britannic Atlas: full knowledge corpus\n\n${corpus}\n\n---\n\n${manx}\n`, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*" } });
}
