import test from 'node:test';
import { RuleTester } from 'eslint';
import plugin, {
  anbefalt,
  ingenHandlingVedPekerned,
} from '../dist/eslint/index.js';
import assert from 'node:assert/strict';

RuleTester.describe = test.describe ?? ((_, fn) => fn());
RuleTester.it = (navn, fn) => test(navn, fn);

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

test('anbefalt registrerer regelen som warn', () => {
  assert.equal(anbefalt.plugins['toi-a11y'], plugin);
  assert.deepEqual(anbefalt.rules, {
    'toi-a11y/ingen-handling-ved-pekerned': 'warn',
  });
});

tester.run('ingen-handling-ved-pekerned', ingenHandlingVedPekerned, {
  valid: [
    '<button onClick={lagre}>Lagre</button>',
    '<button onMouseDown={(e) => e.preventDefault()} onClick={lagre}>Lagre</button>',
    '<button onPointerDown={function (e) { e.preventDefault(); e.stopPropagation(); }}>Lagre</button>',
    '<div onPointerDown={startDra} onPointerMove={dra} onPointerUp={slipp} />',
    '<div onMouseDown={startDra} onMouseUp={slipp} />',
    "element.addEventListener('click', lagre)",
    "element.addEventListener('mousedown', (e) => e.preventDefault())",
    '<button onTouchStart={lagre}>Lagre</button>',
    // Navngitte handlere som bare stopper hendelsen (Åpnelenke, StillingsKort)
    `const Kort = () => {
      const stopAllPropagation = (e) => { e.stopPropagation(); };
      return <a onMouseDown={stopAllPropagation} onPointerDown={stopAllPropagation}>Åpne</a>;
    };`,
    `function stopp(e) { e.preventDefault(); }
    const Knapp = () => <button onMouseDown={stopp}>Lagre</button>;`,
    `const stopp = useCallback((e) => e.stopImmediatePropagation(), []);
    const Knapp = () => <button onPointerDown={stopp}>Lagre</button>;`,
    // Importert: navnet sier tydelig hva den gjør
    `import { stopAllPropagation } from './hendelser';
    const Knapp = () => <button onPointerDown={stopAllPropagation}>Lagre</button>;`,
    '<button onMouseDown={hendelser.preventDefault}>Lagre</button>',
    '<button onPointerDown={(e) => e?.stopPropagation()}>Lagre</button>',
    // Fanger pekerned for å stoppe den på rullefeltet (Vurderingsnotatvelger)
    `useEffect(() => {
      const håndterPointerDownCapture = (event) => {
        const el = contentRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const erInni = event.clientX >= rect.left && event.clientX <= rect.right;
        if (erInni) {
          klikkerInniRef.current = true;
          setTimeout(() => { klikkerInniRef.current = false; }, 150);
          const erRtl = getComputedStyle(el).direction === 'rtl';
          const påRullefelt = erRtl ? event.clientX <= rect.left : event.clientX >= rect.left + el.clientWidth;
          if (påRullefelt) {
            event.stopPropagation();
          }
        }
      };
      document.addEventListener('pointerdown', håndterPointerDownCapture, true);
    }, []);`,
  ],
  invalid: [
    // Klikk utenfor lukker filteret (StillingsSøkFilter)
    {
      code: `useEffect(() => {
        const handleClickOutside = (event) => {
          if (searchRef.current && !searchRef.current.contains(event.target)) {
            setShowStandardsøk(false);
          }
        };
        document.addEventListener('mousedown', handleClickOutside);
      }, []);`,
      errors: [
        {
          messageId: 'nedHendelse',
          data: { hendelse: "addEventListener('mousedown')" },
        },
      ],
    },
    {
      code: `const stopAllPropagation = (e) => { e.stopPropagation(); lukk(); };
      const Knapp = () => <button onMouseDown={stopAllPropagation}>Lukk</button>;`,
      errors: [{ messageId: 'nedHendelse' }],
    },
    {
      code: `const velg = (e) => { e.preventDefault(); };
      let handler = velg;
      handler = lagre;
      const Knapp = () => <button onMouseDown={handler}>Lagre</button>;`,
      errors: [{ messageId: 'nedHendelse' }],
    },
    {
      code: `const Knapp = () => <button onMouseDown={(e) => { if (e.button === 0) { valgtRef.current = velg(id); } }}>Lagre</button>;`,
      errors: [{ messageId: 'nedHendelse' }],
    },
    {
      code: `const Knapp = () => <button onMouseDown={(e) => { setTimeout(() => lagre(), 0); }}>Lagre</button>;`,
      errors: [{ messageId: 'nedHendelse' }],
    },
    {
      code: '<button onMouseDown={lagre}>Lagre</button>',
      errors: [{ messageId: 'nedHendelse', data: { hendelse: 'onMouseDown' } }],
    },
    {
      code: '<li onPointerDown={() => velg(id)}>Valg</li>',
      errors: [
        { messageId: 'nedHendelse', data: { hendelse: 'onPointerDown' } },
      ],
    },
    {
      code: '<li onMouseDown={(e) => { e.preventDefault(); velg(id); }}>Valg</li>',
      errors: [{ messageId: 'nedHendelse' }],
    },
    {
      code: "knapp.addEventListener('pointerdown', slett)",
      errors: [
        {
          messageId: 'nedHendelse',
          data: { hendelse: "addEventListener('pointerdown')" },
        },
      ],
    },
    {
      code: '<button onTouchStart={lagre}>Lagre</button>',
      options: [
        { hendelser: ['onMouseDown', 'onPointerDown', 'onTouchStart'] },
      ],
      errors: [
        { messageId: 'nedHendelse', data: { hendelse: 'onTouchStart' } },
      ],
    },
  ],
});
