import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from '@playwright/test';
import {
  analyserTastatur,
  analyserTekstavstand,
  analyserTekstforstørrelse,
  analyserVisningsretning,
  formaterTastaturfunn,
  sjekkReflow,
} from '../dist/a11y/index.js';

const nettleser = await chromium.launch().catch(() => undefined);
const hopp = !nettleser && 'Chromium er ikke installert';

async function nySide(t, html, viewport = { width: 1000, height: 700 }) {
  const kontekst = await nettleser.newContext({ viewport });
  const page = await kontekst.newPage();
  t.after(() => kontekst.close());
  await page.setContent(
    `<!doctype html><html lang="nb"><head><title>Test</title></head><body style="margin:0;font:1rem/1.2 sans-serif">${html}</body></html>`,
  );
  return page;
}

test(
  'tekstforstørrelse finner bare ny avkuttet tekst',
  { skip: hopp },
  async (t) => {
    const page = await nySide(
      t,
      `<main>
      <div id="fast" style="height:1.5rem;width:20rem;overflow:hidden">Fast høyde</div>
      <div id="fast-px" style="height:24px;width:300px;overflow:hidden;white-space:nowrap">Boks i px som ikke vokser</div>
      <div style="width:20rem">Fleksibel boks som vokser med teksten</div>
      <div style="width:4rem;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">Allerede avkuttet tekst</div>
      <span style="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)">Skjermlesertekst</span>
      <div data-axe-ignore style="height:10px;overflow:hidden">Dekoratør</div>
    </main>`,
    );
    const funn = await analyserTekstforstørrelse(page);
    assert.equal(funn.length, 1, funn.join('\n'));
    assert.match(funn[0], /div#fast-px «Boks i px som ikke vokser»/);
    assert.equal(
      await page.evaluate(() => document.documentElement.style.fontSize),
      '',
      'skriftstørrelsen skal tilbakestilles',
    );
  },
);

test(
  'tekstforstørrelse finner ny avkuttet tekst i container som allerede kutter annen tekst',
  { skip: hopp },
  async (t) => {
    const page = await nySide(
      t,
      `<main><div id="scroll" style="width:400px;height:300px;overflow-x:hidden;overflow-y:auto">
      <div style="white-space:nowrap;margin-left:-50px">Var avkuttet allerede</div>
      <div style="display:flex;gap:8px;width:400px">
        <span style="flex:1">Kort tittel</span><span style="white-space:nowrap">Mitt oppdrag i Oslo kommune</span>
      </div>
    </div></main>`,
    );
    const funn = await analyserTekstforstørrelse(page);
    assert.equal(funn.length, 1, funn.join('\n'));
    assert.match(funn[0], /div#scroll «/);
    assert.doesNotMatch(funn[0], /Var avkuttet allerede/);
  },
);

test(
  'tekstavstand finner tekst som blir avkuttet',
  { skip: hopp },
  async (t) => {
    const page = await nySide(
      t,
      `<main>
      <div id="to-linjer" style="height:40px;width:400px;overflow:hidden;white-space:nowrap;line-height:1.2">Linje en<br>Linje to</div>
      <p style="width:400px">Vanlig avsnitt som får plass</p>
    </main>`,
    );
    const funn = await analyserTekstavstand(page);
    assert.equal(funn.length, 1, funn.join('\n'));
    assert.match(funn[0], /div#to-linjer/);
    assert.equal(
      await page.locator('#toi-a11y-tekstavstand').count(),
      0,
      'CSS-en skal fjernes',
    );
  },
);

test(
  'visningsretning finner innhold som er skjult i stående visning',
  { skip: hopp },
  async (t) => {
    const ok = await nySide(t, '<main><h1>Hei</h1></main>');
    assert.deepEqual(await analyserVisningsretning(ok), []);
    assert.deepEqual(ok.viewportSize(), { width: 1000, height: 700 });

    const låst = await nySide(
      t,
      '<style>@media (orientation: portrait) { main { display: none } }</style><main><h1>Hei</h1></main>',
    );
    assert.deepEqual(await analyserVisningsretning(låst), [
      'Hovedinnholdet er skjult i stående visning',
    ]);
  },
);

test(
  'tastatur: side uten feil gir ingen funn og komplett fokusrekkefølge',
  { skip: hopp },
  async (t) => {
    const page = await nySide(
      t,
      `<main>
      <a href="#a">Lenke</a>
      <button>Knapp</button>
      <label><input type="checkbox"> Avkrysning</label>
      <div data-axe-ignore><button style="outline:none">Dekoratør</button></div>
      <div style="cursor:pointer" data-axe-ignore>Klikkbar dekoratør</div>
    </main>`,
    );
    const resultat = await analyserTastatur(page);
    assert.deepEqual(resultat.funn, [], formaterTastaturfunn(resultat.funn));
    assert.equal(resultat.fullført, true);
    assert.deepEqual(
      resultat.fokusrekkefølge.map((e) => e.split(' ')[0]),
      ['a', 'button', 'input', 'button'],
    );
  },
);

test(
  'tastatur: finner klikkbart element uten tastatur og manglende synlig fokus (2.1.1, 2.4.7)',
  { skip: hopp },
  async (t) => {
    const page = await nySide(
      t,
      `<main>
      <button>Med fokus</button>
      <div id="klikk" style="cursor:pointer" onclick="void 0">Klikk meg <span>barn</span></div>
      <div role="button">Rolleknapp</div>
      <button id="usynlig" style="outline:none;border:0;background:none">Uten fokusmarkering</button>
    </main>`,
    );
    const { funn } = await analyserTastatur(page);
    assert.deepEqual(
      funn.map((f) => `${f.kriterium} ${f.element.split(' ')[0]}`).sort(),
      ['2.1.1 div', '2.1.1 div#klikk', '2.4.7 button#usynlig'],
      formaterTastaturfunn(funn),
    );
  },
);

test(
  'tastatur: klikkbart kort med lenke inni regnes ikke som 2.1.1-brudd',
  { skip: hopp },
  async (t) => {
    const page = await nySide(
      t,
      `<main><div class="aksel-link-anchor__overlay" style="cursor:pointer;padding:1rem" onclick="this.querySelector('a').click()">
      <h2><a class="aksel-link-anchor" href="#vilkaar">Vilkår for tjenesten</a></h2>
      <p>Les vilkårene før du tar tjenesten i bruk.</p>
    </div></main>`,
    );
    const { funn } = await analyserTastatur(page);
    assert.deepEqual(
      funn.filter((f) => f.kriterium === '2.1.1'),
      [],
      formaterTastaturfunn(funn),
    );
  },
);

test(
  'tastatur: fokus på forelder (:focus-within) teller som synlig fokus',
  { skip: hopp },
  async (t) => {
    const page = await nySide(
      t,
      `<style>.kort:focus-within { outline: 3px solid blue } .kort a { outline: none }</style>
     <main><div class="kort" style="padding:2rem;width:300px"><a href="#x">Kortlenke</a></div></main>`,
    );
    const { funn } = await analyserTastatur(page);
    assert.deepEqual(funn, [], formaterTastaturfunn(funn));
  },
);

test(
  'tastatur: finner tastaturfelle og kontekstendring ved fokus (2.1.2, 3.2.1)',
  { skip: hopp },
  async (t) => {
    const felle = await nySide(
      t,
      `<main><button>Før</button><input id="felle" aria-label="Felle"><button>Etter</button></main>
     <script>document.getElementById('felle').addEventListener('keydown', (e) => { if (e.key === 'Tab') e.preventDefault(); });</script>`,
    );
    const fellefunn = (await analyserTastatur(felle)).funn;
    assert.deepEqual(
      fellefunn.map((f) => f.kriterium),
      ['2.1.2'],
      formaterTastaturfunn(fellefunn),
    );

    const dialog = await nySide(
      t,
      `<main><button>Først</button><button id="aapner">Åpner dialog</button></main>
     <script>document.getElementById('aapner').addEventListener('focus', () => {
       document.body.insertAdjacentHTML('beforeend', '<div role="dialog" aria-label="D" style="width:100px;height:100px">Dialog</div>');
     });</script>`,
    );
    const dialogfunn = (await analyserTastatur(dialog)).funn;
    assert.equal(dialogfunn.length, 1, formaterTastaturfunn(dialogfunn));
    assert.equal(dialogfunn[0].kriterium, '3.2.1');
    assert.match(dialogfunn[0].element, /åpnet en dialog/);
  },
);

test(
  'reflow venter til layouten er stabil (JS som tilpasser seg etter resize)',
  { skip: hopp },
  async (t) => {
    const page = await nySide(
      t,
      `<main><p>Innhold</p></main>
     <script>
       addEventListener('resize', () => setTimeout(() => {
         if (innerWidth < 400 && !document.getElementById('bred')) {
           document.querySelector('main').insertAdjacentHTML('beforeend', '<div id="bred" style="width:540px">Bred</div>');
         }
       }, 400));
     </script>`,
    );
    await assert.rejects(sjekkReflow(page), /WCAG 1\.4\.10/);
    assert.deepEqual(page.viewportSize(), { width: 1000, height: 700 });
  },
);

test(
  'tekstforstørrelse venter til layouten er stabil',
  { skip: hopp },
  async (t) => {
    const page = await nySide(
      t,
      `<main><div id="boks" style="width:300px;height:3rem;overflow:hidden">Kort tekst</div></main>
     <script>
       new ResizeObserver(() => setTimeout(() => {
         const boks = document.getElementById('boks');
         if (parseFloat(getComputedStyle(document.documentElement).fontSize) > 20) boks.style.height = '24px';
       }, 500)).observe(document.documentElement);
     </script>`,
    );
    const funn = await analyserTekstforstørrelse(page);
    assert.equal(funn.length, 1, funn.join('\n'));
  },
);

test.after(() => nettleser?.close());
