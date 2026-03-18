import { describe, it, expect } from 'vitest';
import {
  traverseVanillaAST,
  traversePythonSource,
  traverseVueSource,
  traverseReactAST,
} from '../../src/scanner/astTraversal';
import type { Elements, FoundItems, FileContext } from '../../src/types';

function makeElements(): Elements {
  return {
    components: [],
    functions: [],
    hooks: [],
    services: [],
    stores: [],
    utilities: [],
    imports: { libraries: [] },
    componentInternalFunctions: [],
    componentRelationships: [],
    componentDependencies: [],
    fileContainers: new Map(),
    internalHelperComponents: [],
    rawCallSites: [],
    apiEndpoints: new Map(),
    errorBoundaries: new Set(),
    suspenseBoundaries: new Set(),
    errorContainment: [],
    eventEmitters: new Map(),
    eventListeners: new Map(),
    sharedInterfaces: new Map(),
    authGuards: new Map(),
  };
}

function makeFoundItems(): FoundItems {
  return {
    components: new Set(),
    functions: new Set(),
    hooks: new Set(),
    services: new Set(),
    stores: new Set(),
    utilities: new Set(),
  };
}

function makeFileContext(overrides: Partial<FileContext> = {}): FileContext {
  return {
    isComponent: false,
    isHook: false,
    isService: false,
    isStore: false,
    isUtil: false,
    isWorker: false,
    isShader: false,
    isBackend: false,
    isNextRoute: false,
    isModel: false,
    isView: false,
    isController: false,
    isMiddleware: false,
    isConfig: false,
    isMigration: false,
    isCommand: false,
    isSerializer: false,
    isTask: false,
    isComposable: false,
    isPlugin: false,
    isDirective: false,
    isMixin: false,
    isLayout: false,
    isPage: false,
    isRouter: false,
    ...overrides,
  };
}

