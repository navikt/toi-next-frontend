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
