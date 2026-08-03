/**
 * Tokens for the Pine subset this workspace previews.
 *
 * Written rather than borrowed, and deliberately: the constraint on this
 * project is that no AI-produced text is ever executed, which rules out `eval`,
 * `new Function`, and every sandbox that works by running the code. So a script
 * is read into an AST and walked. Nothing here ever becomes JavaScript.
 *
 * Import-free, so the harness compiles it alone.
 */

export type TokenKind =
  | 'number'
  | 'string'
  | 'identifier'
  | 'operator'
  | 'punct'
  | 'newline'
  | 'eof';

export type Token = {
  kind: TokenKind;
  value: string;
  /** 1-based, so it lines up with what the editor's gutter shows. */
  line: number;
  column: number;
};

export class PineSyntaxError extends Error {
  readonly line: number;

  constructor(message: string, line: number) {
    super(message);
    this.name = 'PineSyntaxError';
    this.line = line;
  }
}

/*
 * Longest first. `>=` has to be matched before `>`, or every comparison
 * silently becomes a greater-than followed by an equals.
 */
const OPERATORS = [
  '==',
  '!=',
  '<=',
  '>=',
  ':=',
  'and',
  'or',
  'not',
  '+',
  '-',
  '*',
  '/',
  '%',
  '<',
  '>',
  '=',
  '?',
  ':',
];

const PUNCTUATION = ['(', ')', '[', ']', ','];

function isDigit(character: string): boolean {
  return character >= '0' && character <= '9';
}

function isIdentifierStart(character: string): boolean {
  return /[A-Za-z_]/.test(character);
}

function isIdentifierPart(character: string): boolean {
  // Dots are part of the name: `ta.sma` is one identifier, not a member access.
  // Pine has no user-defined objects in this subset, so there is nothing a dot
  // could mean other than a namespace.
  return /[A-Za-z0-9_.]/.test(character);
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  let line = 1;
  let column = 1;

  const push = (kind: TokenKind, value: string, atColumn = column) => {
    tokens.push({ kind, value, line, column: atColumn });
  };

  while (index < source.length) {
    const character = source[index];

    /* --------------------------------------------------------- Newlines */

    if (character === '\n') {
      push('newline', '\n');
      index += 1;
      line += 1;
      column = 1;
      continue;
    }

    if (character === '\r') {
      index += 1;
      continue;
    }

    if (character === ' ' || character === '\t') {
      index += 1;
      column += 1;
      continue;
    }

    /* --------------------------------------------------------- Comments */

    if (character === '/' && source[index + 1] === '/') {
      while (index < source.length && source[index] !== '\n') index += 1;
      continue;
    }

    /* ---------------------------------------------------------- Strings */

    if (character === '"' || character === "'") {
      const quote = character;
      const startColumn = column;
      let value = '';

      index += 1;
      column += 1;

      while (index < source.length && source[index] !== quote) {
        if (source[index] === '\n') {
          throw new PineSyntaxError('A string is left open at the end of the line.', line);
        }
        // Escapes are passed through as written. The value is never executed and
        // never interpolated, so the only consumer is `plot`'s title.
        if (source[index] === '\\' && index + 1 < source.length) {
          value += source[index + 1];
          index += 2;
          column += 2;
          continue;
        }
        value += source[index];
        index += 1;
        column += 1;
      }

      if (index >= source.length) {
        throw new PineSyntaxError('A string is left open at the end of the script.', line);
      }

      index += 1;
      column += 1;
      push('string', value, startColumn);
      continue;
    }

    /* ---------------------------------------------------------- Numbers */

    if (isDigit(character) || (character === '.' && isDigit(source[index + 1] ?? ''))) {
      const startColumn = column;
      let value = '';

      while (index < source.length && (isDigit(source[index]) || source[index] === '.')) {
        value += source[index];
        index += 1;
        column += 1;
      }

      if ((value.match(/\./g) ?? []).length > 1) {
        throw new PineSyntaxError(`"${value}" is not a number.`, line);
      }

      push('number', value, startColumn);
      continue;
    }

    /* ------------------------------------------------------ Identifiers */

    if (isIdentifierStart(character)) {
      const startColumn = column;
      let value = '';

      while (index < source.length && isIdentifierPart(source[index])) {
        value += source[index];
        index += 1;
        column += 1;
      }

      // `and`, `or` and `not` are words that behave as operators.
      push(OPERATORS.includes(value) ? 'operator' : 'identifier', value, startColumn);
      continue;
    }

    /* -------------------------------------------------------- Operators */

    const operator = OPERATORS.find(
      (candidate) => !/[a-z]/.test(candidate) && source.startsWith(candidate, index)
    );

    if (operator) {
      push('operator', operator);
      index += operator.length;
      column += operator.length;
      continue;
    }

    if (PUNCTUATION.includes(character)) {
      push('punct', character);
      index += 1;
      column += 1;
      continue;
    }

    throw new PineSyntaxError(`"${character}" is not something this preview understands.`, line);
  }

  tokens.push({ kind: 'eof', value: '', line, column });
  return tokens;
}
