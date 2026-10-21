import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEKORATØR_URLER,
  filtrerApmHendelse,
  lagApmFeilrapportering,
} from '../dist/apm/index.js';

const lagFeilhendelse = (value, context) => ({
  type: 'exception',
  meta: {},
  payload: { type: 'Error', value, context },
});

const medWindow = (fn) => {
  globalThis.window = {};
  try {
    fn();
  } finally {
    delete globalThis.window;
  }
};

test('filtrerApmHendelse dropper syntetisk console.error-kopi', () => {
  assert.equal(
    filtrerApmHendelse(lagFeilhendelse('console.error: {"feilkode":"abc"}')),
    null,
  );
});

test('filtrerApmHendelse beholder ekte feil og fjerner loggtekst', () => {
  const resultat = filtrerApmHendelse(
    lagFeilhendelse('API-kall feilet', {
      console_message: 'Feil for person-hemmelig',
      statuskode: '500',
    }),
  );
  assert.ok(resultat);
  assert.deepEqual(resultat.payload.context, { statuskode: '500' });
});

test('filtrerApmHendelse slipper gjennom andre hendelsestyper uendret', () => {
  const hendelse = { type: 'log', payload: { message: 'console.error: {' } };
  assert.equal(filtrerApmHendelse(hendelse), hendelse);
});

const SIDE = 'https://www.nav.no/rekrutteringstreff-bruker/treff/123';
const DEKORATØR_SKRIPT =
  'https://cdn.nav.no/personbruker/nav-dekoratoren/client-abc123.js';
const APP_SKRIPT = 'https://www.nav.no/_next/static/chunks/app-abc123.js';

const medStakk = (value, filnavn, sideUrl = SIDE) => ({
  type: 'exception',
  meta: { page: { url: sideUrl } },
  payload: {
    type: 'Error',
    value,
    stacktrace: {
      frames: filnavn.map((filename) => ({ filename, function: 'f' })),
    },
  },
});

test('DEKORATØR_URLER dekker CDN, dev og prod', () => {
  for (const url of [
    DEKORATØR_SKRIPT,
    'https://dekoratoren.ekstern.dev.nav.no/env',
    'https://dekoratoren-beta.intern.dev.nav.no/x',
    'https://dekoratoren-beta-tms.intern.dev.nav.no/x',
    'https://www.nav.no/dekoratoren/api/auth',
  ]) {
    assert.ok(DEKORATØR_URLER.some((r) => r.test(url)), url);
  }
  assert.ok(!DEKORATØR_URLER.some((r) => r.test(APP_SKRIPT)));
  assert.ok(!DEKORATØR_URLER.some((r) => r.test('https://cdn.nav.no/annet/x.js')));
});

test('filtrerApmHendelse dropper feil med stacktrace til Dekoratøren', () => {
  for (const melding of [
    'Failed to fetch auth data',
    'Failed to fetch session',
    'Failed to renew session',
  ]) {
    assert.equal(
      filtrerApmHendelse(medStakk(melding, [APP_SKRIPT, DEKORATØR_SKRIPT])),
      null,
    );
  }
  assert.equal(
    filtrerApmHendelse(
      medStakk('x', ['https://www.nav.no/dekoratoren/client.js']),
    ),
    null,
  );
});

test('filtrerApmHendelse beholder feil fra appen', () => {
  const hendelse = medStakk('Failed to fetch', [APP_SKRIPT]);
  assert.equal(filtrerApmHendelse(hendelse), hendelse);
});

test('filtrerApmHendelse dropper window.ethereum-feil', () => {
  for (const melding of [
    "undefined is not an object (evaluating 'window.ethereum.selectedAddress')",
    "Cannot read properties of undefined (reading 'selectedAddress') window.ethereum.selectedAddress",
  ]) {
    assert.equal(filtrerApmHendelse(lagFeilhendelse(melding)), null, melding);
  }
});

test('filtrerApmHendelse dropper «Script error.»', () => {
  assert.equal(filtrerApmHendelse(lagFeilhendelse('Script error.')), null);
  assert.equal(filtrerApmHendelse(lagFeilhendelse('Script error')), null);
  const ekte = lagFeilhendelse('Script error. i egen kode: noe annet');
  assert.equal(filtrerApmHendelse(ekte), ekte);
});

test('filtrerApmHendelse dropper «Maximum call stack» når stacken bare peker til siden', () => {
  const melding = 'Maximum call stack size exceeded.';
  assert.equal(filtrerApmHendelse(medStakk(melding, [SIDE, SIDE])), null);
  assert.equal(
    filtrerApmHendelse(medStakk(melding, [`${SIDE}?a=1`, `${SIDE}#x`])),
    null,
  );
});

test('filtrerApmHendelse beholder «Maximum call stack» fra appens kode', () => {
  const melding = 'Maximum call stack size exceeded';
  const blandet = medStakk(melding, [SIDE, APP_SKRIPT]);
  assert.equal(filtrerApmHendelse(blandet), blandet);
  const utenStakk = medStakk(melding, []);
  assert.equal(filtrerApmHendelse(utenStakk), utenStakk);
});

test('filtrerApmHendelse bruker window.location når meta mangler', () => {
  const hendelse = medStakk('Maximum call stack size exceeded', [SIDE]);
  delete hendelse.meta;
  globalThis.window = { location: { href: `${SIDE}?q=1` } };
  try {
    assert.equal(filtrerApmHendelse(hendelse), null);
  } finally {
    delete globalThis.window;
  }
});

test('filtrerApmHendelse beholder React #418 inntil videre', () => {
  const hendelse = lagFeilhendelse(
    'Minified React error #418; visit https://react.dev/errors/418',
  );
  assert.equal(filtrerApmHendelse(hendelse), hendelse);
});

test('rapporterApiFeil grupperer per endepunkt og hopper over 401/403', () => {
  const kall = [];
  const { rapporterApiFeil } = lagApmFeilrapportering({
    aktiv: true,
    captureException: (feil, valg) => kall.push({ feil, valg }),
  });
  medWindow(() => {
    rapporterApiFeil(500, 'https://x.no/api/stilling/51c5808f-40e3/kandidat/PAM123');
    rapporterApiFeil(401, 'https://x.no/api/a');
    rapporterApiFeil(403, 'https://x.no/api/a');
  });
  assert.equal(kall.length, 1);
  assert.equal(kall[0].feil.name, 'ApiFeil');
  assert.equal(kall[0].feil.message, 'API-kall feilet med status 500');
  assert.equal(kall[0].valg.fingerprint, '500 /api/stilling/:id/kandidat/:id');
  assert.equal(kall[0].valg.context.statuskode, 500);
});

test('rapporterFeil rapporterer samme feil bare én gang', () => {
  const kall = [];
  const { rapporterFeil } = lagApmFeilrapportering({
    aktiv: true,
    captureException: (feil) => kall.push(feil),
  });
  const feil = new Error('test');
  medWindow(() => {
    rapporterFeil(feil);
    rapporterFeil(feil);
  });
  assert.equal(kall.length, 1);
  assert.equal(kall[0], feil);
});

test('rapporterFeil gjør ingenting når inaktiv eller på server', () => {
  const kall = [];
  const inaktiv = lagApmFeilrapportering({
    aktiv: false,
    captureException: (feil) => kall.push(feil),
  });
  medWindow(() => inaktiv.rapporterFeil(new Error('test')));

  const aktiv = lagApmFeilrapportering({
    aktiv: true,
    captureException: (feil) => kall.push(feil),
  });
  aktiv.rapporterFeil(new Error('server'));
  assert.equal(kall.length, 0);
});
