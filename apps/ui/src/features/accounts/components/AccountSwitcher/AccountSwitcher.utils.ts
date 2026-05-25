/**
 * Returns a stable per-account-id click handler. Call sites use
 * `onSelect={makeOnSelectHandler(onSelect)(accountId)}` — the factory
 * closes over the parent's `onSelect` so the JSX expression resolves to
 * a `CallExpression`, not the `ArrowFunctionExpression` that
 * `react-component-architecture/no-inline-jsx-functions` forbids.
 */
export function makeOnSelectHandler(
  onSelect: (accountId: string) => void
): (accountId: string) => () => void {
  return (accountId: string) => () => {
    onSelect(accountId);
  };
}
