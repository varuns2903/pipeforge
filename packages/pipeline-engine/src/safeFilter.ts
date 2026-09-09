// Safe evaluator for filter-node conditions like `row.age >= 18 AND row.country = 'US'`.
// Deliberately avoids eval()/new Function() since conditions are user-supplied and run
// server-side in the worker process.

type TokenType =
  | 'ident' | 'number' | 'string' | 'bool' | 'null'
  | 'and' | 'or' | 'not'
  | 'op' | 'lparen' | 'rparen' | 'dot' | 'eof';

interface Token {
  type: TokenType;
  value: string;
}

const OPERATORS = ['===', '!==', '>=', '<=', '==', '!=', '>', '<', '='];

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i]!;

    if (/\s/.test(ch)) { i++; continue; }

    if (ch === '(') { tokens.push({ type: 'lparen', value: ch }); i++; continue; }
    if (ch === ')') { tokens.push({ type: 'rparen', value: ch }); i++; continue; }
    if (ch === '.') { tokens.push({ type: 'dot', value: ch }); i++; continue; }

    if (ch === "'" || ch === '"') {
      const quote = ch;
      let j = i + 1;
      let str = '';
      while (j < input.length && input[j] !== quote) {
        str += input[j];
        j++;
      }
      if (j >= input.length) throw new Error('Unterminated string literal in condition');
      tokens.push({ type: 'string', value: str });
      i = j + 1;
      continue;
    }

    if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < input.length && /[0-9.]/.test(input[j]!)) j++;
      tokens.push({ type: 'number', value: input.slice(i, j) });
      i = j;
      continue;
    }

    const rest = input.slice(i);
    const matchedOp = OPERATORS.find(op => rest.startsWith(op));
    if (matchedOp) {
      tokens.push({ type: 'op', value: matchedOp });
      i += matchedOp.length;
      continue;
    }

    if (ch === '&' && input[i + 1] === '&') { tokens.push({ type: 'and', value: '&&' }); i += 2; continue; }
    if (ch === '|' && input[i + 1] === '|') { tokens.push({ type: 'or', value: '||' }); i += 2; continue; }
    if (ch === '!') { tokens.push({ type: 'not', value: '!' }); i += 1; continue; }

    if (/[A-Za-z_$]/.test(ch)) {
      let j = i;
      while (j < input.length && /[A-Za-z0-9_$]/.test(input[j]!)) j++;
      const word = input.slice(i, j);
      const lower = word.toLowerCase();
      if (lower === 'and') tokens.push({ type: 'and', value: '&&' });
      else if (lower === 'or') tokens.push({ type: 'or', value: '||' });
      else if (lower === 'not') tokens.push({ type: 'not', value: '!' });
      else if (lower === 'true' || lower === 'false') tokens.push({ type: 'bool', value: lower });
      else if (lower === 'null') tokens.push({ type: 'null', value: 'null' });
      else tokens.push({ type: 'ident', value: word });
      i = j;
      continue;
    }

    throw new Error(`Unexpected character in condition: ${ch}`);
  }

  tokens.push({ type: 'eof', value: '' });
  return tokens;
}

type Node =
  | { kind: 'or'; left: Node; right: Node }
  | { kind: 'and'; left: Node; right: Node }
  | { kind: 'not'; expr: Node }
  | { kind: 'compare'; op: string; left: Node; right: Node }
  | { kind: 'field'; name: string }
  | { kind: 'literal'; value: string | number | boolean | null };

class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  private peek(): Token { return this.tokens[this.pos]!; }
  private next(): Token { return this.tokens[this.pos++]!; }

  private expect(type: TokenType): Token {
    const t = this.next();
    if (t.type !== type) throw new Error(`Invalid filter condition: expected ${type}, got "${t.value}"`);
    return t;
  }

  parse(): Node {
    const node = this.parseOr();
    this.expect('eof');
    return node;
  }

  private parseOr(): Node {
    let left = this.parseAnd();
    while (this.peek().type === 'or') {
      this.next();
      const right = this.parseAnd();
      left = { kind: 'or', left, right };
    }
    return left;
  }

  private parseAnd(): Node {
    let left = this.parseNot();
    while (this.peek().type === 'and') {
      this.next();
      const right = this.parseNot();
      left = { kind: 'and', left, right };
    }
    return left;
  }

  private parseNot(): Node {
    if (this.peek().type === 'not') {
      this.next();
      return { kind: 'not', expr: this.parseNot() };
    }
    return this.parseComparison();
  }

  private parseComparison(): Node {
    const left = this.parseOperand();
    if (this.peek().type === 'op') {
      const op = this.next().value;
      const right = this.parseOperand();
      return { kind: 'compare', op, left, right };
    }
    return left;
  }

  private parseOperand(): Node {
    const t = this.peek();

    if (t.type === 'lparen') {
      this.next();
      const inner = this.parseOr();
      this.expect('rparen');
      return inner;
    }

    if (t.type === 'number') {
      this.next();
      return { kind: 'literal', value: Number(t.value) };
    }

    if (t.type === 'string') {
      this.next();
      return { kind: 'literal', value: t.value };
    }

    if (t.type === 'bool') {
      this.next();
      return { kind: 'literal', value: t.value === 'true' };
    }

    if (t.type === 'null') {
      this.next();
      return { kind: 'literal', value: null };
    }

    if (t.type === 'ident') {
      this.next();
      let name = t.value;
      while (this.peek().type === 'dot') {
        this.next();
        const prop = this.expect('ident');
        name += `.${prop.value}`;
      }
      return { kind: 'field', name };
    }

    throw new Error(`Invalid filter condition near "${t.value}"`);
  }
}

function resolveField(row: any, path: string): any {
  const parts = path.split('.');
  // Allow both `row.age` (from the UI's documented syntax) and bare `age`.
  const start = parts[0] === 'row' ? 1 : 0;
  let value = row;
  for (let i = start; i < parts.length; i++) {
    if (value == null) return undefined;
    value = value[parts[i]!];
  }
  return value;
}

function evaluate(node: Node, row: any): any {
  switch (node.kind) {
    case 'literal': return node.value;
    case 'field': return resolveField(row, node.name);
    case 'not': return !evaluate(node.expr, row);
    case 'and': return evaluate(node.left, row) && evaluate(node.right, row);
    case 'or': return evaluate(node.left, row) || evaluate(node.right, row);
    case 'compare': {
      const left = evaluate(node.left, row);
      const right = evaluate(node.right, row);
      switch (node.op) {
        case '=':
        case '==': return left == right;
        case '===': return left === right;
        case '!=': return left != right;
        case '!==': return left !== right;
        case '>': return left > right;
        case '<': return left < right;
        case '>=': return left >= right;
        case '<=': return left <= right;
        default: throw new Error(`Unsupported operator: ${node.op}`);
      }
    }
  }
}

/** Parses a filter condition once and returns a reusable predicate over row objects. */
export function compileFilterCondition(condition: string): (row: any) => boolean {
  const ast = new Parser(tokenize(condition)).parse();
  return (row: any) => Boolean(evaluate(ast, row));
}
