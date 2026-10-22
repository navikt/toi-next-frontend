import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from '@playwright/test';
import {
  analyserBevegelse,
  analyserKontrastIkkeTekst,
  analyserLandemerker,
  analyserPekepinner,
  analyserSpråk,
  formaterPekepinner,
  PEKEPINN_ANNOTASJON,
  rapporterPekepinner,
  ventTilStabilLayout,
} from '../dist/a11y/index.js';

const nettleser = await chromium.launch().catch(() => undefined);
const hopp = !nettleser && 'Chromium er ikke installert';

async function nySide(t, html, lang = 'nb') {
  const kontekst = await nettleser.newContext();
  const page = await kontekst.newPage();
  t.after(() => kontekst.close());
  await page.setContent(
    `<!doctype html><html lang="${lang}"><head><title>Test</title></head><body style="margin:0;background:#fff">${html}</body></html>`,
  );
  return page;
}

const elementer = (funn) => funn.map((f) => f.element.split(' ')[0]);

test(
  'kontrast for ikke-tekst: kanter på skjemafelt (1.4.11)',
  { skip: hopp },
  async (t) => {
    const page = await nySide(
      t,
      `<main>
      <input id="svak" aria-label="Svak" style="border:1px solid #ddd;background:#fff">
      <input id="god" aria-label="God" style="border:1px solid #767676;background:#fff">
      <input id="fylt" aria-label="Fylt" style="border:0;background:#595959;color:#fff">
      <input id="oklch" aria-label="Oklch" style="border:1px solid oklch(0.9 0 0)">
      <div style="border:1px solid #767676;display:flex"><input id="omsluttet" aria-label="Omsluttet" style="border:0;background:none"></div>
      <div data-axe-ignore><input aria-label="Dekoratør" style="border:1px solid #eee"></div>
      <div style="background:#000;padding:40px"><input id="mork" aria-label="Mørk" style="border:1px solid #222;background:#000"></div>
    </main>`,
    );
    const funn = await analyserKontrastIkkeTekst(page);
    assert.deepEqual(
      elementer(funn),
      ['input#svak', 'input#oklch', 'input#mork'],
      JSON.stringify(funn),
    );
    assert.equal(funn[0].kriterium, '1.4.11');
    assert.match(
      funn[0].melding,
      /kanten skiller feltet fra bakgrunnen med bare 1\.\d+:1 \(krav 3:1\)/,
    );
  },
);

test(
  'kontrast for ikke-tekst: ikoner i knapper uten tekst og fokusring',
  { skip: hopp },
  async (t) => {
    const ikon = (farge) =>
      `<svg width="16" height="16" aria-hidden="true"><path d="M0 0h16v16H0z" fill="${farge}"/></svg>`;
    const page = await nySide(
      t,
      `<style>
      button { border: 0; background: none; outline: none }
      #svak-ring:focus-visible { outline: 2px solid #ccc }
      #god-ring:focus-visible { outline: 2px solid #0067c5 }
      #skygge:focus-visible { box-shadow: 0 0 0 3px #eee }
    </style>
    <main>
      <button id="lyst" aria-label="Lukk">${ikon('#ccc')}</button>
      <button id="mørkt" aria-label="Søk">${ikon('#333')}</button>
      <button id="med-tekst">${ikon('#ccc')} Lagre</button>
      <button id="svak-ring">Svak ring</button>
      <button id="god-ring">God ring</button>
      <button id="skygge">Skygge</button>
      <button id="ingen-ring">Ingen ring</button>
    </main>`,
    );
    await page.locator('#god-ring').focus();
    const funn = await analyserKontrastIkkeTekst(page);
    assert.deepEqual(
      funn.map(
        (f) => `${f.element.split(' ')[0]}: ${f.melding.split(' har')[0]}`,
      ),
      [
        'button#lyst: ikonet',
        'button#svak-ring: fokusringen',
        'button#skygge: fokusringen',
      ],
      JSON.stringify(funn, null, 2),
    );
    assert.equal(
      await page.evaluate(() => document.activeElement?.id),
      'god-ring',
      'fokus skal tilbake dit det var',
    );
  },
);

test(
  'bevegelse: uendelige og lange animasjoner (2.2.2)',
  { skip: hopp },
  async (t) => {
    const page = await nySide(
      t,
      `<style>
      @keyframes snurr { to { transform: rotate(360deg) } }
      @keyframes blink { 50% { opacity: .5 } }
      #rolig { animation: blink 1s infinite }
      @media (prefers-reduced-motion: reduce) { #rolig { animation: none } }
    </style>
    <main>
      <div id="karusell" style="animation: blink 2s infinite">Karusell</div>
      <div id="rolig">Respekterer redusert bevegelse</div>
      <div id="lang" style="animation: blink 8s 1">Lang</div>
      <div id="kort" style="animation: blink 3s 1">Kort</div>
      <div class="navds-loader" style="animation: snurr 1s linear infinite">Laster</div>
      <div data-axe-ignore style="animation: snurr 1s infinite">Dekoratør</div>
      <div style="display:none;animation: snurr 1s infinite">Skjult</div>
    </main>`,
    );
    const funn = await analyserBevegelse(page);
    const meldinger = Object.fromEntries(
      funn.map((f) => [f.element.split(' ')[0], f.melding]),
    );
    assert.deepEqual(
      Object.keys(meldinger),
      ['div#karusell', 'div#rolig', 'div#lang', 'div.navds-loader'],
      JSON.stringify(funn, null, 2),
    );
    assert.match(
      meldinger['div#karusell'],
      /«blink» går i det uendelige og stopper ikke med prefers-reduced-motion/,
    );
    assert.match(
      meldinger['div#rolig'],
      /men stopper med prefers-reduced-motion/,
    );
    assert.match(meldinger['div#lang'], /varer 8 s/);
    assert.match(meldinger['div.navds-loader'], /trolig lasteindikator/);
    assert.equal(
      await page.evaluate(
        () => matchMedia('(prefers-reduced-motion: reduce)').matches,
      ),
      false,
      'emuleringen skal tilbakestilles',
    );
  },
);

