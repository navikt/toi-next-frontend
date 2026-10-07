import assert from 'node:assert/strict';
import test from 'node:test';
import {
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
