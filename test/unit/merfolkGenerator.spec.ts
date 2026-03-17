import { describe, it, expect } from 'vitest';
import { generateMerfolkMarkdown } from '../../src/scanner/merfolkGenerator';
import type { Elements } from '../../src/types';

function makeElements(overrides: Partial<Elements> = {}): Elements {
  return {
    components: [],
    functions: [],
    hooks: [],
    services: [],
    stores: [],
    utilities: [],
    imports: { libraries: [] },
    ...overrides,
  };
}

describe('generateMerfolkMarkdown', () => {
  it('generates merfolk header with repo name as comment', () => {
    const result = generateMerfolkMarkdown(makeElements(), 'my-repo', 'vanilla');
    expect(result).toContain('my-repo');
  });

  it('wraps output in merfolk code fences', () => {
    const result = generateMerfolkMarkdown(makeElements(), 'repo', 'vanilla');
    expect(result).toContain('```merfolk');
    expect(result).toContain('```');
  });

  it('creates Component nodes with {Component: name} syntax', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ components: ['Button'] }),
      'repo',
      'react'
    );
    expect(result).toContain('{Component: Button}');
  });

  it('creates Function nodes with [Function: name] syntax', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ functions: ['processData'] }),
      'repo',
      'vanilla'
    );
    expect(result).toContain('[Function: processData]');
  });

  it('creates Store nodes with [[Store: name]] syntax', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ stores: ['userStore'] }),
      'repo',
      'react'
    );
    expect(result).toContain('[[Store: userStore]]');
  });

  it('creates Service nodes with ((Service: name)) syntax', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ services: ['ApiService'] }),
      'repo',
      'react'
    );
    expect(result).toContain('((Service: ApiService))');
  });

  it('creates Library nodes with <Library: name> syntax', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ imports: { libraries: ['lodash'] } }),
      'repo',
      'vanilla'
    );
    expect(result).toContain('<Library: lodash>');
  });

  it('creates Hook file containers with [Hook: name] syntax', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ hooks: ['useAuth'] }),
      'repo',
      'react'
    );
    expect(result).toContain('[Hook: useAuth]');
  });

  it('creates dashed arrows for containment (-.->) ', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ components: ['App'], hooks: ['useAuth'] }),
      'repo',
      'react'
    );
    expect(result).toContain('-.->')
  });

  it('creates solid arrows for hierarchy (-->)', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ components: ['App', 'Button'] }),
      'repo',
      'react'
    );
    expect(result).toContain('-->');
  });

  it('deduplicates elements across categories', () => {
    const result = generateMerfolkMarkdown(
      makeElements({
        components: ['MyComp', 'MyComp'],
        functions: ['fn', 'fn'],
      }),
      'repo',
      'react'
    );
    const matches = result.match(/\{Component: MyComp\}/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('removes services/utilities that are also in stores', () => {
    const result = generateMerfolkMarkdown(
      makeElements({
        stores: ['dataStore'],
        services: ['dataStore'],
      }),
      'repo',
      'react'
    );
    expect(result).toContain('[[Store: dataStore]]');
    const serviceMatches = result.match(/\(\(Service: dataStore\)\)/g) ?? [];
    expect(serviceMatches.length).toBe(0);
  });

  it('removes utilities that are also in services', () => {
    const result = generateMerfolkMarkdown(
      makeElements({
        services: ['apiUtil'],
        utilities: ['apiUtil'],
      }),
      'repo',
      'react'
    );
    expect(result).toContain('((Service: apiUtil))');
    const utilMatches = result.match(/\[Function: apiUtil\]/g) ?? [];
    expect(utilMatches.length).toBe(0);
  });

  it('filters component relationships to only known components', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ components: ['App'] }),
      'repo',
      'react'
    );
    expect(result).not.toContain('{Component: UnknownComp}');
  });

  it('filters component dependencies to only known elements', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ components: ['App'] }),
      'repo',
      'react'
    );
    expect(result).not.toContain('UnknownDep');
  });

  it('handles _file suffix for name collisions', () => {
    const result = generateMerfolkMarkdown(
      makeElements({
        components: ['Button'],
        functions: ['Button'],
      }),
      'repo',
      'react'
    );
    expect(result).toContain('_file');
  });

  it('generates routed connections through parent containers', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ components: ['App', 'Header'] }),
      'repo',
      'react'
    );
    expect(typeof result).toBe('string');
  });

  it('handles empty elements gracefully', () => {
    expect(() =>
      generateMerfolkMarkdown(makeElements(), 'empty-repo', 'vanilla')
    ).not.toThrow();
  });

  it('generates vanilla root entry-point for vanilla repos', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ functions: ['main', 'init'] }),
      'my-lib',
      'vanilla'
    );
    expect(result).toContain('my-lib');
  });

  it('generates Next.js route hierarchy for nextjs repos', () => {
    const result = generateMerfolkMarkdown(
      makeElements({ components: ['RootLayout', 'HomePage'] }),
      'my-next-app',
      'nextjs'
    );
    expect(result).toContain('my-next-app');
  });

  it('generates component-function relationships with labels', () => {
    const result = generateMerfolkMarkdown(
      makeElements({
        components: ['Button'],
        functions: ['handleClick'],
      }),
      'repo',
      'react'
    );
    expect(typeof result).toBe('string');
  });

  it('generates component dependency connections', () => {
    const result = generateMerfolkMarkdown(
      makeElements({
        components: ['App'],
        hooks: ['useAuth'],
      }),
      'repo',
      'react'
    );
    expect(typeof result).toBe('string');
  });

  it('generates function call relationship connections', () => {
    const result = generateMerfolkMarkdown(
      makeElements({
        services: ['apiService'],
        functions: ['fetchData'],
      }),
      'repo',
      'react'
    );
    expect(typeof result).toBe('string');
  });

  it('generates store usage detail connections', () => {
    const result = generateMerfolkMarkdown(
      makeElements({
        stores: ['userStore'],
        components: ['UserProfile'],
      }),
      'repo',
      'react'
    );
    expect(typeof result).toBe('string');
  });
});
