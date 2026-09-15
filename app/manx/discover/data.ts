export const discoveryTopicIds = {
  geographyPlaces: "isle-of-man/geography-places",
  lawJustice: "isle-of-man/government/law-justice",
} as const;

export function discoverHref(topicId?: string) {
  return topicId ? `/manx/discover#explore=${encodeURIComponent(topicId)}` : "/manx/discover";
}

export const discoveryLinks = {
  index: discoverHref(),
  geographyPlaces: discoverHref(discoveryTopicIds.geographyPlaces),
  lawJustice: discoverHref(discoveryTopicIds.lawJustice),
} as const;
