import { PineSyntaxError, tokenize, type Token } from './lexer';

/**
 * The AST for the Pine subset.
 *
 * A tree, walked by the evaluator. Never compiled, never stringified into
 * JavaScript, never handed to `Function`. That is the whole architectural point
 * of writing a parser rather than sandboxing an eval.
 *
 * Import-free beyond the lexer, so the harness compiles it alone.
 */

export type Expression =
  | { type: 'number'; value: number; line: number }
  | { type: 'string'; value: string; line: number }
  | { type: 'identifier'; name: string; line: number }
  | { type: 'unary'; operator: string; operand: Expression; line: number }
  | { type: 'binary'; operator: string; left: Expression; right: Expression; line: number }
  | { type: 'ternary'; test: Expression; whenTrue: Expression; whenFalse: Expression; line: number }
  | { type: 'call'; callee: string; args: Argument[]; line: number }
  | { type: 'history'; series: Expression; offset: Expression; line: number };

/** Pine allows both positional and `name = value` arguments in one call. */
export type Argument = { name: string | null; value: Expression };

export type Statement =
  | { type: 'assignment'; name: string; value: Expression; line: number }
  | { type: 'expression'; value: Expression; line: number };

export type Program = { statements: Statement[] };

/*
 * Binding power, loosest first. Pine's precedence follows the usual arithmetic
 * order; `and` binds tighter than `or`, and comparisons sit between them and
 * arithmetic.
 */
const PRECEDENCE: Record<string, number> = {
  or: 1,
  and: 2,
  '==': 3,
  '!=': 3,
  '<': 4,
  '<=': 4,
  '>': 4,
  '>=': 4,
  '+': 5,
  '-': 5,
  '*': 6,
  '/': 6,
  '%': 6,
};

class Parser {
  private tokens: Token[];
  private position = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(offset = 0): Token {
    return this.tokens[Math.min(this.position + offset, this.tokens.length - 1)];
  }

  private next(): Token {
    const token = this.peek();
    if (token.kind !== 'eof') this.position += 1;
    return token;
  }

  private at(kind: Token['kind'], value?: string): boolean {
    const token = this.peek();
    return token.kind === kind && (value === undefined || token.value === value);
  }

  private expect(kind: Token['kind'], value: string): Token {
    if (!this.at(kind, value)) {
      const token = this.peek();
      throw new PineSyntaxError(
        `Expected "${value}" but found ${token.value ? `"${token.value}"` : 'the end of the script'}.`,
        token.line
      );
    }
    return this.next();
  }

  private skipNewlines(): void {
    while (this.at('newline')) this.next();
  }

  parseProgram(): Program {
    const statements: Statement[] = [];
    this.skipNewlines();

    while (!this.at('eof')) {
      statements.push(this.parseStatement());
      this.skipNewlines();
    }

    return { statements };
  }

  private parseStatement(): Statement {
    const token = this.peek();

    /*
     * An assignment is an identifier followed by `=` — but only `=`. `:=`
     * reassigns across bars, which this evaluator computes as whole series and
     * therefore cannot express; it is refused by name in the validator rather
     * than parsed into something that would be evaluated wrongly.
     */
    if (
      token.kind === 'identifier' &&
      this.peek(1).kind === 'operator' &&
      (this.peek(1).value === '=' || this.peek(1).value === ':=')
    ) {
      const name = this.next().value;
      const operator = this.next().value;
      const value = this.parseExpression();

      if (operator === ':=') {
        throw new PineSyntaxError(
          '":=" reassigns a value bar by bar. This preview computes whole series at once and cannot express that, so the script has to be exported to run it.',
          token.line
        );
      }

      return { type: 'assignment', name, value, line: token.line };
    }

    return { type: 'expression', value: this.parseExpression(), line: token.line };
  }

  parseExpression(): Expression {
    return this.parseTernary();
  }

  private parseTernary(): Expression {
    const test = this.parseBinary(0);

    if (this.at('operator', '?')) {
      const line = this.next().line;
      const whenTrue = this.parseTernary();
      this.expect('operator', ':');
      const whenFalse = this.parseTernary();
      return { type: 'ternary', test, whenTrue, whenFalse, line };
    }

    return test;
  }

  private parseBinary(minimum: number): Expression {
    let left = this.parseUnary();

    for (;;) {
      const token = this.peek();
      if (token.kind !== 'operator') break;

      const precedence = PRECEDENCE[token.value];
      if (precedence === undefined || precedence < minimum) break;

      this.next();
      // Left-associative: the right side binds one level tighter, so `a - b - c`
      // groups as `(a - b) - c` rather than `a - (b - c)`.
      const right = this.parseBinary(precedence + 1);
      left = { type: 'binary', operator: token.value, left, right, line: token.line };
    }

    return left;
  }

  private parseUnary(): Expression {
    const token = this.peek();

    if (token.kind === 'operator' && (token.value === '-' || token.value === '+' || token.value === 'not')) {
      this.next();
      return { type: 'unary', operator: token.value, operand: this.parseUnary(), line: token.line };
    }

    return this.parsePostfix();
  }

  private parsePostfix(): Expression {
    let expression = this.parsePrimary();

    // `close[1]` is the previous bar's close. Chained access is legal and means
    // what it looks like.
    while (this.at('punct', '[')) {
      const line = this.next().line;
      const offset = this.parseExpression();
      this.expect('punct', ']');
      expression = { type: 'history', series: expression, offset, line };
    }

    return expression;
  }

  private parsePrimary(): Expression {
    const token = this.next();

    if (token.kind === 'number') {
      return { type: 'number', value: Number(token.value), line: token.line };
    }

    if (token.kind === 'string') {
      return { type: 'string', value: token.value, line: token.line };
    }

    if (token.kind === 'punct' && token.value === '(') {
      // Newlines inside brackets are continuations, which is how a long call
      // gets wrapped across lines.
      this.skipNewlines();
      const inner = this.parseExpression();
      this.skipNewlines();
      this.expect('punct', ')');
      return inner;
    }

    if (token.kind === 'identifier') {
      if (this.at('punct', '(')) {
        this.next();
        const args = this.parseArguments();
        return { type: 'call', callee: token.value, args, line: token.line };
      }
      return { type: 'identifier', name: token.value, line: token.line };
    }

    throw new PineSyntaxError(
      token.kind === 'eof'
        ? 'The script ends in the middle of an expression.'
        : `"${token.value}" cannot start an expression.`,
      token.line
    );
  }

  private parseArguments(): Argument[] {
    const args: Argument[] = [];
    this.skipNewlines();

    if (this.at('punct', ')')) {
      this.next();
      return args;
    }

    for (;;) {
      this.skipNewlines();

      let name: string | null = null;
      if (
        this.peek().kind === 'identifier' &&
        this.peek(1).kind === 'operator' &&
        this.peek(1).value === '='
      ) {
        name = this.next().value;
        this.next();
      }

      args.push({ name, value: this.parseExpression() });
      this.skipNewlines();

      if (this.at('punct', ',')) {
        this.next();
        continue;
      }

      this.expect('punct', ')');
      break;
    }

    return args;
  }
}

export function parse(source: string): Program {
  return new Parser(tokenize(source)).parseProgram();
}

export { PineSyntaxError };