test(
  'språk: tekstblokker på et annet språk enn lang (3.1.2)',
  { skip: hopp },
  async (t) => {
    const page = await nySide(
      t,
      `<main>
      <p id="norsk">Vi søker en dyktig utvikler som har lyst til å jobbe med tilgjengelighet og universell utforming i Nav.</p>
      <p id="engelsk">We are looking for a skilled developer who wants to work with accessibility in our team, and you will be part of it.</p>
      <p id="merket" lang="en">We are looking for a skilled developer who wants to work with accessibility in our team, and you will be part of it.</p>
      <p id="svensk">Vi söker en utvecklare som vill arbeta med tillgänglighet och det är inte svårt att komma till oss.</p>
      <p id="nynorsk">Vi ser etter ein utviklar som har lyst til å jobbe med tilgjenge, og det er ikkje berre for dei som kan mykje.</p>
      <div id="div">Please read the terms and conditions of the agreement before you sign it, and contact us if you have any questions.<p>Les vilkårene før du signerer og ta kontakt med oss om du har spørsmål.</p></div>
      <p id="kort">Read more about it</p>
      <pre>the and of is in that with you are this be will</pre>
    </main>`,
    );
    const funn = await analyserSpråk(page);
    assert.deepEqual(
      elementer(funn).sort(),
      ['div#div', 'p#engelsk', 'p#svensk'],
      JSON.stringify(funn, null, 2),
    );
    const engelsk = funn.find((f) => f.element.startsWith('p#engelsk'));
    assert.equal(
      engelsk.melding,
      'teksten ser ut til å være engelsk, men lang er «nb» (arvet fra <html>)',
    );
    assert.equal(engelsk.kriterium, '3.1.2');
  },
);

test(
  'landemerker: duplisert og nøstet main gir pekepinner',
  { skip: hopp },
  async (t) => {
    const ok = await nySide(
      t,
      '<header>Topp</header><main><h1>Hei</h1></main>',
    );
    assert.deepEqual(await analyserLandemerker(ok), []);

    const feil = await nySide(
      t,
      '<main><h1>Hei</h1></main><aside><main>Nøstet</main></aside>',
    );
    const funn = await analyserLandemerker(feil);
    const regler = [
      ...new Set(funn.map((f) => f.melding.split(':')[0])),
    ].sort();
    assert.deepEqual(regler, [
      'landmark-main-is-top-level',
      'landmark-no-duplicate-main',
    ]);
  },
);

test(
  'pekepinner rapporteres som annotations og vedlegg uten å kaste',
  { skip: hopp },
  async (t) => {
    const page = await nySide(
      t,
      `<style>@keyframes blink { 50% { opacity: .5 } }</style>
    <main><input aria-label="Felt" style="border:1px solid #eee"><div style="animation: blink 1s infinite">Blinker</div></main>`,
    );
    const resultat = await analyserPekepinner(page, {
      språk: false,
      landemerker: false,
    });
    assert.deepEqual(resultat.feil, []);
    assert.deepEqual(
      resultat.pekepinner.map((p) => p.sjekk),
      ['bevegelse', 'kontrast-ikke-tekst'],
    );

    const vedlegg = [];
    const testInfo = {
      annotations: [],
      attach: async (navn, innhold) => vedlegg.push({ navn, ...innhold }),
    };
    await rapporterPekepinner(testInfo, {
      ...resultat,
      feil: ['språk: noe gikk galt'],
    });
    assert.deepEqual(
      testInfo.annotations.map((a) => a.type),
      [PEKEPINN_ANNOTASJON, PEKEPINN_ANNOTASJON, `${PEKEPINN_ANNOTASJON}-feil`],
    );
    assert.match(
      testInfo.annotations[0].description,
      /^WCAG 2\.2\.2 div «Blinker»: animasjonen «blink»/,
    );
    assert.equal(vedlegg[0].navn, 'a11y-pekepinner.json');
    assert.equal(JSON.parse(vedlegg[0].body).pekepinner.length, 2);
    assert.match(
      formaterPekepinner(resultat.pekepinner),
      /Pekepinner om tilgjengelighet \(2\)/,
    );

    const tom = {
      annotations: [],
      attach: async () => assert.fail('skal ikke legge ved'),
    };
    await rapporterPekepinner(tom, { pekepinner: [], feil: [] });
    assert.deepEqual(tom.annotations, []);
  },
);

test(
  'ventTilStabilLayout tåler at siden navigerer mens den venter',
  { skip: hopp },
  async (t) => {
    const kontekst = await nettleser.newContext();
    const page = await kontekst.newPage();
    t.after(() => kontekst.close());
    await page.route('https://toi.test/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<main>Ny side</main>' }),
    );
    await page.goto('https://toi.test/a');
    await page.evaluate(() => setTimeout(() => (location.href = '/b'), 50));
    await ventTilStabilLayout(page);
    assert.equal(new URL(page.url()).pathname, '/b');
  },
);

test.after(() => nettleser?.close());