describe('traverseVanillaAST', () => {
  it('extracts named function exports', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ExportNamedDeclaration',
            declaration: {
              type: 'FunctionDeclaration',
              id: { name: 'myFunction' },
            },
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseVanillaAST(ast, 'lib/utils.js', makeFileContext({ isUtil: true }), elements, foundItems);
    expect(elements.utilities).toContain('myFunction');
  });

  it('extracts default function exports', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ExportDefaultDeclaration',
            declaration: {
              type: 'FunctionDeclaration',
              id: { name: 'defaultFn' },
            },
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseVanillaAST(ast, 'lib/utils.js', makeFileContext({ isUtil: true }), elements, foundItems);
    expect(elements.utilities).toContain('defaultFn');
  });

  it('extracts arrow function exports', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ExportNamedDeclaration',
            declaration: {
              type: 'VariableDeclaration',
              declarations: [
                {
                  type: 'VariableDeclarator',
                  id: { name: 'arrowFn' },
                  init: { type: 'ArrowFunctionExpression' },
                },
              ],
            },
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseVanillaAST(ast, 'lib/utils.js', makeFileContext({ isUtil: true }), elements, foundItems);
    expect(elements.utilities).toContain('arrowFn');
  });

  it('extracts class declarations as services', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ExportNamedDeclaration',
            declaration: {
              type: 'ClassDeclaration',
              id: { name: 'ApiService' },
            },
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseVanillaAST(ast, 'src/services/api.js', makeFileContext({ isService: true }), elements, foundItems);
    expect(elements.services).toContain('ApiService');
  });

  it('extracts variable declaration exports', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ExportNamedDeclaration',
            declaration: {
              type: 'VariableDeclaration',
              declarations: [
                {
                  type: 'VariableDeclarator',
                  id: { name: 'MY_CONST' },
                  init: { type: 'StringLiteral', value: 'value' },
                },
              ],
            },
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseVanillaAST(ast, 'lib/constants.js', makeFileContext({ isUtil: true }), elements, foundItems);
    expect(elements.utilities).toContain('MY_CONST');
  });

  it('tracks relative import relationships', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ImportDeclaration',
            source: { value: './helpers' },
            specifiers: [{ type: 'ImportDefaultSpecifier', local: { name: 'helpers' } }],
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseVanillaAST(ast, 'lib/utils.js', makeFileContext({ isUtil: true }), elements, foundItems);
    // Should not add to libraries
    expect(elements.imports.libraries).not.toContain('./helpers');
  });

  it('tracks external library imports', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ImportDeclaration',
            source: { value: 'lodash' },
            specifiers: [{ type: 'ImportDefaultSpecifier', local: { name: '_' } }],
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseVanillaAST(ast, 'lib/utils.js', makeFileContext({ isUtil: true }), elements, foundItems);
    expect(elements.imports.libraries).toContain('lodash');
  });

  it('skips TypeScript interface declarations', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ExportNamedDeclaration',
            declaration: {
              type: 'TSInterfaceDeclaration',
              id: { name: 'MyInterface' },
            },
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseVanillaAST(ast, 'src/types.ts', makeFileContext(), elements, foundItems);
    expect(elements.functions).not.toContain('MyInterface');
    expect(elements.utilities).not.toContain('MyInterface');
  });

  it('skips TypeScript type alias declarations', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ExportNamedDeclaration',
            declaration: {
              type: 'TSTypeAliasDeclaration',
              id: { name: 'MyType' },
            },
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseVanillaAST(ast, 'src/types.ts', makeFileContext(), elements, foundItems);
    expect(elements.functions).not.toContain('MyType');
  });

  it('handles barrel re-exports (export * from)', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ExportAllDeclaration',
            source: { value: './components' },
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    expect(() =>
      traverseVanillaAST(ast, 'src/index.ts', makeFileContext(), elements, foundItems)
    ).not.toThrow();
  });

  it('handles CommonJS require() patterns', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'VariableDeclaration',
            declarations: [
              {
                type: 'VariableDeclarator',
                id: { name: 'fs' },
                init: {
                  type: 'CallExpression',
                  callee: { type: 'Identifier', name: 'require' },
                  arguments: [{ type: 'StringLiteral', value: 'fs' }],
                },
              },
            ],
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    expect(() =>
      traverseVanillaAST(ast, 'lib/helper.js', makeFileContext({ isUtil: true }), elements, foundItems)
    ).not.toThrow();
  });

  it('treats all declarations as public when no exports', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'FunctionDeclaration',
            id: { name: 'internalFn' },
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseVanillaAST(ast, 'lib/utils.js', makeFileContext({ isUtil: true }), elements, foundItems);
    expect(elements.utilities).toContain('internalFn');
  });

  it('assigns correct container type based on file context', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ExportNamedDeclaration',
            declaration: {
              type: 'FunctionDeclaration',
              id: { name: 'fetchData' },
            },
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseVanillaAST(ast, 'src/services/api.js', makeFileContext({ isService: true }), elements, foundItems);
    expect(elements.services).toContain('fetchData');
  });

  it('upgrades utility to service when class found', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ClassDeclaration',
            id: { name: 'DataManager' },
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseVanillaAST(ast, 'lib/dataManager.js', makeFileContext({ isUtil: true }), elements, foundItems);
    expect(elements.services).toContain('DataManager');
  });
});

