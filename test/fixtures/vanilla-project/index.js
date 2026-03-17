import { add, multiply } from './lib/math';
import { debounce } from './lib/utils';

export function init() {
  console.log('Initialized');
}

export function calculate(a, b) {
  return add(multiply(a, 2), b);
}

export default {
  init,
  calculate,
};
