import assert from 'node:assert/strict';
import test from 'node:test';
import { lagSWRKonfigurasjon } from '../dist/swr/index.js';

test('bruker immutable SWR-konfigurasjon som standard', () => {
  assert.deepEqual(lagSWRKonfigurasjon(), {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });
});

test('beholder eksplisitt SWR-konfigurasjon og aktiverer revalidering ved nonImmutable', () => {
  assert.deepEqual(
    lagSWRKonfigurasjon({ nonImmutable: true, refreshInterval: 1000 }),
    { refreshInterval: 1000 },
  );
});
