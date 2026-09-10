/** Deliberate edits to the trusted reference only; candidates need not share its source shape. */
export function withoutRecordAccountPredicate(
  source: string,
  index: 0 | 1
): string {
  const matches = [
    ...source.matchAll(
      /and\(\s*eq\(projects.accountId, accountId\),\s*eq\(projects.id, id\),?\s*\)/g
    ),
  ];

  if (matches.length !== 2) {
    throw new Error("Expected get and rename scope predicates");
  }

  const match = matches[index];

  if (match === undefined) {
    throw new Error("Requested predicate is absent");
  }

  return (
    source.slice(0, match.index) +
    "eq(projects.id, id)" +
    source.slice(match.index + match[0].length)
  );
}
