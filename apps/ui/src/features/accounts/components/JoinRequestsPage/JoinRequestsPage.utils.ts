/**
 * Curried handler factory — `makeIdHandler(onApprove)(row.id)` returns
 * a stable `() => onApprove(row.id)` closure that the row Button can
 * reference without rebuilding an inline arrow inside the JSX.
 */
export function makeIdHandler(
  fn: (id: string) => void
): (id: string) => () => void {
  return (id: string) => (): void => {
    fn(id);
  };
}

export function formatRequestedAt(iso: string): string {
  try {
    const date = new Date(iso);

    /*
     * Locale-aware short date — the underlying ISO is the source of
     * truth, this is purely a display aid. `toLocaleDateString` with
     * no locale arg honours the browser's preference.
     */
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  } catch {
    return iso;
  }
}
