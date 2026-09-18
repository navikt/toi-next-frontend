import assert from 'node:assert/strict';
import test from 'node:test';
import { startMswInstrumentering } from '../dist/next/index.js';

test('starter MSW-serveren bare én gang', async () => {
  let hentServerKall = 0;
  let listenKall = 0;
  const logger = [];

  const konfigurasjon = {
    hentServer: async () => {
      hentServerKall += 1;
      return {
        close: () => undefined,
        listen: () => {
          listenKall += 1;
        },
      };
    },
    logg: (melding) => logger.push(melding),
  };

  await startMswInstrumentering(konfigurasjon);
  await startMswInstrumentering(konfigurasjon);

  assert.equal(hentServerKall, 1);
  assert.equal(listenKall, 1);
  assert.deepEqual(logger, ['MSW node-server startet']);
});
