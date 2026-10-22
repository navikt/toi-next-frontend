import type { ESLint, Linter } from 'eslint';
import { ingenHandlingVedPekerned } from './pekeravbrytelse.js';

export { ingenHandlingVedPekerned, NED_HENDELSER } from './pekeravbrytelse.js';

/** Navnet pluginen registreres under i `anbefalt`. */
export const PLUGINNAVN = 'toi-a11y';

const plugin = {
  meta: { name: '@navikt/toi-next-frontend/eslint' },
  rules: {
    'ingen-handling-ved-pekerned': ingenHandlingVedPekerned,
  },
} satisfies ESLint.Plugin;

/**
 * Flat config med reglene som varsler (`warn`). De gir pekepinner og stopper ikke bygget.
 *
 * ```js
 * import { anbefalt } from '@navikt/toi-next-frontend/eslint';
 * export default defineConfig([...nextConfig, anbefalt]);
 * ```
 */
export const anbefalt: Linter.Config = {
  name: 'toi-a11y/anbefalt',
  plugins: { [PLUGINNAVN]: plugin },
  rules: {
    [`${PLUGINNAVN}/ingen-handling-ved-pekerned`]: 'warn',
  },
};

export default plugin;
