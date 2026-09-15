import catalogue from "../../../public/discovery/catalog.json";

type CatalogueNode = (typeof catalogue.nodes)[number];

const byId = new Map<string, CatalogueNode>(catalogue.nodes.map((node) => [node.id, node]));
const root = byId.get(catalogue.root);

if (!root) throw new Error("The discovery catalogue root is missing.");

type Coverage = { topicCount: number; sourceLinkedCount: number; outlineCount: number; groupCount: number };

function countNode(node: CatalogueNode, coverage: Coverage) {
  coverage.topicCount += 1;
  if (node.evidence === "sourced") coverage.sourceLinkedCount += 1;
  else if (node.evidence === "outline") coverage.outlineCount += 1;
  else if (node.evidence === "group") coverage.groupCount += 1;
  else throw new Error(`Unknown evidence category for ${node.id}: ${node.evidence}`);
}

function tally(node: CatalogueNode, coverage: Coverage) {
  for (const childId of node.children) {
    const child = byId.get(childId);
    if (!child) throw new Error(`The discovery catalogue references a missing topic: ${childId}`);
    countNode(child, coverage);
    tally(child, coverage);
  }
  return coverage;
}

function coverageOf(node: CatalogueNode, includeSelf = false) {
  const coverage = { topicCount: 0, sourceLinkedCount: 0, outlineCount: 0, groupCount: 0 };
  if (includeSelf) countNode(node, coverage);
  return tally(node, coverage);
}

const total = coverageOf(root);

export type DiscoveryAreaCoverage = Coverage & { id: string; label: string };

export const discoveryAreas: readonly DiscoveryAreaCoverage[] = root.children.map((id) => {
  const area = byId.get(id);
  if (!area) throw new Error(`The discovery catalogue references a missing area: ${id}`);
  // Include the area under its actual evidence category, just like descendants.
  return { id: area.id, label: area.label, ...coverageOf(area, true) };
});

export const discoveryStats = {
  topicCount: total.topicCount,
  areaCount: root.children.length,
  sourceLinkedCount: total.sourceLinkedCount,
  outlineCount: total.outlineCount,
  groupCount: total.groupCount,
  reviewedAt: catalogue.reviewedAt,
} as const;

const number = (value: number) => value.toLocaleString("en-GB");

/** One sentence that must accompany any headline topic count. */
export const discoveryCoverageSentence = `${number(discoveryStats.sourceLinkedCount)} topics are source-linked, ${number(discoveryStats.outlineCount)} are research outlines still to investigate, and ${number(discoveryStats.groupCount)} are grouping nodes.`;

/** Source-linked means a citation is attached. It does not establish that the citation supports the claim. */
export const sourceLinkedCaveat = "Source-linked means a citation is attached to the description; it does not establish that the citation supports the claim.";
