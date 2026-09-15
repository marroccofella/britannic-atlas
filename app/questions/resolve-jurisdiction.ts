import { manxAgentContract } from "../manx/data";
import { jurisdictionProfiles } from "./answer-data";

export function resolveKnownJurisdiction(input?: string | null) {
  const requested = input?.trim().toLowerCase();
  if (!requested) return undefined;
  const profile = jurisdictionProfiles.find((item) => item.name.toLowerCase() === requested);
  if (profile) return profile;
  if (manxAgentContract.aliases.some((alias) => alias.toLowerCase() === requested)) {
    return jurisdictionProfiles.find((item) => item.name === manxAgentContract.canonicalJurisdiction);
  }
  return undefined;
}
