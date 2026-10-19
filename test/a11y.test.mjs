import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from '@playwright/test';
import {
  analyserTilgjengelighet,
  formaterBrudd,
  sjekkReflow,
  sjekkTilgjengelighet,
  WCAG21_AA_TAGGER,
} from '../dist/a11y/index.js';

const lagBrudd = (antallNoder) => ({
  id: 'image-alt',
  impact: 'critical',
  tags: ['cat.text-alternatives', 'wcag2a', 'wcag111', 'section508'],
  help: 'Images must have alternative text',
  helpUrl: 'https://dequeuniversity.com/rules/axe/4.14/image-alt',
  nodes: Array.from({ length: antallNoder }, (_, i) => ({
    target: [`img:nth-child(${i + 1})`],
  })),
});

test('WCAG21_AA_TAGGER dekker A og AA i WCAG 2.0 og 2.1', () => {
  assert.deepEqual(
    [...WCAG21_AA_TAGGER],
    ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
  );
});

test('formaterBrudd viser regel, kriterium og elementer', () => {
  assert.equal(formaterBrudd([]), 'Ingen WCAG 2.1 A/AA-brudd funnet');

  const tekst = formaterBrudd([lagBrudd(7)]);
  assert.match(tekst, /1 WCAG 2\.1 A\/AA-brudd funnet/);
  assert.match(tekst, /\[critical\] image-alt \(WCAG 1\.1\.1\)/);
  assert.match(tekst, /img:nth-child\(5\)/);
  assert.doesNotMatch(tekst, /img:nth-child\(6\)/);
  assert.match(tekst, /… og 2 til/);
});

const startNettleser = async () => {
  try {
    return await chromium.launch();
  } catch {
    return undefined;
  }
};

const nettleser = await startNettleser();

test(
  'axe finner brudd i Chromium',
  { skip: !nettleser && 'Chromium er ikke installert' },
  async (t) => {
    const kontekst = await nettleser.newContext();
    const page = await kontekst.newPage();
    t.after(() => kontekst.close());

    await page.setContent(`
      <html lang="nb"><head><title>Test</title></head><body>
        <main>
          <h1>Overskrift</h1>
          <img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">
          <p style="color:#bbb;background:#fff">Lav kontrast</p>
        </main>
        <div data-axe-ignore><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></div>
      </body></html>`);

    const resultat = await analyserTilgjengelighet(page);
    const regler = resultat.violations.map((b) => b.id).sort();
    assert.deepEqual(regler, ['color-contrast', 'image-alt']);

    const bildeBrudd = resultat.violations.find((b) => b.id === 'image-alt');
    assert.equal(bildeBrudd.nodes.length, 1, 'dekoratøren skal ekskluderes');

    const medUnntak = await analyserTilgjengelighet(page, {
      unntak: { 'color-contrast': 'Test' },
      ekskluder: ['main img'],
    });
    assert.deepEqual(medUnntak.violations, []);

    await assert.rejects(
      sjekkTilgjengelighet(page),
      /2 WCAG 2\.1 A\/AA-brudd funnet/,
    );
  },
);

test(
  'kontrast måles etter at CSS-overganger er ferdige',
  { skip: !nettleser && 'Chromium er ikke installert' },
  async (t) => {
    const kontekst = await nettleser.newContext();
    const page = await kontekst.newPage();
    t.after(() => kontekst.close());

    await page.setContent(`
      <html lang="nb"><head><title>Test</title></head><body>
        <main><p id="tekst" style="color:#ddd;background:#fff;transition:color 60s linear">Tekst</p></main>
      </body></html>`);
    await page.evaluate(() => {
      const tekst = document.getElementById('tekst');
      getComputedStyle(tekst).color;
      tekst.style.color = '#000';
    });
    await page.waitForFunction(() => document.getAnimations().length > 0);

    const resultat = await analyserTilgjengelighet(page);
    assert.deepEqual(
      resultat.violations.map((b) => b.id),
      [],
    );
  },
);

test(
  'sjekkReflow feiler ved horisontal rulling og gjenoppretter viewport',
  { skip: !nettleser && 'Chromium er ikke installert' },
  async (t) => {
    const kontekst = await nettleser.newContext({
      viewport: { width: 1200, height: 800 },
    });
    const page = await kontekst.newPage();
    t.after(() => kontekst.close());

    await page.setContent('<main><p>Kort tekst</p></main>');
    await sjekkReflow(page);

    await page.setContent('<main><div style="width:600px">Bred</div></main>');
    await assert.rejects(sjekkReflow(page), /WCAG 1\.4\.10/);
    assert.deepEqual(page.viewportSize(), { width: 1200, height: 800 });
  },
);

test.after(() => nettleser?.close());
