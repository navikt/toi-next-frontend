import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import { ApiError, createFetcher } from '../dist/api/index.js';

test('legger til base-URL, standardvalg og JSON-body', async () => {
  let request;
  const fetcher = createFetcher({
    baseUrl: 'https://eksempel.nav.no/api/',
    standardvalg: { credentials: 'include' },
    fetch: async (url, init) => {
      request = { url, init };
      return new Response(JSON.stringify({ id: '1' }), {
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  const resultat = await fetcher.post('stillinger', {
    etiketter: new Set(['ny']),
  });

  assert.deepEqual(resultat, { id: '1' });
  assert.equal(request.url, 'https://eksempel.nav.no/api/stillinger');
  assert.equal(request.init.credentials, 'include');
  assert.equal(request.init.body, '{"etiketter":["ny"]}');
});

test('legger queryParams til URL uten å sende dem til fetch', async () => {
  let request;
  const fetcher = createFetcher({
    fetch: async (url, init) => {
      request = { url, init };
      return new Response('{}', {
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  await fetcher.get('/ressurs?aktiv=true', {
    queryParams: new URLSearchParams({ side: '2' }),
  });

  assert.equal(request.url, '/ressurs?aktiv=true&side=2');
  assert.equal(request.init.queryParams, undefined);
});

test('gir ApiError med detaljene fra en feilrespons', async () => {
  const fetcher = createFetcher({
    fetch: async () =>
      new Response(JSON.stringify({ beskrivelse: 'Ingen tilgang' }), {
        status: 403,
        statusText: 'Forbidden',
        headers: { 'content-type': 'application/json' },
      }),
  });

  await assert.rejects(fetcher.get('/ressurs'), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 403);
    assert.deepEqual(error.detaljer, { beskrivelse: 'Ingen tilgang' });
    return true;
  });
});

test('validerer respons med Zod', async () => {
  const fetcher = createFetcher({
    fetch: async () =>
      new Response(JSON.stringify({ id: 1 }), {
        headers: { 'content-type': 'application/json' },
      }),
  });

  await assert.rejects(
    fetcher.getMedSchema(z.object({ id: z.string() }), '/ressurs'),
  );
});
