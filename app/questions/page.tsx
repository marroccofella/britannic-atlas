import QuestionsClient from "./questions-client";
import { resolveKnownJurisdiction } from "./resolve-jurisdiction";

export default async function QuestionsPage({ searchParams }: { searchParams?: Promise<{ jurisdiction?: string | string[] }> }) {
  const requestedJurisdiction = (await searchParams)?.jurisdiction;
  const requested = Array.isArray(requestedJurisdiction) ? requestedJurisdiction[0] : requestedJurisdiction;
  const initialJurisdiction = resolveKnownJurisdiction(requested)?.name ?? "United Kingdom";
  return <QuestionsClient initialJurisdiction={initialJurisdiction} />;
}
