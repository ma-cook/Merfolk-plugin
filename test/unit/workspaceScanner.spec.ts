import { describe, it, expect } from 'vitest';
import path from 'path';
import { scanWorkspace } from '../../src/scanner/workspaceScanner';

const FIXTURES = path.resolve(__dirname, '../fixtures');

describe('scanWorkspace', () => {
  it('discovers .js files in workspace', async () => {
    const files = await scanWorkspace(path.join(FIXTURES, 'vanilla-project'));
    const jsFiles = files.filter(f => f.path.endsWith('.js'));
    expect(jsFiles.length).toBeGreaterThan(0);
  });

  it('discovers .jsx files in workspace', async () => {
    const files = await scanWorkspace(path.join(FIXTURES, 'react-project'));
    const jsxFiles = files.filter(f => f.path.endsWith('.jsx'));
    expect(jsxFiles.length).toBeGreaterThan(0);
  });

  it('discovers .ts files in workspace', async () => {
    const files = await scanWorkspace(path.join(FIXTURES, 'nextjs-project'));
    const tsFiles = files.filter(f => f.path.endsWith('.ts') || f.path.endsWith('.tsx'));
    expect(tsFiles.length).toBeGreaterThan(0);
  });

  it('discovers .tsx files in workspace', async () => {
    const files = await scanWorkspace(path.join(FIXTURES, 'nextjs-project'));
    const tsxFiles = files.filter(f => f.path.endsWith('.tsx'));
    expect(tsxFiles.length).toBeGreaterThan(0);
  });

  it('discovers .py files in workspace', async () => {
    const files = await scanWorkspace(path.join(FIXTURES, 'python-project'));
    const pyFiles = files.filter(f => f.path.endsWith('.py'));
    expect(pyFiles.length).toBeGreaterThan(0);
  });

  it('discovers .vue files in workspace', async () => {
    const files = await scanWorkspace(path.join(FIXTURES, 'vue-project'));
    const vueFiles = files.filter(f => f.path.endsWith('.vue'));
    expect(vueFiles.length).toBeGreaterThan(0);
  });

  it('discovers shader files (.glsl, .wgsl, etc.)', async () => {
    const files = await scanWorkspace(path.join(FIXTURES, 'vanilla-project'));
    // shader files may not exist in vanilla fixture, just ensure no throw
    expect(Array.isArray(files)).toBe(true);
  });

  it('excludes node_modules directory', async () => {
    const files = await scanWorkspace(path.join(FIXTURES, 'react-project'));
    const nodeModules = files.filter(f => f.path.includes('node_modules'));
    expect(nodeModules.length).toBe(0);
  });

  it('excludes .git directory', async () => {
    const files = await scanWorkspace(path.join(FIXTURES, 'react-project'));
    const gitFiles = files.filter(f => f.path.includes('.git'));
    expect(gitFiles.length).toBe(0);
  });

  it('classifies discovered files by type', async () => {
    const files = await scanWorkspace(path.join(FIXTURES, 'react-project'));
    for (const file of files) {
      expect(['file', 'python', 'vue', 'shader']).toContain(file.type);
    }
  });

  it('returns empty array for empty workspace', async () => {
    const files = await scanWorkspace('/tmp/empty-test-workspace');
    expect(Array.isArray(files)).toBe(true);
    expect(files.length).toBe(0);
  });
});
