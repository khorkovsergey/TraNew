import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';

/**
 * ESLint 9 wants a flat config and there was none, so `npm run lint` — and with
 * it `npm run check` — has been failing to start rather than failing to pass.
 * eslint-config-next 16 exports flat configs directly, so no compatibility
 * bridge is needed.
 *
 * The ignores are build output, the verification scripts (plain Node, not part
 * of the application), `.claude`, and the design handoffs under `docs/design`.
 * Those last two hold vendored prototypes — the Voyager handoff ships a runtime
 * it explicitly tells us not to port — so linting them reports on code nobody
 * here will ever edit.
 */
const config = [
  { ignores: ['.next/**', 'node_modules/**', 'scripts/**', 'drizzle/**', '.claude/**', 'docs/**'] },
  ...coreWebVitals,
  ...typescript,
];

export default config;