describe('traversePythonSource', () => {
  it('extracts top-level class definitions', () => {
    const source = 'class UserModel:\n    pass\n';
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traversePythonSource(source, 'models/user.py', makeFileContext({ isModel: true }), elements, foundItems);
    expect(elements.services).toContain('UserModel');
  });

  it('extracts top-level function definitions', () => {
    const source = 'def get_user(id):\n    pass\n';
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traversePythonSource(source, 'utils/helpers.py', makeFileContext({ isUtil: true }), elements, foundItems);
    expect(elements.utilities).toContain('get_user');
  });

  it('extracts async function definitions', () => {
    const source = 'async def fetch_data():\n    pass\n';
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traversePythonSource(source, 'services/api.py', makeFileContext({ isService: true }), elements, foundItems);
    expect(elements.services).toContain('fetch_data');
  });

  it('skips private functions (leading underscore)', () => {
    const source = 'def _private_fn():\n    pass\n';
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traversePythonSource(source, 'utils/helpers.py', makeFileContext({ isUtil: true }), elements, foundItems);
    expect(elements.utilities).not.toContain('_private_fn');
  });

  it('skips dunder methods', () => {
    const source = 'def __init__(self):\n    pass\n';
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traversePythonSource(source, 'models/user.py', makeFileContext({ isModel: true }), elements, foundItems);
    expect(elements.services).not.toContain('__init__');
    expect(elements.utilities).not.toContain('__init__');
  });

  it('tracks relative imports (from .module import)', () => {
    const source = 'from .helpers import format_date\n';
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traversePythonSource(source, 'services/api.py', makeFileContext({ isService: true }), elements, foundItems);
    expect(elements.imports.libraries).not.toContain('helpers');
  });

  it('tracks absolute imports as libraries', () => {
    const source = 'import os\nimport sys\n';
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traversePythonSource(source, 'main.py', makeFileContext(), elements, foundItems);
    expect(elements.imports.libraries).toContain('os');
  });

  it('tracks multi-part imports as module relationships', () => {
    const source = 'from models.user import UserModel\n';
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traversePythonSource(source, 'services/api.py', makeFileContext({ isService: true }), elements, foundItems);
    expect(elements.imports.libraries).toContain('models');
  });

  it('skips __init__.py files', () => {
    const source = 'from .module import something\n';
    const elements = makeElements();
    const foundItems = makeFoundItems();
    expect(() =>
      traversePythonSource(source, 'models/__init__.py', makeFileContext(), elements, foundItems)
    ).not.toThrow();
  });

  it('handles manage.py as entry point', () => {
    const source = 'if __name__ == "__main__":\n    pass\n';
    const elements = makeElements();
    const foundItems = makeFoundItems();
    expect(() =>
      traversePythonSource(source, 'manage.py', makeFileContext(), elements, foundItems)
    ).not.toThrow();
  });

  it('assigns model files as service container type', () => {
    const source = 'class User:\n    pass\n';
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traversePythonSource(source, 'models/user.py', makeFileContext({ isModel: true }), elements, foundItems);
    expect(elements.services).toContain('User');
  });

  it('assigns controller/view files as backend container type', () => {
    const source = 'def home_view(request):\n    pass\n';
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traversePythonSource(source, 'views/home.py', makeFileContext({ isView: true }), elements, foundItems);
    expect(elements.functions).toContain('home_view');
  });
});

