import { describe, it, expect } from 'vitest';
import { analyzeFile, containsJSX } from '../../src/scanner/fileAnalyzer';

describe('analyzeFile', () => {
  it('classifies src/components/Button.jsx as a component', () => {
    const ctx = analyzeFile('src/components/Button.jsx');
    expect(ctx.isComponent).toBe(true);
  });

  it('classifies src/hooks/useAuth.js as a hook', () => {
    const ctx = analyzeFile('src/hooks/useAuth.js');
    expect(ctx.isHook).toBe(true);
  });

  it('classifies src/services/api.js as a service', () => {
    const ctx = analyzeFile('src/services/api.js');
    expect(ctx.isService).toBe(true);
  });

  it('classifies src/stores/index.js as a store', () => {
    const ctx = analyzeFile('src/stores/index.js');
    expect(ctx.isStore).toBe(true);
  });

  it('classifies src/store/index.js as a store', () => {
    const ctx = analyzeFile('src/store/index.js');
    expect(ctx.isStore).toBe(true);
  });

  it('classifies src/utils/helpers.js as a utility', () => {
    const ctx = analyzeFile('src/utils/helpers.js');
    expect(ctx.isUtil).toBe(true);
  });

  it('classifies src/helpers/format.js as a utility', () => {
    const ctx = analyzeFile('src/helpers/format.js');
    expect(ctx.isUtil).toBe(true);
  });

  it('classifies src/lib/math.js as a utility', () => {
    const ctx = analyzeFile('src/lib/math.js');
    expect(ctx.isUtil).toBe(true);
  });

  it('classifies src/workers/compute.js as a worker', () => {
    const ctx = analyzeFile('src/workers/compute.js');
    expect(ctx.isWorker).toBe(true);
  });

  it('classifies shaders/vertex.glsl as a shader', () => {
    const ctx = analyzeFile('shaders/vertex.glsl');
    expect(ctx.isShader).toBe(true);
  });

  it('classifies src/functions/api.js as backend', () => {
    const ctx = analyzeFile('src/functions/api.js');
    expect(ctx.isBackend).toBe(true);
  });

  it('classifies src/api/routes.js as backend', () => {
    const ctx = analyzeFile('src/api/routes.js');
    expect(ctx.isBackend).toBe(true);
  });

  it('classifies src/server/index.js as backend', () => {
    const ctx = analyzeFile('src/server/index.js');
    expect(ctx.isBackend).toBe(true);
  });

  it('classifies App.jsx at root as a component', () => {
    const ctx = analyzeFile('App.jsx');
    expect(ctx.isComponent).toBe(true);
  });

  it('classifies models/user.py as a model (Python)', () => {
    const ctx = analyzeFile('models/user.py');
    expect(ctx.isModel).toBe(true);
  });

  it('classifies views/home.py as a view (Python)', () => {
    const ctx = analyzeFile('views/home.py');
    expect(ctx.isView).toBe(true);
  });

  it('classifies composables/useCounter.js as a composable (Vue)', () => {
    const ctx = analyzeFile('composables/useCounter.js');
    expect(ctx.isComposable).toBe(true);
  });

  it('classifies plugins/auth.js as a plugin (Vue)', () => {
    const ctx = analyzeFile('plugins/auth.js');
    expect(ctx.isPlugin).toBe(true);
  });

  it('detects Next.js route for app/page.tsx when repoType is nextjs', () => {
    const ctx = analyzeFile('app/page.tsx', 'nextjs');
    expect(ctx.isNextRoute).toBe(true);
  });

  it('does not detect Next.js route for non-nextjs repoType', () => {
    const ctx = analyzeFile('app/page.tsx', 'react');
    expect(ctx.isNextRoute).toBe(false);
  });

  it('returns all flags as false for unknown paths', () => {
    const ctx = analyzeFile('some/unknown/path.js');
    expect(ctx.isComponent).toBe(false);
    expect(ctx.isHook).toBe(false);
    expect(ctx.isService).toBe(false);
    expect(ctx.isStore).toBe(false);
    expect(ctx.isUtil).toBe(false);
  });
});

describe('containsJSX', () => {
  it('returns true for JSXElement node', () => {
    expect(containsJSX({ type: 'JSXElement' })).toBe(true);
  });

  it('returns true for JSXFragment node', () => {
    expect(containsJSX({ type: 'JSXFragment' })).toBe(true);
  });

  it('returns true for ReturnStatement containing JSX', () => {
    expect(
      containsJSX({
        type: 'ReturnStatement',
        argument: { type: 'JSXElement' },
      })
    ).toBe(true);
  });

  it('returns true for conditional expression with JSX', () => {
    expect(
      containsJSX({
        type: 'ConditionalExpression',
        consequent: { type: 'JSXElement' },
        alternate: { type: 'NullLiteral' },
      })
    ).toBe(true);
  });

  it('returns true for .map() callback returning JSX', () => {
    expect(
      containsJSX({
        type: 'CallExpression',
        callee: { type: 'MemberExpression', property: { name: 'map' } },
        arguments: [
          {
            type: 'ArrowFunctionExpression',
            body: { type: 'JSXElement' },
          },
        ],
      })
    ).toBe(true);
  });

  it('returns true for React.createElement call', () => {
    expect(
      containsJSX({
        type: 'CallExpression',
        callee: {
          type: 'MemberExpression',
          object: { name: 'React' },
          property: { name: 'createElement' },
        },
      })
    ).toBe(true);
  });

  it('returns true for React.memo wrapping JSX', () => {
    expect(
      containsJSX({
        type: 'CallExpression',
        callee: {
          type: 'MemberExpression',
          object: { name: 'React' },
          property: { name: 'memo' },
        },
      })
    ).toBe(true);
  });

  it('returns true for forwardRef wrapping JSX', () => {
    expect(
      containsJSX({
        type: 'CallExpression',
        callee: { type: 'Identifier', name: 'forwardRef' },
      })
    ).toBe(true);
  });

  it('returns false for null node', () => {
    expect(containsJSX(null)).toBe(false);
  });

  it('returns false for non-JSX nodes', () => {
    expect(containsJSX({ type: 'Identifier', name: 'foo' })).toBe(false);
  });
});
