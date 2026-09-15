import { places } from "../explore/data";
import { territoryDossiers } from "../territories/data";
import { jurisdictionProfiles } from "../questions/answer-data";
import { manxAgentContract } from "../manx/data";
import type { NetworkPlace } from "./routing";

const aliases: Record<string,string> = {
  "south-georgia-south-sandwich-islands": "South Georgia and the South Sandwich Islands",
  "akrotiri-dhekelia": "Sovereign Base Areas of Akrotiri and Dhekelia",
  "isle-of-man": "Isle of Man",
};

export const networkPlaces: NetworkPlace[] = [
  { slug: "united-kingdom", name: "United Kingdom", status: "UK-wide answer library", answers: "United Kingdom" },
  ...places.map(place => ({
    slug: place.slug, name: place.name.split(" · ")[0], status: place.status, visual: true,
    territory: territoryDossiers.find(t => t.slug === place.slug)?.slug,
    aliases: place.slug === "isle-of-man" ? manxAgentContract.aliases : undefined,
    answers: jurisdictionProfiles.find(p => p.name === (aliases[place.slug] ?? place.name.split(" · ")[0]))?.name,
  })),
  ...territoryDossiers.filter(t => !places.some(p => p.slug === t.slug)).map(t => ({
    slug: t.slug, name: t.name, status: "Overseas Territory", territory: t.slug,
    answers: jurisdictionProfiles.find(p => p.name === (aliases[t.slug] ?? t.name))?.name,
  })),
  { slug: "guernsey", name: "Guernsey", status: "Crown Dependency", answers: "Guernsey" },
];

export const sharedPractice = [
  { title: "Start with the place", detail: "Keep the jurisdiction visible. A relationship with Britain does not make another jurisdiction’s rules apply locally." },
  { title: "Follow the source", detail: "Use the original dossier or source record. Preserve its review date, scope and qualifications when referring to it." },
  { title: "Keep the uncertainty", detail: "A research outline is a question to investigate. Linking it elsewhere does not turn it into a verified answer." },
  { title: "Choose the next step", detail: "Move from place to explanation, specialist research or conversation. Opening another app does not submit a question or copy a private conversation." },
];