describe('traverseVueSource', () => {
  it('extracts script content from .vue SFC', () => {
    const source = `<template><div>Hello</div></template>
<script>
export default {
  name: 'Header'
}
</script>`;
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseVueSource(source, 'src/components/Header.vue', makeFileContext({ isComponent: true }), elements, foundItems);
    expect(elements.components).toContain('Header');
  });

  it('extracts script setup content from .vue SFC', () => {
    const source = `<template><div>Hello</div></template>
<script setup>
const count = ref(0)
</script>`;
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseVueSource(source, 'src/components/Counter.vue', makeFileContext({ isComponent: true }), elements, foundItems);
    expect(elements.components).toContain('Counter');
  });

  it('registers .vue files as components', () => {
    const source = `<template><div /></template>`;
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseVueSource(source, 'src/components/Modal.vue', makeFileContext({ isComponent: true }), elements, foundItems);
    expect(elements.components).toContain('Modal');
  });

  it('scans template for PascalCase child component usage', () => {
    const source = `<template><MyButton /></template>
<script setup></script>`;
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseVueSource(source, 'src/components/Parent.vue', makeFileContext({ isComponent: true }), elements, foundItems);
    // Should detect MyButton usage
    expect(elements.components).toContain('Parent');
  });

  it('scans template for kebab-case child component usage', () => {
    const source = `<template><my-button /></template>
<script setup></script>`;
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseVueSource(source, 'src/components/Parent.vue', makeFileContext({ isComponent: true }), elements, foundItems);
    expect(elements.components).toContain('Parent');
  });

  it('extracts exported functions from non-vue JS files', () => {
    const source = `export function useCounter() { return { count: 0 }; }`;
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseVueSource(source, 'src/composables/useCounter.js', makeFileContext({ isComposable: true }), elements, foundItems);
    expect(elements.hooks).toContain('useCounter');
  });

  it('tracks import relationships from script block', () => {
    const source = `<template><div /></template>
<script setup>
import { useCounter } from '../composables/useCounter'
</script>`;
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseVueSource(source, 'src/components/Header.vue', makeFileContext({ isComponent: true }), elements, foundItems);
    expect(elements.components).toContain('Header');
  });

  it('tracks store/composable/service dependencies', () => {
    const source = `<template><div /></template>
<script setup>
import { useMainStore } from '../stores/mainStore'
const store = useMainStore()
</script>`;
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseVueSource(source, 'src/components/App.vue', makeFileContext({ isComponent: true }), elements, foundItems);
    expect(elements.components).toContain('App');
  });

  it('handles files with no script block gracefully', () => {
    const source = `<template><div>Hello</div></template>`;
    const elements = makeElements();
    const foundItems = makeFoundItems();
    expect(() =>
      traverseVueSource(source, 'src/components/Simple.vue', makeFileContext({ isComponent: true }), elements, foundItems)
    ).not.toThrow();
  });
});

