/** Keep existing ids in place; append newly seen ids; drop missing ones. */
export function mergeStableIds(previous: string[], nextIds: string[]): string[] {
  const next = new Set(nextIds);
  const kept = previous.filter((id) => next.has(id));
  const keptSet = new Set(kept);
  return [...kept, ...nextIds.filter((id) => !keptSet.has(id))];
}
