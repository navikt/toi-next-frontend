import type { Rule } from 'eslint';

/** Hendelser som utløses når pekeren trykkes ned, før brukeren kan angre ved å flytte den bort. */
export const NED_HENDELSER = ['onMouseDown', 'onPointerDown'] as const;

/** Hendelser som tyder på at handlingen fullføres når pekeren slippes (dra og slipp, tegning). */
const OPP_ELLER_DRA = new Set([
  'onMouseUp',
  'onPointerUp',
  'onTouchEnd',
  'onMouseMove',
  'onPointerMove',
  'onTouchMove',
]);

/** Kall som bare hindrer standardoppførsel, for eksempel at fokus flyttes. */
const UFARLIGE_KALL = new Set([
  'preventDefault',
  'stopPropagation',
  'stopImmediatePropagation',
]);

// JSX-noder finnes ikke i ESTree-typene, så nodene typesjekkes løst.
type Node = { type: string; [felt: string]: any };

/** Kall som bare leser fra DOM-en og ikke endrer noe. */
const LESENDE_KALL = new Set([
  'getBoundingClientRect',
  'getComputedStyle',
  'getClientRects',
  'contains',
  'closest',
  'matches',
  'getAttribute',
  'hasAttribute',
  'composedPath',
]);

/** Navn som tydelig betyr at funksjonen bare stopper hendelsen, f.eks. `stopAllPropagation`. */
const UFARLIG_NAVN = /^(stop|prevent)\w*(propagation|default)$/i;

const kallnavn = (kall: Node): string | undefined => {
  const callee = kall.callee as Node;
  if (callee.type === 'Identifier') return callee.name;
  if (
    callee.type === 'MemberExpression' &&
    callee.property.type === 'Identifier'
  )
    return callee.property.name;
  return undefined;
};

/** true hvis alle kall i uttrykket bare leser fra DOM-en. */
const erLesende = (uttrykk: Node | null | undefined): boolean => {
  if (!uttrykk || typeof uttrykk !== 'object') return true;
  if (
    uttrykk.type === 'ArrowFunctionExpression' ||
    uttrykk.type === 'FunctionExpression'
  ) {
    return false;
  }
  if (uttrykk.type === 'CallExpression') {
    const navn = kallnavn(uttrykk);
    if (!navn || !LESENDE_KALL.has(navn)) return false;
  }
  return Object.entries(uttrykk).every(([nøkkel, verdi]) => {
    if (nøkkel === 'parent' || !verdi || typeof verdi !== 'object') return true;
    if (Array.isArray(verdi))
      return verdi.every((v) => !v?.type || erLesende(v));
    return !verdi.type || erLesende(verdi);
  });
};

type Kontekst = { løs: (navn: Node) => Node | null };

const erUfarligKall = (uttrykk: Node, k: Kontekst): boolean => {
  if (uttrykk.type === 'ChainExpression')
    return erUfarligKall(uttrykk.expression, k);
  if (uttrykk.type !== 'CallExpression') return false;
  const navn = kallnavn(uttrykk);
  if (!navn) return false;
  if (uttrykk.callee.type === 'MemberExpression' && UFARLIGE_KALL.has(navn)) {
    return true;
  }
  // `setTimeout(() => { ref.current = false })`
  if (navn === 'setTimeout' || navn === 'clearTimeout') {
    const [tilbakekall, ...resten] = uttrykk.arguments as Node[];
    return (
      resten.every((a) => erLesende(a)) &&
      (navn === 'clearTimeout'
        ? erLesende(tilbakekall)
        : erUfarligFunksjon(tilbakekall, k))
    );
  }
  return false;
};

/** `ref.current = …` endrer ikke det brukeren ser. */
const erRefTilordning = (uttrykk: Node) =>
  uttrykk.type === 'AssignmentExpression' &&
  uttrykk.left.type === 'MemberExpression' &&
  uttrykk.left.property.type === 'Identifier' &&
  uttrykk.left.property.name === 'current' &&
  erLesende(uttrykk.right);

const erUfarligSetning = (setning: Node, k: Kontekst): boolean => {
  switch (setning.type) {
    case 'EmptyStatement':
      return true;
    case 'ExpressionStatement':
      return (
        erUfarligKall(setning.expression, k) ||
        erRefTilordning(setning.expression)
      );
    case 'BlockStatement':
      return (setning.body as Node[]).every((s) => erUfarligSetning(s, k));
    case 'IfStatement':
      return (
        erLesende(setning.test) &&
        erUfarligSetning(setning.consequent, k) &&
        (!setning.alternate || erUfarligSetning(setning.alternate, k))
      );
    case 'ReturnStatement':
      return !setning.argument || erLesende(setning.argument);
    case 'VariableDeclaration':
      return (setning.declarations as Node[]).every((d) => erLesende(d.init));
    default:
      return false;
  }
};

/**
 * true hvis funksjonen bare stopper hendelsen (`preventDefault`/`stopPropagation`),
 * eventuelt etter å ha lest fra DOM-en og satt `ref.current`. Slike handlere
 * hindrer fokustap eller at klikket når en forelder, og utfører ingen handling.
 */
