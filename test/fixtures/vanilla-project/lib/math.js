export function add(a, b) {
  return a + b;
}

export function multiply(a, b) {
  return a * b;
}

export function subtract(a, b) {
  return a - b;
}

export class Calculator {
  constructor() {
    this.history = [];
  }

  compute(op, a, b) {
    let result;
    switch (op) {
      case 'add': result = add(a, b); break;
      case 'multiply': result = multiply(a, b); break;
      default: throw new Error(`Unknown op: ${op}`);
    }
    this.history.push({ op, a, b, result });
    return result;
  }
}
