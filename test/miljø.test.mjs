import assert from 'node:assert/strict';
import test from 'node:test';
import { erLokalt, erTestmodus, skalMocke } from '../dist/miljø/index.js';

const nullstill = () => {
  delete process.env.NEXT_PUBLIC_DEVELOPER;
  delete process.env.NEXT_PUBLIC_PLAYWRIGHT_TEST_MODE;
};

test('erLokalt og erTestmodus leser miljøvariabler', () => {
  nullstill();
  assert.equal(erLokalt(), false);
  assert.equal(erTestmodus(), false);
  assert.equal(skalMocke(), false);

  process.env.NEXT_PUBLIC_DEVELOPER = 'local';
  assert.equal(erLokalt(), true);
  assert.equal(skalMocke(), true);

  nullstill();
  process.env.NEXT_PUBLIC_PLAYWRIGHT_TEST_MODE = 'true';
  assert.equal(erTestmodus(), true);
  assert.equal(skalMocke(), true);

  nullstill();
});
