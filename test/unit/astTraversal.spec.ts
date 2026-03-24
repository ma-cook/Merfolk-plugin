import { describe, it, expect } from 'vitest';
import {
  traverseVanillaAST,
  traversePythonSource,
  traverseVueSource,
  traverseReactAST,
  buildNextjsRouteMap,
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
    workers: [],
    classes: [],
    interfaces: [],
    variables: [],
    constants: [],
    imports: { libraries: [] },
    componentInternalFunctions: [],
    componentRelationships: [],
    componentDependencies: [],
    fileContainers: new Map(),
    internalHelperComponents: [],
    rawCallSites: [],
    storeUsageRelationships: new Map(),
    hookReturnValueRelationships: new Map(),
    moduleImportRelationships: new Map(),
    componentPropsRelationships: new Map(),
    nextjsRouteMap: new Map(),
    apiEndpoints: new Map(),
    dbModels: new Map(),
    authGuards: new Set(),
    authFlows: [],
    eventEmitters: new Map(),
    eventListeners: new Map(),
    errorBoundaries: new Set(),
    suspenseBoundaries: new Set(),
    errorContainment: new Map(),
    sharedInterfaces: new Map(),
    interfaceUsages: new Map(),
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

  it('populates fileContainers with function name and container type', () => {
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
    const container = elements.fileContainers.get('src/services/api.js');
    expect(container).toBeDefined();
    expect(container!.type).toBe('Service');
    expect(container!.functions.has('fetchData')).toBe(true);
    expect(container!.nodeId).toBe('api');
    expect(container!.displayName).toBe('api');
  });

  it('populates fileContainers with Hook type for hook files', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'FunctionDeclaration',
            id: { name: 'useAuth' },
            body: { type: 'BlockStatement', body: [] },
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseVanillaAST(ast, 'src/hooks/useAuth.js', makeFileContext({ isHook: true }), elements, foundItems);
    const container = elements.fileContainers.get('src/hooks/useAuth.js');
    expect(container).toBeDefined();
    expect(container!.type).toBe('Hook');
    expect(container!.functions.has('useAuth')).toBe(true);
  });

  it('tracks function call sites in non-component function bodies', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'FunctionDeclaration',
            id: { name: 'fetchData' },
            body: {
              type: 'BlockStatement',
              body: [
                {
                  type: 'ExpressionStatement',
                  expression: {
                    type: 'CallExpression',
                    callee: { type: 'Identifier', name: 'parseResponse' },
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
    traverseVanillaAST(ast, 'src/services/api.js', makeFileContext({ isService: true }), elements, foundItems);
    const site = elements.rawCallSites.find(s => s.calleeName === 'parseResponse');
    expect(site).toBeDefined();
    expect(site?.caller).toBe('fetchData');
  });

  it('tracks call sites in exported function declaration bodies', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ExportNamedDeclaration',
            declaration: {
              type: 'FunctionDeclaration',
              id: { name: 'processItems' },
              body: {
                type: 'BlockStatement',
                body: [
                  {
                    type: 'ExpressionStatement',
                    expression: {
                      type: 'CallExpression',
                      callee: { type: 'Identifier', name: 'validateItem' },
                      arguments: [],
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
    traverseVanillaAST(ast, 'src/utils/processor.js', makeFileContext({ isUtil: true }), elements, foundItems);
    const site = elements.rawCallSites.find(s => s.calleeName === 'validateItem');
    expect(site).toBeDefined();
    expect(site?.caller).toBe('processItems');
  });

  it('does NOT track call sites for component files in vanilla traversal', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'FunctionDeclaration',
            id: { name: 'MyComponent' },
            body: {
              type: 'BlockStatement',
              body: [
                {
                  type: 'ExpressionStatement',
                  expression: {
                    type: 'CallExpression',
                    callee: { type: 'Identifier', name: 'helperFn' },
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
    traverseVanillaAST(ast, 'src/components/MyComponent.jsx', makeFileContext({ isComponent: true }), elements, foundItems);
    // Component files are handled by traverseReactAST; vanilla should not duplicate
    const site = elements.rawCallSites.find(s => s.calleeName === 'helperFn');
    expect(site).toBeUndefined();
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

  it('tracks relative imports in moduleImportRelationships', () => {
    const source = 'from .helpers import format_date\nfrom ..models.user import User\n';
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traversePythonSource(source, 'services/api.py', makeFileContext({ isService: true }), elements, foundItems);
    const imports = elements.moduleImportRelationships.get('services/api.py');
    expect(imports).toBeDefined();
    expect(imports!.has('helpers')).toBe(true);
    expect(imports!.has('user')).toBe(true);
  });

  it('does NOT add relative imports to moduleImportRelationships when no relative imports', () => {
    const source = 'import os\n';
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traversePythonSource(source, 'main.py', makeFileContext(), elements, foundItems);
    expect(elements.moduleImportRelationships.has('main.py')).toBe(false);
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

  it('creates fileContainers entry for Python service files', () => {
    const source = 'def fetch_users():\n    pass\n';
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traversePythonSource(source, 'services/api.py', makeFileContext({ isService: true }), elements, foundItems);
    const container = elements.fileContainers.get('services/api.py');
    expect(container).toBeDefined();
    expect(container!.type).toBe('Service');
    expect(container!.functions.has('fetch_users')).toBe(true);
    expect(container!.nodeId).toBe('api');
  });

  it('creates fileContainers entry for Python model files with classes', () => {
    const source = 'class UserModel:\n    pass\n';
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traversePythonSource(source, 'models/user.py', makeFileContext({ isModel: true }), elements, foundItems);
    const container = elements.fileContainers.get('models/user.py');
    expect(container).toBeDefined();
    expect(container!.type).toBe('Service');
    expect(container!.functions.has('UserModel')).toBe(true);
  });

  it('creates fileContainers entry for Python utility files', () => {
    const source = 'def format_date(date):\n    pass\n';
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traversePythonSource(source, 'utils/helpers.py', makeFileContext({ isUtil: true }), elements, foundItems);
    const container = elements.fileContainers.get('utils/helpers.py');
    expect(container).toBeDefined();
    expect(container!.type).toBe('Function');
    expect(container!.functions.has('format_date')).toBe(true);
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

  it('adds componentRelationships for PascalCase child components in template', () => {
    const source = `<template><MyButton /><DataTable /></template>
<script setup></script>`;
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseVueSource(source, 'src/components/Parent.vue', makeFileContext({ isComponent: true }), elements, foundItems);
    const rel = elements.componentRelationships.find(r => r.parent === 'Parent' && r.child === 'MyButton');
    expect(rel).toBeDefined();
    expect(rel!.props).toEqual(['uses']);
    const rel2 = elements.componentRelationships.find(r => r.parent === 'Parent' && r.child === 'DataTable');
    expect(rel2).toBeDefined();
  });

  it('deduplicates repeated child component tags in template', () => {
    const source = `<template><MyButton /><MyButton /></template>
<script setup></script>`;
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseVueSource(source, 'src/components/Parent.vue', makeFileContext({ isComponent: true }), elements, foundItems);
    const rels = elements.componentRelationships.filter(r => r.parent === 'Parent' && r.child === 'MyButton');
    expect(rels.length).toBe(1);
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

  it('tracks composable calls as componentDependencies in script setup', () => {
    const source = `<template><div /></template>
<script setup>
import { useAuth } from '../composables/useAuth'
const { user, isAuthenticated } = useAuth()
</script>`;
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseVueSource(source, 'src/components/Profile.vue', makeFileContext({ isComponent: true }), elements, foundItems);
    const dep = elements.componentDependencies.find(d => d.component === 'Profile' && d.target === 'useAuth');
    expect(dep).toBeDefined();
    expect(dep!.targetNodeId).toBe('useAuth');
  });

  it('tracks multiple composable dependencies from script setup', () => {
    const source = `<template><div /></template>
<script setup>
const store = useMainStore()
const router = useRouter()
</script>`;
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseVueSource(source, 'src/components/App.vue', makeFileContext({ isComponent: true }), elements, foundItems);
    const deps = elements.componentDependencies.filter(d => d.component === 'App');
    expect(deps.some(d => d.target === 'useMainStore')).toBe(true);
    expect(deps.some(d => d.target === 'useRouter')).toBe(true);
  });

  it('does not duplicate composable dependencies', () => {
    const source = `<template><div /></template>
<script setup>
const a = useAuth()
const b = useAuth()
</script>`;
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseVueSource(source, 'src/components/Double.vue', makeFileContext({ isComponent: true }), elements, foundItems);
    const deps = elements.componentDependencies.filter(d => d.component === 'Double' && d.target === 'useAuth');
    expect(deps.length).toBe(1);
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

describe('class and interface extraction', () => {
  it('tracks class declarations in elements.classes', () => {
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
    traverseVanillaAST(ast, 'src/services/data.ts', makeFileContext({ isService: true }), elements, foundItems);
    expect(elements.classes).toContain('DataManager');
    expect(elements.services).toContain('DataManager');
  });

  it('extracts exported TypeScript interfaces into sharedInterfaces', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ExportNamedDeclaration',
            declaration: {
              type: 'TSInterfaceDeclaration',
              id: { name: 'UserProfile' },
            },
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseVanillaAST(ast, 'src/types/user.ts', makeFileContext(), elements, foundItems);
    expect(elements.interfaces).toContain('UserProfile');
    expect(elements.sharedInterfaces.has('UserProfile')).toBe(true);
    expect(elements.sharedInterfaces.get('UserProfile')?.kind).toBe('interface');
  });

  it('extracts exported TypeScript type aliases into sharedInterfaces', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ExportNamedDeclaration',
            declaration: {
              type: 'TSTypeAliasDeclaration',
              id: { name: 'Theme' },
            },
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseVanillaAST(ast, 'src/types/theme.ts', makeFileContext(), elements, foundItems);
    expect(elements.interfaces).toContain('Theme');
    expect(elements.sharedInterfaces.get('Theme')?.kind).toBe('type');
  });

  it('tracks Python classes in elements.classes', () => {
    const source = 'class ApiService:\n    pass\n';
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traversePythonSource(source, 'services/api.py', makeFileContext({ isService: true }), elements, foundItems);
    expect(elements.classes).toContain('ApiService');
  });
});

describe('event emitter detection', () => {
  it('detects EventEmitter creation in variable declarations', () => {
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
                  id: { name: 'bus' },
                  init: {
                    type: 'NewExpression',
                    callee: { name: 'EventEmitter' },
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
    traverseVanillaAST(ast, 'src/events/bus.ts', makeFileContext({ isUtil: true }), elements, foundItems);
    expect(elements.eventEmitters.has('bus')).toBe(true);
  });

  it('detects .emit() and .on() event patterns', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ExpressionStatement',
            expression: {
              type: 'CallExpression',
              callee: {
                type: 'MemberExpression',
                object: { type: 'Identifier', name: 'bus' },
                property: { type: 'Identifier', name: 'emit' },
              },
              arguments: [{ type: 'StringLiteral', value: 'userUpdated' }],
            },
          },
          {
            type: 'ExpressionStatement',
            expression: {
              type: 'CallExpression',
              callee: {
                type: 'MemberExpression',
                object: { type: 'Identifier', name: 'bus' },
                property: { type: 'Identifier', name: 'on' },
              },
              arguments: [{ type: 'StringLiteral', value: 'userUpdated' }],
            },
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseVanillaAST(ast, 'src/events/handlers.ts', makeFileContext(), elements, foundItems);
    expect(elements.eventEmitters.get('bus')?.has('userUpdated')).toBe(true);
    expect(elements.eventListeners.get('bus')?.has('userUpdated')).toBe(true);
  });
});

describe('API endpoint detection', () => {
  it('detects Express-style route registrations', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ExpressionStatement',
            expression: {
              type: 'CallExpression',
              callee: {
                type: 'MemberExpression',
                object: { type: 'Identifier', name: 'app' },
                property: { type: 'Identifier', name: 'get' },
              },
              arguments: [
                { type: 'StringLiteral', value: '/api/users' },
                { type: 'Identifier', name: 'getUsers' },
              ],
            },
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseVanillaAST(ast, 'src/routes/users.ts', makeFileContext({ isBackend: true }), elements, foundItems);
    expect(elements.apiEndpoints.has('GET /api/users')).toBe(true);
    expect(elements.apiEndpoints.get('GET /api/users')?.handlers).toContain('getUsers');
  });

  it('detects Next.js API route handler exports', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ExportNamedDeclaration',
            declaration: {
              type: 'FunctionDeclaration',
              id: { name: 'GET' },
              body: { type: 'BlockStatement', body: [] },
            },
          },
          {
            type: 'ExportNamedDeclaration',
            declaration: {
              type: 'FunctionDeclaration',
              id: { name: 'POST' },
              body: { type: 'BlockStatement', body: [] },
            },
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseReactAST(ast, 'app/api/users/route.ts', makeFileContext({ isBackend: true }), elements, foundItems);
    expect(elements.apiEndpoints.has('GET /api/users')).toBe(true);
    expect(elements.apiEndpoints.has('POST /api/users')).toBe(true);
  });

  it('detects Flask/FastAPI route decorators in Python', () => {
    const source = '@app.get("/api/users")\ndef list_users():\n    pass\n';
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traversePythonSource(source, 'routes.py', makeFileContext({ isBackend: true }), elements, foundItems);
    expect(elements.apiEndpoints.has('GET /api/users')).toBe(true);
    expect(elements.apiEndpoints.get('GET /api/users')?.handlers).toContain('list_users');
  });
});

describe('database model detection', () => {
  it('detects Mongoose Schema creation', () => {
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
                  id: { name: 'UserSchema' },
                  init: {
                    type: 'NewExpression',
                    callee: { name: 'Schema' },
                    arguments: [
                      {
                        type: 'ObjectExpression',
                        properties: [
                          { key: { name: 'name' } },
                          { key: { name: 'email' } },
                        ],
                      },
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
    traverseVanillaAST(ast, 'src/models/user.ts', makeFileContext({ isModel: true }), elements, foundItems);
    expect(elements.dbModels.has('UserSchema')).toBe(true);
    expect(elements.dbModels.get('UserSchema')?.type).toBe('mongoose');
    expect(elements.dbModels.get('UserSchema')?.fields).toContain('name');
    expect(elements.dbModels.get('UserSchema')?.fields).toContain('email');
  });

  it('detects Django model classes in Python', () => {
    const source = 'class User(models.Model):\n    name = models.CharField(max_length=100)\n    email = models.EmailField()\n';
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traversePythonSource(source, 'models/user.py', makeFileContext({ isModel: true }), elements, foundItems);
    expect(elements.dbModels.has('User')).toBe(true);
    expect(elements.dbModels.get('User')?.type).toBe('django');
    expect(elements.dbModels.get('User')?.fields).toContain('name');
    expect(elements.dbModels.get('User')?.fields).toContain('email');
  });
});

describe('auth guard detection', () => {
  it('detects passport.authenticate() pattern', () => {
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
                  id: { name: 'requireJwt' },
                  init: {
                    type: 'CallExpression',
                    callee: {
                      type: 'MemberExpression',
                      object: { type: 'Identifier', name: 'passport' },
                      property: { type: 'Identifier', name: 'authenticate' },
                    },
                    arguments: [{ type: 'StringLiteral', value: 'jwt' }],
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
    traverseVanillaAST(ast, 'src/middleware/auth.ts', makeFileContext({ isMiddleware: true }), elements, foundItems);
    expect(elements.authGuards.has('requireJwt')).toBe(true);
  });
});

describe('error boundary and suspense detection', () => {
  it('detects React error boundary class components', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ExportNamedDeclaration',
            declaration: {
              type: 'ClassDeclaration',
              id: { name: 'ErrorBoundary' },
              superClass: {
                type: 'MemberExpression',
                object: { name: 'React' },
                property: { name: 'Component' },
              },
              body: {
                type: 'ClassBody',
                body: [
                  {
                    type: 'ClassMethod',
                    key: { name: 'componentDidCatch' },
                  },
                  {
                    type: 'ClassMethod',
                    key: { name: 'render' },
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
    traverseReactAST(ast, 'src/components/ErrorBoundary.jsx', makeFileContext({ isComponent: true }), elements, foundItems);
    expect(elements.errorBoundaries.has('ErrorBoundary')).toBe(true);
    expect(elements.components).toContain('ErrorBoundary');
  });

  it('detects Suspense usage in JSX', () => {
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
                        name: { type: 'JSXIdentifier', name: 'Suspense' },
                        attributes: [
                          {
                            type: 'JSXAttribute',
                            name: { name: 'fallback' },
                          },
                        ],
                      },
                      children: [
                        {
                          type: 'JSXElement',
                          openingElement: {
                            name: { type: 'JSXIdentifier', name: 'Dashboard' },
                            attributes: [],
                          },
                          children: [],
                        },
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
    traverseReactAST(ast, 'src/components/App.jsx', makeFileContext({ isComponent: true }), elements, foundItems);
    expect(elements.suspenseBoundaries.has('App')).toBe(true);
    expect(elements.errorContainment.get('App')?.has('Dashboard')).toBe(true);
  });
});

describe('buildNextjsRouteMap', () => {
  it('builds route map from app directory file paths', () => {
    const elements = makeElements();
    const filePaths = [
      '/project/app/page.tsx',
      '/project/app/layout.tsx',
      '/project/app/dashboard/page.tsx',
      '/project/app/api/users/route.ts',
    ];
    buildNextjsRouteMap(filePaths, elements);
    expect(elements.nextjsRouteMap.size).toBe(4);

    const rootPage = elements.nextjsRouteMap.get('/project/app/page.tsx');
    expect(rootPage?.isPage).toBe(true);
    expect(rootPage?.routePath).toBe('/');

    const rootLayout = elements.nextjsRouteMap.get('/project/app/layout.tsx');
    expect(rootLayout?.isLayout).toBe(true);
    expect(rootLayout?.isAppShell).toBe(true);

    const dashboardPage = elements.nextjsRouteMap.get('/project/app/dashboard/page.tsx');
    expect(dashboardPage?.isPage).toBe(true);
    expect(dashboardPage?.routePath).toBe('/dashboard');

    const apiRoute = elements.nextjsRouteMap.get('/project/app/api/users/route.ts');
    expect(apiRoute?.isApi).toBe(true);
  });

  it('ignores non-route files', () => {
    const elements = makeElements();
    buildNextjsRouteMap(['/project/app/components/Button.tsx'], elements);
    expect(elements.nextjsRouteMap.size).toBe(0);
  });
});

describe('storeUsageRelationships tracking', () => {
  function makeComponentAST(componentName: string, body: unknown[]) {
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
                  ...body,
                  { type: 'ReturnStatement', argument: { type: 'JSXElement' } },
                ],
              },
            },
          },
        ],
      },
    };
  }

  it('tracks destructured properties from store hook call', () => {
    const ast = makeComponentAST('App', [
      {
        type: 'VariableDeclaration',
        declarations: [
          {
            type: 'VariableDeclarator',
            id: {
              type: 'ObjectPattern',
              properties: [
                { key: { name: 'objects' } },
                { key: { name: 'addObject' } },
              ],
            },
            init: {
              type: 'CallExpression',
              callee: { type: 'Identifier', name: 'useObjectsStore' },
              arguments: [],
            },
          },
        ],
      },
    ]);
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseReactAST(ast, 'src/components/App.jsx', makeFileContext({ isComponent: true }), elements, foundItems);
    const storeMap = elements.storeUsageRelationships.get('App');
    expect(storeMap).toBeDefined();
    const info = storeMap!.get('useObjectsStore');
    expect(info).toBeDefined();
    expect(info!.properties.has('objects')).toBe(true);
    expect(info!.properties.has('addObject')).toBe(true);
  });

  it('tracks selector property from useStore(state => state.x)', () => {
    const ast = makeComponentAST('App', [
      {
        type: 'VariableDeclaration',
        declarations: [
          {
            type: 'VariableDeclarator',
            id: { type: 'Identifier', name: 'selectedItem' },
            init: {
              type: 'CallExpression',
              callee: { type: 'Identifier', name: 'useObjectsStore' },
              arguments: [
                {
                  type: 'ArrowFunctionExpression',
                  body: {
                    type: 'MemberExpression',
                    object: { type: 'Identifier', name: 'state' },
                    property: { type: 'Identifier', name: 'selectedObject' },
                  },
                },
              ],
            },
          },
        ],
      },
    ]);
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseReactAST(ast, 'src/components/App.jsx', makeFileContext({ isComponent: true }), elements, foundItems);
    const storeMap = elements.storeUsageRelationships.get('App');
    expect(storeMap).toBeDefined();
    const info = storeMap!.get('useObjectsStore');
    expect(info).toBeDefined();
    expect(info!.properties.has('selectedObject')).toBe(true);
  });

  it('tracks getState() destructuring as store properties', () => {
    const ast = makeComponentAST('App', [
      {
        type: 'VariableDeclaration',
        declarations: [
          {
            type: 'VariableDeclarator',
            id: {
              type: 'ObjectPattern',
              properties: [{ key: { name: 'items' } }, { key: { name: 'count' } }],
            },
            init: {
              type: 'CallExpression',
              callee: {
                type: 'MemberExpression',
                object: { type: 'Identifier', name: 'useDataStore' },
                property: { type: 'Identifier', name: 'getState' },
              },
              arguments: [],
            },
          },
        ],
      },
    ]);
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseReactAST(ast, 'src/components/App.jsx', makeFileContext({ isComponent: true }), elements, foundItems);
    const storeMap = elements.storeUsageRelationships.get('App');
    expect(storeMap).toBeDefined();
    const info = storeMap!.get('useDataStore');
    expect(info).toBeDefined();
    expect(info!.properties.has('items')).toBe(true);
    expect(info!.properties.has('count')).toBe(true);
  });

  it('tracks setState() calls as actions in storeUsageRelationships', () => {
    const ast = makeComponentAST('App', [
      {
        type: 'ExpressionStatement',
        expression: {
          type: 'CallExpression',
          callee: {
            type: 'MemberExpression',
            object: { type: 'Identifier', name: 'useDataStore' },
            property: { type: 'Identifier', name: 'setState' },
          },
          arguments: [],
        },
      },
    ]);
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseReactAST(ast, 'src/components/App.jsx', makeFileContext({ isComponent: true }), elements, foundItems);
    const storeMap = elements.storeUsageRelationships.get('App');
    expect(storeMap).toBeDefined();
    const info = storeMap!.get('useDataStore');
    expect(info).toBeDefined();
    expect(info!.actions.has('setState')).toBe(true);
  });
});

describe('hookReturnValueRelationships tracking', () => {
  it('tracks destructured values from non-store custom hooks', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ExportNamedDeclaration',
            declaration: {
              type: 'FunctionDeclaration',
              id: { name: 'UserProfile' },
              body: {
                type: 'BlockStatement',
                body: [
                  {
                    type: 'VariableDeclaration',
                    declarations: [
                      {
                        type: 'VariableDeclarator',
                        id: {
                          type: 'ObjectPattern',
                          properties: [
                            { key: { name: 'user' } },
                            { key: { name: 'isAuthenticated' } },
                          ],
                        },
                        init: {
                          type: 'CallExpression',
                          callee: { type: 'Identifier', name: 'useAuth' },
                          arguments: [],
                        },
                      },
                    ],
                  },
                  { type: 'ReturnStatement', argument: { type: 'JSXElement' } },
                ],
              },
            },
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseReactAST(ast, 'src/components/UserProfile.jsx', makeFileContext({ isComponent: true }), elements, foundItems);
    const rvList = elements.hookReturnValueRelationships.get('UserProfile');
    expect(rvList).toBeDefined();
    const entry = rvList!.find(e => e.hook === 'useAuth');
    expect(entry).toBeDefined();
    expect(entry!.returnValues).toContain('user');
    expect(entry!.returnValues).toContain('isAuthenticated');
  });

  it('does NOT track store hooks in hookReturnValueRelationships', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ExportNamedDeclaration',
            declaration: {
              type: 'FunctionDeclaration',
              id: { name: 'App' },
              body: {
                type: 'BlockStatement',
                body: [
                  {
                    type: 'VariableDeclaration',
                    declarations: [
                      {
                        type: 'VariableDeclarator',
                        id: {
                          type: 'ObjectPattern',
                          properties: [{ key: { name: 'items' } }],
                        },
                        init: {
                          type: 'CallExpression',
                          callee: { type: 'Identifier', name: 'useItemsStore' },
                          arguments: [],
                        },
                      },
                    ],
                  },
                  { type: 'ReturnStatement', argument: { type: 'JSXElement' } },
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
    const rvList = elements.hookReturnValueRelationships.get('App');
    // Store hooks should NOT appear in hookReturnValueRelationships
    expect(rvList).toBeUndefined();
  });
});

describe('moduleImportRelationships tracking', () => {
  it('tracks relative imports as moduleImportRelationships in vanilla traversal', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ImportDeclaration',
            source: { value: './helpers' },
            specifiers: [],
          },
          {
            type: 'ImportDeclaration',
            source: { value: '../config' },
            specifiers: [],
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseVanillaAST(ast, '/src/utils/utils.ts', makeFileContext({ isUtil: true }), elements, foundItems);
    const imports = elements.moduleImportRelationships.get('/src/utils/utils.ts');
    expect(imports).toBeDefined();
    expect(imports!.has('helpers')).toBe(true);
    expect(imports!.has('config')).toBe(true);
  });

  it('does NOT track non-relative imports in moduleImportRelationships', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ImportDeclaration',
            source: { value: 'react' },
            specifiers: [],
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseVanillaAST(ast, '/src/utils/utils.ts', makeFileContext({ isUtil: true }), elements, foundItems);
    const imports = elements.moduleImportRelationships.get('/src/utils/utils.ts');
    expect(imports).toBeUndefined();
  });

  it('strips file extensions from imported basenames', () => {
    const ast = {
      type: 'File',
      program: {
        type: 'Program',
        body: [
          {
            type: 'ImportDeclaration',
            source: { value: './helpers.ts' },
            specifiers: [],
          },
        ],
      },
    };
    const elements = makeElements();
    const foundItems = makeFoundItems();
    traverseVanillaAST(ast, '/src/utils/utils.ts', makeFileContext({ isUtil: true }), elements, foundItems);
    const imports = elements.moduleImportRelationships.get('/src/utils/utils.ts');
    expect(imports).toBeDefined();
    expect(imports!.has('helpers')).toBe(true);
    expect(imports!.has('helpers.ts')).toBe(false);
  });
});
