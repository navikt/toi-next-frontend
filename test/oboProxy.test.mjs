import assert from 'node:assert/strict';
import test from 'node:test';
import { opprettOboProxy } from '../dist/next/index.js';

test('forwarder metode, body og OBO-token til oppstrømsruten', async () => {
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url, init };
    return new Response('{"ok":true}', {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });
  };
  const proxy = opprettOboProxy({ hentToken: async () => 'obo-token' });
  const response = await proxy(
    {
      apiUrl: 'https://api.nav.no',
      apiRute: '/api',
      internUrl: '/api/ressurs',
    },
    new Request('https://app.nav.no/api/ressurs/1?utvid=true', {
      method: 'PUT',
      body: '{"navn":"Ada"}',
    }),
  );

  assert.equal(request.url, 'https://api.nav.no/api/1?utvid=true');
  assert.equal(request.init.headers.get('Authorization'), 'Bearer obo-token');
  assert.equal(await new Response(request.init.body).text(), '{"navn":"Ada"}');
  assert.equal(response.status, 201);
  assert.equal(await response.text(), '{"ok":true}');
});

test('bruker byggMålUrl, overstyrtBody og normaliserRespons', async () => {
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url, init };
    return new Response('{"ok":true}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const proxy = opprettOboProxy({
    hentToken: async () => 'obo-token',
    byggMålUrl: () => 'http://mock-api/ressurs',
    normaliserRespons: async (respons) =>
      new Response(await respons.text(), {
        status: respons.status,
        headers: { 'x-normalisert': 'ja' },
      }),
  });

  const response = await proxy(
    {
      apiUrl: 'https://api.nav.no',
      apiRute: '/api',
      internUrl: '/api/ressurs',
    },
    new Request('https://app.nav.no/api/ressurs', { method: 'POST' }),
    undefined,
    { navn: 'Ada' },
  );

  assert.equal(request.url, 'http://mock-api/ressurs');
  assert.equal(request.init.headers.get('Content-Type'), 'application/json');
  assert.equal(await new Response(request.init.body).text(), '{"navn":"Ada"}');
  assert.equal(response.headers.get('x-normalisert'), 'ja');
  assert.equal(await response.text(), '{"ok":true}');
});

test('transformerHeaders endrer videresendte headere før Authorization settes', async () => {
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url, init };
    return new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const proxy = opprettOboProxy({
    hentToken: async () => 'obo-token',
    transformerHeaders: (headers) => {
      headers.set('Content-Type', 'application/json');
      headers.delete('cookie');
      return headers;
    },
  });

  await proxy(
    {
      apiUrl: 'https://api.nav.no',
      apiRute: '/api',
      internUrl: '/api/ressurs',
    },
    new Request('https://app.nav.no/api/ressurs', {
      method: 'GET',
      headers: { cookie: 'AMP_1=x', 'content-type': 'text/plain' },
    }),
  );

  assert.equal(request.init.headers.get('cookie'), null);
  assert.equal(request.init.headers.get('Content-Type'), 'application/json');
  assert.equal(request.init.headers.get('Authorization'), 'Bearer obo-token');
});

test('mockBaseUrl ruter til mock uten apiUrl og bruker original pathname', async () => {
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url, init };
    return new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const proxy = opprettOboProxy({
    hentToken: async () => 'obo-token',
    mockBaseUrl: 'http://mock-api',
  });

  const response = await proxy(
    { apiUrl: '', apiRute: '/api', internUrl: '/api/ressurs' },
    new Request('https://app.nav.no/api/ressurs/1?utvid=true', {
      method: 'GET',
    }),
  );

  assert.equal(request.url, 'http://mock-api/api/ressurs/1?utvid=true');
  assert.equal(response.status, 200);
});
