import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from '@playwright/test';
import {
  analyserDialog,
  analyserPekerfølsomtInnhold,
  analyserSkjemafeil,
} from '../dist/a11y/index.js';

const nettleser = await chromium.launch().catch(() => undefined);
const hopp = !nettleser && 'Chromium er ikke installert';

async function nySide(t, html) {
  const kontekst = await nettleser.newContext({
    viewport: { width: 1000, height: 700 },
  });
  const page = await kontekst.newPage();
  t.after(() => kontekst.close());
  await page.setContent(
    `<!doctype html><html lang="nb"><head><title>Test</title></head><body><main>${html}</main></body></html>`,
  );
  return page;
}

test(
  'dialog: native modal dialog gir ingen funn',
  { skip: hopp },
  async (t) => {
    const page = await nySide(
      t,
      `<button id="apne" onclick="document.getElementById('d').showModal()">Åpne</button>
     <dialog id="d" aria-labelledby="tittel">
       <h2 id="tittel">Slett kandidat</h2>
       <button>Slett</button>
       <button onclick="document.getElementById('d').close()">Avbryt</button>
     </dialog>`,
    );
    const funn = await analyserDialog(page, page.locator('#apne'));
    assert.deepEqual(funn, []);
  },
);

test(
  'dialog: finner manglende navn, fokus og Esc',
  { skip: hopp },
  async (t) => {
    const page = await nySide(
      t,
      `<button id="apne" onclick="document.getElementById('d').hidden=false">Åpne</button>
       <div id="d" role="dialog" hidden><p>Innhold</p><button>OK</button></div>`,
    );
    const funn = await analyserDialog(page, page.locator('#apne'));
    assert.equal(funn.length, 3, funn.join('\n'));
    assert.match(funn[0], /WCAG 4\.1\.2: dialogen har ikke navn/);
    assert.match(funn[1], /WCAG 2\.4\.3: fokus flyttes ikke inn/);
    assert.match(funn[2], /WCAG 2\.1\.2: dialogen lukkes ikke med Esc/);
  },
);

test(
  'dialog: finner fokus som lekker ut av modal og ikke kommer tilbake',
  { skip: hopp },
  async (t) => {
    const page = await nySide(
      t,
      `<button id="apne">Åpne</button>
       <button id="bak">Bak dialogen</button>
       <div id="d" role="dialog" aria-modal="true" aria-label="Velg" hidden>
         <button id="forste">Første</button>
       </div>
       <script>
         const d = document.getElementById('d');
         document.getElementById('apne').onclick = () => {
           d.hidden = false;
           document.getElementById('forste').focus();
         };
         d.addEventListener('keydown', (e) => {
           if (e.key === 'Escape') d.hidden = true;
         });
       </script>`,
    );
    const funn = await analyserDialog(page, page.locator('#apne'));
    assert.equal(funn.length, 2, funn.join('\n'));
    assert.match(funn[0], /Tab flytter fokus ut av den modale dialogen/);
    assert.match(funn[1], /fokus går ikke tilbake til utløseren/);
  },
);

test(
  'dialog: kjører axe på innholdet i dialogen',
  { skip: hopp },
  async (t) => {
    const page = await nySide(
      t,
      `<button id="apne" onclick="document.getElementById('d').showModal()">Åpne</button>
     <dialog id="d" aria-label="Bilde"><svg role="img" width="10" height="10"></svg><button>Lukk</button></dialog>`,
    );
    const funn = await analyserDialog(page, page.locator('#apne'));
    assert.equal(funn.length, 1, funn.join('\n'));
    assert.match(funn[0], /svg-img-alt/);
  },
);

const tooltipSkript = (godt) => `
  <button id="utloser" aria-describedby="tips">Hjelp</button>
  <div id="tips" role="tooltip" hidden style="position:absolute;top:60px;left:0;padding:8px">Skriv en e-post til kandidaten</div>
  <script>
    const u = document.getElementById('utloser');
    const tips = document.getElementById('tips');
    let tidtaker;
    const vis = () => { clearTimeout(tidtaker); tips.hidden = false; };
    const skjul = () => { tidtaker = setTimeout(() => (tips.hidden = true), ${godt ? 150 : 0}); };
    u.addEventListener('mouseenter', vis);
    u.addEventListener('mouseleave', skjul);
    u.addEventListener('focus', vis);
    u.addEventListener('blur', () => (tips.hidden = true));
    ${
      godt
        ? `tips.addEventListener('mouseenter', vis);
           tips.addEventListener('mouseleave', skjul);
           document.addEventListener('keydown', (e) => { if (e.key === 'Escape') tips.hidden = true; });`
        : ''
    }
  </script>`;