describe('traverseReactAST', () => {
  it('extracts function components with JSX', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ExportNamedDeclaration',
            declaration: {
              type: 'FunctionDeclaration',
              id: { name: 'Button' },
              body: {
                type: 'BlockStatement',
                body: [
                  {
                    type: 'ReturnStatement',
                    argument: { type: 'JSXElement' },
                  },
                ],
              },
            },
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseReactAST(ast, 'src/components/Button.jsx', makeFileContext({ isComponent: true }), elements, foundItems);
    expect(elements.components).toContain('Button');
  });

  it('extracts arrow function components with JSX', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ExportNamedDeclaration',
            declaration: {
              type: 'VariableDeclaration',
              declarations: [
                {
                  type: 'VariableDeclarator',
                  id: { name: 'Card' },
                  init: {
                    type: 'ArrowFunctionExpression',
                    body: { type: 'JSXElement' },
                  },
                },
              ],
            },
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseReactAST(ast, 'src/components/Card.jsx', makeFileContext({ isComponent: true }), elements, foundItems);
    expect(elements.components).toContain('Card');
  });

  it('extracts class components extending React.Component', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ExportNamedDeclaration',
            declaration: {
              type: 'ClassDeclaration',
              id: { name: 'ClassComp' },
              superClass: {
                type: 'MemberExpression',
                object: { name: 'React' },
                property: { name: 'Component' },
              },
            },
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseReactAST(ast, 'src/components/ClassComp.jsx', makeFileContext({ isComponent: true }), elements, foundItems);
    expect(elements.components).toContain('ClassComp');
  });

  it('detects hooks (functions starting with use)', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ExportNamedDeclaration',
            declaration: {
              type: 'FunctionDeclaration',
              id: { name: 'useAuth' },
              body: { type: 'BlockStatement', body: [] },
            },
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseReactAST(ast, 'src/hooks/useAuth.js', makeFileContext({ isHook: true }), elements, foundItems);
    expect(elements.hooks).toContain('useAuth');
  });

  it('tracks component-to-component JSX relationships', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ExportDefaultDeclaration',
            declaration: {
              type: 'FunctionDeclaration',
              id: { name: 'App' },
              body: {
                type: 'BlockStatement',
                body: [
                  {
                    type: 'ReturnStatement',
                    argument: {
                      type: 'JSXElement',
                      openingElement: {
                        name: { name: 'Button' },
                      },
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseReactAST(ast, 'src/components/App.jsx', makeFileContext({ isComponent: true }), elements, foundItems);
    expect(elements.components).toContain('App');
  });

  it('tracks component dependency imports (hooks, services, stores)', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ImportDeclaration',
            source: { value: '../hooks/useAuth' },
            specifiers: [{ local: { name: 'useAuth' } }],
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseReactAST(ast, 'src/components/App.jsx', makeFileContext({ isComponent: true }), elements, foundItems);
    expect(elements.imports.libraries).not.toContain('../hooks/useAuth');
  });

  it('tracks hook return value destructuring', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ExportNamedDeclaration',
            declaration: {
              type: 'FunctionDeclaration',
              id: { name: 'useData' },
              body: {
                type: 'BlockStatement',
                body: [
                  {
                    type: 'ReturnStatement',
                    argument: {
                      type: 'ObjectExpression',
                      properties: [
                        { key: { name: 'data' }, value: { name: 'data' } },
                        { key: { name: 'loading' }, value: { name: 'loading' } },
                      ],
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseReactAST(ast, 'src/hooks/useData.js', makeFileContext({ isHook: true }), elements, foundItems);
    expect(elements.hooks).toContain('useData');
  });

  it('tracks store state/action usage', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ExportNamedDeclaration',
            declaration: {
              type: 'VariableDeclaration',
              declarations: [
                {
                  type: 'VariableDeclarator',
                  id: { name: 'useUserStore' },
                  init: {
                    type: 'CallExpression',
                    callee: { name: 'create' },
                    arguments: [],
                  },
                },
              ],
            },
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseReactAST(ast, 'src/stores/userStore.js', makeFileContext({ isStore: true }), elements, foundItems);
    expect(elements.stores).toContain('useUserStore');
  });

  it('tracks props passed to child components', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    expect(() =>
      traverseReactAST(ast, 'src/components/Parent.jsx', makeFileContext({ isComponent: true }), elements, foundItems)
    ).not.toThrow();
  });

  it('detects zustand store creation (create() calls)', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'VariableDeclaration',
            declarations: [
              {
                type: 'VariableDeclarator',
                id: { name: 'useStore' },
                init: {
                  type: 'CallExpression',
                  callee: { name: 'create' },
                  arguments: [],
                },
              },
            ],
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseReactAST(ast, 'src/stores/store.js', makeFileContext({ isStore: true }), elements, foundItems);
    expect(elements.stores).toContain('useStore');
  });

  it('handles React.memo wrapped components', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ExportDefaultDeclaration',
            declaration: {
              type: 'CallExpression',
              callee: {
                type: 'MemberExpression',
                object: { name: 'React' },
                property: { name: 'memo' },
              },
              arguments: [
                {
                  type: 'FunctionExpression',
                  id: { name: 'MemoComp' },
                  body: {
                    type: 'BlockStatement',
                    body: [
                      { type: 'ReturnStatement', argument: { type: 'JSXElement' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseReactAST(ast, 'src/components/MemoComp.jsx', makeFileContext({ isComponent: true }), elements, foundItems);
    expect(elements.components).toContain('MemoComp');
  });

  it('handles forwardRef wrapped components', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ExportDefaultDeclaration',
            declaration: {
              type: 'CallExpression',
              callee: { type: 'Identifier', name: 'forwardRef' },
              arguments: [
                {
                  type: 'FunctionExpression',
                  id: { name: 'InputRef' },
                  body: {
                    type: 'BlockStatement',
                    body: [
                      { type: 'ReturnStatement', argument: { type: 'JSXElement' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseReactAST(ast, 'src/components/InputRef.jsx', makeFileContext({ isComponent: true }), elements, foundItems);
    expect(elements.components).toContain('InputRef');
  });

  it('groups service functions under service file containers', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ExportNamedDeclaration',
            declaration: {
              type: 'FunctionDeclaration',
              id: { name: 'fetchUsers' },
              async: true,
              body: { type: 'BlockStatement', body: [] },
            },
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseReactAST(ast, 'src/services/apiService.js', makeFileContext({ isService: true }), elements, foundItems);
    expect(elements.services).toContain('fetchUsers');
  });

  it('groups utility functions under utility file containers', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ExportNamedDeclaration',
            declaration: {
              type: 'FunctionDeclaration',
              id: { name: 'formatDate' },
              body: { type: 'BlockStatement', body: [] },
            },
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseReactAST(ast, 'src/utils/helpers.js', makeFileContext({ isUtil: true }), elements, foundItems);
    expect(elements.utilities).toContain('formatDate');
  });

  it('groups worker functions under worker file containers', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ExportNamedDeclaration',
            declaration: {
              type: 'FunctionDeclaration',
              id: { name: 'processData' },
              body: { type: 'BlockStatement', body: [] },
            },
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseReactAST(ast, 'src/workers/dataWorker.js', makeFileContext({ isWorker: true }), elements, foundItems);
    expect(elements.functions).toContain('processData');
  });

  it('tracks internal helper components in same file', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    expect(() =>
      traverseReactAST(ast, 'src/components/Complex.jsx', makeFileContext({ isComponent: true }), elements, foundItems)
    ).not.toThrow();
  });
});

describe('deep call-site traversal (rawCallSites)', () => {
  /**
   * Build a minimal AST for a component that calls a utility function inside
   * its body (e.g. inside a useCallback callback).
   */
  function makeComponentASTWithCall(componentName: string, calleeName: string) {
    return {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ExportNamedDeclaration',
            declaration: {
              type: 'FunctionDeclaration',
              id: { name: componentName },
              body: {
                type: 'BlockStatement',
                body: [
                  {
                    // const cb = useCallback(() => { callee() }, [])
                    type: 'VariableDeclaration',
                    declarations: [
                      {
                        type: 'VariableDeclarator',
                        id: { name: 'cb' },
                        init: {
                          type: 'CallExpression',
                          callee: { type: 'Identifier', name: 'useCallback' },
                          arguments: [
                            {
                              type: 'ArrowFunctionExpression',
                              body: {
                                type: 'BlockStatement',
                                body: [
                                  {
                                    type: 'ExpressionStatement',
                                    expression: {
                                      type: 'CallExpression',
                                      callee: { type: 'Identifier', name: calleeName },
                                      arguments: [],
                                    },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                  {
                    type: 'ReturnStatement',
                    argument: { type: 'JSXElement' },
                  },
                ],
              },
            },
          },
        ],
      },
    };
  }

  it('finds call expressions inside useCallback callback bodies', () => {
    const elements = makeElements();
    const foundItems = makeFoundItems();
    const ast = makeComponentASTWithCall('MyComponent', 'fetchData');
    traverseReactAST(ast, 'src/components/MyComponent.jsx', makeFileContext({ isComponent: true }), elements, foundItems);
    const site = elements.rawCallSites.find(s => s.calleeName === 'fetchData');
    expect(site).toBeDefined();
    expect(site?.caller).toBe('MyComponent');
  });

  it('does NOT record React built-in hook calls in rawCallSites', () => {
    const elements = makeElements();
    const foundItems = makeFoundItems();
    const ast = makeComponentASTWithCall('MyComp', 'useState');
    traverseReactAST(ast, 'src/components/MyComp.jsx', makeFileContext({ isComponent: true }), elements, foundItems);
    const site = elements.rawCallSites.find(s => s.calleeName === 'useState');
    expect(site).toBeUndefined();
  });

  it('does NOT record custom hook calls (use-prefixed) in rawCallSites', () => {
    const elements = makeElements();
    const foundItems = makeFoundItems();
    const ast = makeComponentASTWithCall('MyComp', 'useCustomThing');
    traverseReactAST(ast, 'src/components/MyComp.jsx', makeFileContext({ isComponent: true }), elements, foundItems);
    const site = elements.rawCallSites.find(s => s.calleeName === 'useCustomThing');
    expect(site).toBeUndefined();
  });

  it('records per-call-site (not deduplicated) when the same function is called multiple times', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ExportNamedDeclaration',
            declaration: {
              type: 'FunctionDeclaration',
              id: { name: 'Scene' },
              body: {
                type: 'BlockStatement',
                body: [
                  {
                    type: 'ExpressionStatement',
                    expression: {
                      type: 'CallExpression',
                      callee: { type: 'Identifier', name: 'loadCell' },
                      arguments: [],
                    },
                  },
                  {
                    type: 'ExpressionStatement',
                    expression: {
                      type: 'CallExpression',
                      callee: { type: 'Identifier', name: 'loadCell' },
                      arguments: [],
                    },
                  },
                  {
                    type: 'ReturnStatement',
                    argument: { type: 'JSXElement' },
                  },
                ],
              },
            },
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseReactAST(ast, 'src/components/Scene.jsx', makeFileContext({ isComponent: true }), elements, foundItems);
    const sites = elements.rawCallSites.filter(s => s.calleeName === 'loadCell');
    // Two separate call sites — NOT deduplicated
    expect(sites.length).toBe(2);
  });

  it('records store .getState() calls with method property', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ExportNamedDeclaration',
            declaration: {
              type: 'FunctionDeclaration',
              id: { name: 'PlaneMesh' },
              body: {
                type: 'BlockStatement',
                body: [
                  {
                    type: 'ExpressionStatement',
                    expression: {
                      type: 'CallExpression',
                      callee: {
                        type: 'MemberExpression',
                        object: { type: 'Identifier', name: 'useStore' },
                        property: { type: 'Identifier', name: 'getState' },
                      },
                      arguments: [],
                    },
                  },
                  {
                    type: 'ReturnStatement',
                    argument: { type: 'JSXElement' },
                  },
                ],
              },
            },
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseReactAST(ast, 'src/components/PlaneMesh.jsx', makeFileContext({ isComponent: true }), elements, foundItems);
    const site = elements.rawCallSites.find(s => s.method === '.getState()');
    expect(site).toBeDefined();
    expect(site?.caller).toBe('PlaneMesh');
    expect(site?.calleeName).toBe('useStore');
  });

  it('records store .setState() calls with method property', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ExportNamedDeclaration',
            declaration: {
              type: 'FunctionDeclaration',
              id: { name: 'SphereRenderer' },
              body: {
                type: 'BlockStatement',
                body: [
                  {
                    type: 'ExpressionStatement',
                    expression: {
                      type: 'CallExpression',
                      callee: {
                        type: 'MemberExpression',
                        object: { type: 'Identifier', name: 'useStore' },
                        property: { type: 'Identifier', name: 'setState' },
                      },
                      arguments: [],
                    },
                  },
                  {
                    type: 'ReturnStatement',
                    argument: { type: 'JSXElement' },
                  },
                ],
              },
            },
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseReactAST(ast, 'src/components/SphereRenderer.jsx', makeFileContext({ isComponent: true }), elements, foundItems);
    const site = elements.rawCallSites.find(s => s.method === '.setState()');
    expect(site).toBeDefined();
    expect(site?.caller).toBe('SphereRenderer');
    expect(site?.calleeName).toBe('useStore');
  });
});
