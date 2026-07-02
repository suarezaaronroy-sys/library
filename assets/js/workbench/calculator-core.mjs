// calculator-core.mjs
// Pure, dependency-free expression engine for the Workbench calculator.
// No eval. Recursive-descent parser -> AST -> evaluator. Testable in isolation.

export class CalcError extends Error {}

const CONSTANTS = { pi: Math.PI, e: Math.E, tau: Math.PI * 2 };
const FUNCTIONS = {
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  ln: Math.log,
  log: (x) => Math.log10(x)
};

export function tokenize(input) {
  const src = String(input).replace(/[,_\s]/g, "");
  const tokens = [];
  const isDigit = (c) => c >= "0" && c <= "9";
  const isAlpha = (c) => (c >= "a" && c <= "z") || (c >= "A" && c <= "Z");
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (isDigit(c) || (c === "." && isDigit(src[i + 1]))) {
      let num = "";
      while (i < src.length && (isDigit(src[i]) || src[i] === ".")) num += src[i++];
      if ((num.match(/\./g) || []).length > 1) throw new CalcError("Malformed number");
      tokens.push({ type: "num", value: Number(num) });
      continue;
    }
    if (isAlpha(c)) {
      let name = "";
      while (i < src.length && (isAlpha(src[i]) || isDigit(src[i]))) name += src[i++];
      tokens.push({ type: "name", value: name.toLowerCase() });
      continue;
    }
    if ("+-*/^()%".includes(c)) { tokens.push({ type: "op", value: c }); i++; continue; }
    throw new CalcError(`Unexpected character "${c}"`);
  }
  return tokens;
}

export function parse(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];
  const eat = () => tokens[pos++];

  function expression() { return additive(); }

  function additive() {
    let node = multiplicative();
    while (peek() && peek().type === "op" && (peek().value === "+" || peek().value === "-")) {
      const op = eat().value;
      node = { type: "binary", op, left: node, right: multiplicative() };
    }
    return node;
  }

  function multiplicative() {
    let node = unary();
    while (peek() && peek().type === "op" && (peek().value === "*" || peek().value === "/")) {
      const op = eat().value;
      node = { type: "binary", op, left: node, right: unary() };
    }
    return node;
  }

  function unary() {
    if (peek() && peek().type === "op" && (peek().value === "-" || peek().value === "+")) {
      const op = eat().value;
      return { type: "unary", op, arg: unary() };
    }
    return postfix();
  }

  function postfix() {
    let node = power();
    while (peek() && peek().type === "op" && peek().value === "%") {
      eat();
      node = { type: "percent", arg: node };
    }
    return node;
  }

  function power() {
    const base = primary();
    if (peek() && peek().type === "op" && peek().value === "^") {
      eat();
      return { type: "binary", op: "^", left: base, right: unary() };
    }
    return base;
  }

  function primary() {
    const t = peek();
    if (!t) throw new CalcError("Unexpected end of expression");
    if (t.type === "num") { eat(); return { type: "num", value: t.value }; }
    if (t.type === "op" && t.value === "(") {
      eat();
      const expr = expression();
      if (!peek() || peek().value !== ")") throw new CalcError("Missing closing parenthesis");
      eat();
      return expr;
    }
    if (t.type === "name") {
      eat();
      if (peek() && peek().type === "op" && peek().value === "(") {
        eat();
        const arg = expression();
        if (!peek() || peek().value !== ")") throw new CalcError("Missing closing parenthesis");
        eat();
        return { type: "func", name: t.value, arg };
      }
      return { type: "name", value: t.value };
    }
    throw new CalcError(`Unexpected token "${t.value}"`);
  }

  const ast = expression();
  if (pos < tokens.length) throw new CalcError(`Unexpected token "${tokens[pos].value}"`);
  return ast;
}

export function evaluateAst(node, ctx = {}) {
  switch (node.type) {
    case "num": return node.value;
    case "name": {
      if (node.value === "ans") return Number(ctx.ans) || 0;
      if (node.value in CONSTANTS) return CONSTANTS[node.value];
      throw new CalcError(`Unknown name "${node.value}"`);
    }
    case "unary": {
      const v = evaluateAst(node.arg, ctx);
      return node.op === "-" ? -v : v;
    }
    case "percent": return evaluateAst(node.arg, ctx) / 100;
    case "func": {
      const fn = FUNCTIONS[node.name];
      if (!fn) throw new CalcError(`Unknown function "${node.name}"`);
      return fn(evaluateAst(node.arg, ctx));
    }
    case "binary": {
      const l = evaluateAst(node.left, ctx);
      if (node.right.type === "percent" && "+-*/".includes(node.op)) {
        const p = evaluateAst(node.right.arg, ctx);
        if (node.op === "+") return l + (l * p) / 100;
        if (node.op === "-") return l - (l * p) / 100;
        if (node.op === "*") return l * (p / 100);
        if (node.op === "/") return l / (p / 100);
      }
      const r = evaluateAst(node.right, ctx);
      switch (node.op) {
        case "+": return l + r;
        case "-": return l - r;
        case "*": return l * r;
        case "/": return l / r;
        case "^": return Math.pow(l, r);
        default: throw new CalcError(`Unknown operator "${node.op}"`);
      }
    }
    default: throw new CalcError("Cannot evaluate expression");
  }
}

export function evaluate(input, ctx = {}) {
  const trimmed = String(input).trim();
  if (!trimmed) return null;
  const value = evaluateAst(parse(tokenize(trimmed)), ctx);
  if (typeof value !== "number" || Number.isNaN(value)) throw new CalcError("Result is not a number");
  if (!Number.isFinite(value)) throw new CalcError("Result is not finite (check division by zero)");
  return value;
}

export function formatResult(value) {
  if (value === null || value === undefined) return "";
  if (!Number.isFinite(value)) return "Error";
  const clean = Number(value.toPrecision(12));
  const abs = Math.abs(clean);
  if (abs !== 0 && (abs < 1e-6 || abs >= 1e15)) {
    return clean.toExponential(6).replace(/\.?0+e/, "e");
  }
  return clean.toLocaleString("en-US", { maximumFractionDigits: 10 });
}