const erUfarligFunksjon = (
  handler: Node | null | undefined,
  k: Kontekst,
  dybde = 0,
): boolean => {
  if (!handler || dybde > 3) return false;
  if (handler.type === 'Identifier') {
    const definisjon = k.løs(handler);
    if (definisjon) return erUfarligFunksjon(definisjon, k, dybde + 1);
    return UFARLIG_NAVN.test(handler.name);
  }
  if (
    handler.type === 'MemberExpression' &&
    handler.property.type === 'Identifier'
  ) {
    return UFARLIG_NAVN.test(handler.property.name);
  }
  // useCallback((e) => e.stopPropagation(), [])
  if (
    handler.type === 'CallExpression' &&
    kallnavn(handler) === 'useCallback'
  ) {
    return erUfarligFunksjon(handler.arguments[0], k, dybde + 1);
  }
  if (
    handler.type !== 'ArrowFunctionExpression' &&
    handler.type !== 'FunctionExpression' &&
    handler.type !== 'FunctionDeclaration'
  ) {
    return false;
  }
  const kropp = handler.body as Node;
  if (kropp.type !== 'BlockStatement') return erUfarligKall(kropp, k);
  return erUfarligSetning(kropp, k);
};

const tilDomHendelse = (prop: string) => prop.replace(/^on/, '').toLowerCase();

/**
 * WCAG 2.5.2 Pekeravbrytelse: handlinger skal skje når pekeren slippes (`onClick`),
 * ikke når den trykkes ned. Da kan brukeren angre ved å flytte pekeren bort før
 * den slippes. Rapporterer `onMouseDown`/`onPointerDown` i JSX og
 * `addEventListener('mousedown' | 'pointerdown')`.
 *
 * Godtas: handlere som bare kaller `preventDefault()`/`stopPropagation()`/
 * `stopImmediatePropagation()` (for å hindre fokustap eller at klikket når en
 * forelder), også når de i tillegg bare leser fra DOM-en og setter `ref.current`.
 * Navngitte handlere slås opp i filen. Importerte handlere godtas hvis navnet
 * tydelig sier det samme, som `stopAllPropagation`. Elementer som også lytter på
 * opp- eller flytt-hendelser (dra og slipp) godtas også.
 */
export const ingenHandlingVedPekerned: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Unngå handlinger på onMouseDown/onPointerDown (WCAG 2.5.2 Pekeravbrytelse)',
      url: 'https://www.w3.org/WAI/WCAG21/Understanding/pointer-cancellation.html',
    },
    messages: {
      nedHendelse:
        'WCAG 2.5.2: {{hendelse}} utløser handlingen før pekeren slippes. Bruk onClick, eller fullfør handlingen på opp-hendelsen slik at brukeren kan angre ved å flytte pekeren bort.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          hendelser: {
            type: 'array',
            items: { type: 'string', pattern: '^on[A-Z]' },
            uniqueItems: true,
          },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const hendelser = new Set<string>(
      context.options[0]?.hendelser ?? NED_HENDELSER,
    );
    const domHendelser = new Map(
      [...hendelser].map((h) => [tilDomHendelse(h), h]),
    );
    const sourceCode = context.sourceCode;
    let gjeldende: Node | null = null;
    const k: Kontekst = {
      løs(navn) {
        if (!gjeldende) return null;
        for (
          let scope: any = sourceCode.getScope(gjeldende as Rule.Node);
          scope;
          scope = scope.upper
        ) {
          const variabel = scope.set.get(navn.name);
          if (!variabel) continue;
          const def = variabel.defs[0];
          if (def?.type === 'FunctionName') return def.node as Node;
          if (def?.type === 'Variable' && def.parent?.kind === 'const')
            return (def.node.init as Node) ?? null;
          return null;
        }
        return null;
      },
    };
    const erUfarlig = (node: Node, handler: Node | null | undefined) => {
      gjeldende = node;
      return erUfarligFunksjon(handler, k);
    };

    return {
      JSXAttribute(node: Node) {
        const navn =
          node.name?.type === 'JSXIdentifier' ? node.name.name : undefined;
        if (!navn || !hendelser.has(navn)) return;
        const andre = (node.parent?.attributes ?? []) as Node[];
        if (
          andre.some(
            (a) =>
              a.type === 'JSXAttribute' &&
              a.name?.type === 'JSXIdentifier' &&
              OPP_ELLER_DRA.has(a.name.name),
          )
        ) {
          return;
        }
        const verdi =
          node.value?.type === 'JSXExpressionContainer'
            ? node.value.expression
            : null;
        if (erUfarlig(node, verdi)) return;
        context.report({
          node: node as Rule.Node,
          messageId: 'nedHendelse',
          data: { hendelse: navn },
        });
      },
      CallExpression(node: Node) {
        const kalt = node.callee;
        if (
          kalt.type !== 'MemberExpression' ||
          kalt.property.type !== 'Identifier' ||
          kalt.property.name !== 'addEventListener'
        ) {
          return;
        }
        const [type, handler] = node.arguments as Node[];
        if (type?.type !== 'Literal' || typeof type.value !== 'string') return;
        const hendelse = domHendelser.get(type.value);
        if (!hendelse || erUfarlig(node, handler)) return;
        context.report({
          node: node as Rule.Node,
          messageId: 'nedHendelse',
          data: { hendelse: `addEventListener('${type.value}')` },
        });
      },
    } as Rule.RuleListener;
  },
};