test(
  'pekerfølsomt innhold: hjelpetekst som kan nås og lukkes gir ingen funn',
  { skip: hopp },
  async (t) => {
    const page = await nySide(t, tooltipSkript(true));
    const funn = await analyserPekerfølsomtInnhold(
      page,
      page.locator('#utloser'),
    );
    assert.deepEqual(funn, []);
  },
);

test(
  'pekerfølsomt innhold: finner innhold som forsvinner og ikke lukkes med Esc',
  { skip: hopp },
  async (t) => {
    const page = await nySide(t, tooltipSkript(false));
    const funn = await analyserPekerfølsomtInnhold(
      page,
      page.locator('#utloser'),
    );
    assert.equal(funn.length, 3, funn.join('\n'));
    assert.match(funn[0], /forsvinner når pekeren flyttes/);
    assert.match(funn[1], /vises ved hover, lukkes ikke med Esc/);
    assert.match(funn[2], /vises ved fokus, lukkes ikke med Esc/);
  },
);

test(
  'skjemafeil: koblet feilmelding og oppsummering gir ingen funn',
  { skip: hopp },
  async (t) => {
    const page = await nySide(
      t,
      `<form onsubmit="event.preventDefault();
          const f = document.getElementById('navn');
          f.setAttribute('aria-invalid', 'true');
          f.setAttribute('aria-describedby', 'navn-feil');
          document.getElementById('navn-feil').hidden = false;
          const o = document.getElementById('oppsummering');
          o.hidden = false; o.focus();">
         <label for="navn">Navn</label><input id="navn">
         <p id="navn-feil" hidden>Du må fylle ut navn</p>
         <div id="oppsummering" class="aksel-error-summary" tabindex="-1" hidden>
           <a href="#navn">Du må fylle ut navn</a>
         </div>
         <button id="send">Send</button>
       </form>`,
    );
    const funn = await analyserSkjemafeil(page, page.locator('#send'), {
      forventFokus: true,
    });
    assert.deepEqual(funn, []);
  },
);

test(
  'skjemafeil: finner frakoblet feilmelding, død lenke og manglende fokus',
  { skip: hopp },
  async (t) => {
    const page = await nySide(
      t,
      `<form onsubmit="event.preventDefault();
          document.getElementById('navn').setAttribute('aria-invalid', 'true');
          document.getElementById('navn-feil').hidden = false;
          document.getElementById('oppsummering').hidden = false;">
         <label for="navn">Navn</label><input id="navn">
         <p id="navn-feil" hidden>Du må fylle ut navn</p>
         <div id="oppsummering" class="aksel-error-summary" hidden>
           <a href="#finnes-ikke">Du må fylle ut navn</a>
         </div>
         <button id="send">Send</button>
       </form>`,
    );
    const funn = await analyserSkjemafeil(page, page.locator('#send'), {
      forventFokus: true,
    });
    assert.equal(funn.length, 3, funn.join('\n'));
    assert.match(funn[0], /input#navn .*ingen synlig feilmelding/);
    assert.match(
      funn[1],
      /peker på et element som ikke finnes \(#finnes-ikke\)/,
    );
    assert.match(funn[2], /Fokus flyttes ikke til feiloppsummeringen/);
  },
);

test(
  'skjemafeil: finner skjema uten markering av feil',
  { skip: hopp },
  async (t) => {
    const page = await nySide(
      t,
      `<form onsubmit="event.preventDefault()"><label for="n">Navn</label><input id="n"><button id="send">Send</button></form>`,
    );
    const funn = await analyserSkjemafeil(page, page.locator('#send'));
    assert.equal(funn.length, 1, funn.join('\n'));
    assert.match(funn[0], /ingen felt er markert med aria-invalid/);
  },
);

test.after(() => nettleser?.close());
