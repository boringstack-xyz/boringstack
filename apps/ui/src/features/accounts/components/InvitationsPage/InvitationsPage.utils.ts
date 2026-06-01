/**
 * Curried per-id handler factory. Lets call sites write
 * `onClick={handlerFor(id)}` so the JSX expression resolves to a
 * `CallExpression` (not the `ArrowFunctionExpression` that
 * `react-component-architecture/no-inline-jsx-functions` forbids).
 */
export function makeIdHandler(
  fn: (id: string) => void
): (id: string) => () => void {
  return (id: string) => () => {
    fn(id);
  };
}

export function formatExpiresAt(iso: string): string {
  return new Date(iso).toLocaleDateString();
}
