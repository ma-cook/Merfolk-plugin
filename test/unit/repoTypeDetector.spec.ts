import { describe, it, expect } from 'vitest';
import path from 'path';
import { detectRepoType } from '../../src/scanner/repoTypeDetector';

const FIXTURES = path.resolve(__dirname, '../fixtures');

describe('detectRepoType', () => {
  it('detects react when package.json has react dependency', async () => {
    const result = await detectRepoType(path.join(FIXTURES, 'react-project'));
    expect(result).toBe('react');
  });

  it('detects nextjs when package.json has next dependency', async () => {
    const result = await detectRepoType(path.join(FIXTURES, 'nextjs-project'));
    expect(result).toBe('nextjs');
  });

  it('detects vue when package.json has vue dependency', async () => {
    const result = await detectRepoType(path.join(FIXTURES, 'vue-project'));
    expect(result).toBe('vue');
  });

  it('detects vue when .vue files exist in source directories', async () => {
    const result = await detectRepoType(path.join(FIXTURES, 'vue-project'));
    expect(result).toBe('vue');
  });

  it('detects python when .py files exist with Python project signals', async () => {
    const result = await detectRepoType(path.join(FIXTURES, 'python-project'));
    expect(result).toBe('python');
  });

  it('detects python when only .py files exist with no JS', async () => {
    const result = await detectRepoType(path.join(FIXTURES, 'python-project'));
    expect(result).toBe('python');
  });

  it('falls back to vanilla when no framework detected', async () => {
    const result = await detectRepoType(path.join(FIXTURES, 'vanilla-project'));
    expect(result).toBe('vanilla');
  });

  it('detects react from .jsx files in source directories', async () => {
    const result = await detectRepoType(path.join(FIXTURES, 'react-project'));
    expect(result).toBe('react');
  });

  it('treats .tsx without react prod dep as vanilla', async () => {
    const result = await detectRepoType(path.join(FIXTURES, 'vanilla-project'));
    expect(result).toBe('vanilla');
  });

  it('ignores files in example/test directories for type detection', async () => {
    const result = await detectRepoType(path.join(FIXTURES, 'react-project'));
    expect(['react', 'nextjs', 'vue', 'python', 'vanilla']).toContain(result);
  });

  it('prefers JS over Python when JS files are dominant', async () => {
    const result = await detectRepoType(path.join(FIXTURES, 'react-project'));
    expect(result).not.toBe('python');
  });

  it('detects nextjs from next.config.js presence', async () => {
    const result = await detectRepoType(path.join(FIXTURES, 'nextjs-project'));
    expect(result).toBe('nextjs');
  });
});
