import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import {
  ApiError,
  createFetcher,
  hentEsFørsteKilde,
  hentEsKilder,
} from '../dist/api/index.js';

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

test('bruker lagFeil-fabrikk med skjulFeilmelding fra status', async () => {
  const fetcher = createFetcher({
    lagFeil: (info) => {
      const feil = new Error(`egen: ${info.status}`);
      feil.skjul = info.skjulFeilmelding;
      return feil;
    },
    fetch: async () =>
      new Response('{}', {
        status: 404,
        headers: { 'content-type': 'application/json' },
      }),
  });

  await assert.rejects(
    fetcher.get('/ressurs', { skjulFeilmelding: [404, 409] }),
    (error) => {
      assert.equal(error.message, 'egen: 404');
      assert.equal(error.skjul, true);
      return true;
    },
  );
});

test('prøver på nytt ved nettverksfeil og lykkes til slutt', async () => {
  let forsøk = 0;
  const fetcher = createFetcher({
    maxForsøk: 2,
    fetch: async () => {
      forsøk += 1;
      if (forsøk < 3) {
        throw new TypeError('Failed to fetch');
      }
      return new Response('{"ok":true}', {
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  const resultat = await fetcher.get('/ressurs');
  assert.deepEqual(resultat, { ok: true });
  assert.equal(forsøk, 3);
});

test('wrapper nettverksfeil med lagNettverksfeil', async () => {
  const fetcher = createFetcher({
    lagNettverksfeil: ({ url }) => new Error(`nettverk: ${url}`),
    fetch: async () => {
      throw new TypeError('Failed to fetch');
    },
  });

  await assert.rejects(fetcher.get('/ressurs'), (error) => {
    assert.equal(error.message, 'nettverk: /ressurs');
    return true;
  });
});

test('validerSchema logger og returnerer data uten å kaste', () => {
  let logget;
  const fetcher = createFetcher({
    loggValidering: (info) => {
      logget = info;
    },
  });

  const data = fetcher.validerSchema(z.object({ id: z.string() }), { id: 1 });
  assert.deepEqual(data, { id: 1 });
  assert.equal(logget.antallFeil, 1);
  assert.equal(logget.feil[0].sti, 'id');
});

test('hentEsKilder og hentEsFørsteKilde mapper Elasticsearch-svar', () => {
  const svar = {
    hits: { hits: [{ _source: { navn: 'Ada' } }, { _source: { navn: 'Ben' } }] },
  };
  assert.deepEqual(hentEsKilder(svar), [{ navn: 'Ada' }, { navn: 'Ben' }]);
  assert.deepEqual(hentEsFørsteKilde(svar), { navn: 'Ada' });
});
