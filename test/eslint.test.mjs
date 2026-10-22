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
  ],
  invalid: [
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
