import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';

/**
 * ESLint 9 wants a flat config and there was none, so `npm run lint` — and with
 * it `npm run check` — has been failing to start rather than failing to pass.
 * eslint-config-next 16 exports flat configs directly, so no compatibility
 * bridge is needed.
 *
 * The ignores are build output, the verification scripts (plain Node, not part
 * of the application) and `.claude`, which holds vendored design prototypes
 * rather than anything this project ships.
 */
const config = [
  { ignores: ['.next/**', 'node_modules/**', 'scripts/**', 'drizzle/**', '.claude/**'] },
  ...coreWebVitals,
  ...typescript,
];

export default config;
