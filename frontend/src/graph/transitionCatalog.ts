export type TransitionOption = {
  name: string;
  occurrenceCount: number;
};

export function buildTransitionCatalogue(
  transitions: readonly (string | null | undefined)[],
): TransitionOption[] {
  const counts = new Map<string, number>();

  transitions.forEach((transition) => {
    const name = transition?.trim();
    if (!name) return;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  });

  return [...counts.entries()]
    .map(([name, occurrenceCount]) => ({ name, occurrenceCount }))
    .sort(
      (left, right) =>
        right.occurrenceCount - left.occurrenceCount ||
        left.name.localeCompare(right.name),
    );
}

export function filterTransitionOptions(
  options: readonly TransitionOption[],
  query: string,
  limit = 50,
): TransitionOption[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = normalizedQuery
    ? options.filter((option) =>
        option.name.toLocaleLowerCase().includes(normalizedQuery),
      )
    : [...options];

  return filtered
    .sort((left, right) => {
      const leftExact = left.name.toLocaleLowerCase() === normalizedQuery;
      const rightExact = right.name.toLocaleLowerCase() === normalizedQuery;
      if (leftExact !== rightExact) return leftExact ? -1 : 1;
      return (
        right.occurrenceCount - left.occurrenceCount ||
        left.name.localeCompare(right.name)
      );
    })
    .slice(0, Math.max(0, limit));
}
