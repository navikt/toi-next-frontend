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

const erUfarligKall = (uttrykk: Node | null | undefined): boolean => {
  if (!uttrykk) return true;
  if (uttrykk.type === 'ChainExpression')
    return erUfarligKall(uttrykk.expression);
  return (
    uttrykk.type === 'CallExpression' &&
    uttrykk.callee.type === 'MemberExpression' &&
    uttrykk.callee.property.type === 'Identifier' &&
    UFARLIGE_KALL.has(uttrykk.callee.property.name)
  );
};

/** true hvis funksjonen bare kaller preventDefault/stopPropagation, eller ikke gjør noe. */
const erUfarligHandler = (handler: Node | null | undefined): boolean => {
  if (
    !handler ||
    (handler.type !== 'ArrowFunctionExpression' &&
      handler.type !== 'FunctionExpression')
  ) {
    return false;
  }
  const kropp = handler.body as Node;
  if (kropp.type !== 'BlockStatement') return erUfarligKall(kropp);
  return (kropp.body as Node[]).every(
    (setning) =>
      setning.type === 'ExpressionStatement' &&
      erUfarligKall(setning.expression),
  );
};

const tilDomHendelse = (prop: string) => prop.replace(/^on/, '').toLowerCase();

/**
 * WCAG 2.5.2 Pekeravbrytelse: handlinger skal skje når pekeren slippes (`onClick`),
 * ikke når den trykkes ned. Da kan brukeren angre ved å flytte pekeren bort før
 * den slippes. Rapporterer `onMouseDown`/`onPointerDown` i JSX og
 * `addEventListener('mousedown' | 'pointerdown')`.
 *
 * Godtas: handlere som bare kaller `preventDefault()`/`stopPropagation()` (for å
 * hindre fokustap), og elementer som også lytter på opp- eller flytt-hendelser
 * (dra og slipp, der handlingen fullføres når pekeren slippes).
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
        if (erUfarligHandler(verdi)) return;
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
        if (!hendelse || erUfarligHandler(handler)) return;
        context.report({
          node: node as Rule.Node,
          messageId: 'nedHendelse',
          data: { hendelse: `addEventListener('${type.value}')` },
        });
      },
    } as Rule.RuleListener;
  },
};
