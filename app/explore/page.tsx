import ExploreClient from "./explore-client";
import { places } from "./data";
import { serialiseStructuredData } from "../structured-data";

export default async function ExplorePage({ searchParams }: { searchParams?: Promise<{ place?: string | string[] }> }) {
  const requestedPlace = (await searchParams)?.place;
  const placeSlug = Array.isArray(requestedPlace) ? requestedPlace[0] : requestedPlace;
  const initialPlaceSlug = places.some((place) => place.slug === placeSlug) ? placeSlug : "england";
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Explore Britain and the British Territories",
    description: "An interactive visual encyclopedia with population, earnings, geography and constitutional facts.",
    dateModified: "2026-08-16",
    hasPart: places.map((place) => ({ "@type": "Place", name: place.name, description: place.introduction })),
  };

  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialiseStructuredData(schema) }} /><ExploreClient initialPlaceSlug={initialPlaceSlug} /></>;
}
