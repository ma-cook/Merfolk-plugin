import { describe, it, expect } from 'vitest';
import { sanitizeNodeId } from '../../src/utils';

describe('sanitizeNodeId', () => {
  it('replaces hyphens with underscores', () => {
    expect(sanitizeNodeId('my-file')).toBe('my_file');
  });

  it('replaces dots with underscores', () => {
    expect(sanitizeNodeId('my.file')).toBe('my_file');
  });

  it('replaces spaces with underscores', () => {
    expect(sanitizeNodeId('my file')).toBe('my_file');
  });

  it('replaces consecutive special chars with single underscore', () => {
    expect(sanitizeNodeId('my--file')).toBe('my_file');
  });

  it('prefixes with underscore when name starts with digit', () => {
    expect(sanitizeNodeId('1file')).toBe('_1file');
  });

  it('preserves alphanumeric characters', () => {
    expect(sanitizeNodeId('myFile123')).toBe('myFile123');
  });

  it('handles empty string', () => {
    expect(sanitizeNodeId('')).toBe('');
  });
});
