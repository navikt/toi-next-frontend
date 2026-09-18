import assert from 'node:assert/strict';
import test from 'node:test';
import { byggSporingsdata } from '../dist/analyse/index.js';

test('byggSporingsdata legger til domene og beholder eventData på server', () => {
  const data = byggSporingsdata(
    { navn: 'klikk', domene: 'Forside' },
    { knapp: 'lagre' },
  );

  assert.equal(data.domene, 'Forside');
  assert.equal(data.knapp, 'lagre');
  assert.equal(data.path, undefined);
});
