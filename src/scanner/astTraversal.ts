import type { Elements, FoundItems, FileContext, ComponentInternalFunction, ApiEndpointInfo, DbModelInfo } from '../types';
import { containsJSX } from './fileAnalyzer';
import { parse } from '@babel/parser';

type ASTNode = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the filename stem (no directory, no extension) from a file path. */
function getFileStem(filePath: string | undefined): string {
  if (!filePath) return '';
  return filePath.replace(/\\/g, '/').split('/').pop()?.replace(/\.[^.]+$/, '') ?? '';
}

function addToSet(
  name: string,
  set: Set<string>,
  arr: string[]
): void {
  if (!set.has(name)) {
    set.add(name);
    arr.push(name);
  }
}

/** Add a function to its file container (non-component files only). */
function addToFileContainer(
  filePath: string,
  funcName: string,
  fileContext: FileContext,
  elements: Elements
): void {
  if (fileContext.isComponent) return;

  const base = filePath.replace(/\\/g, '/').split('/').pop() ?? '';
  const stem = base.replace(/\.[^.]+$/, '');
  if (!stem) return;

  let containerType: string;
  let isBackend = false;

  if (fileContext.isHook || fileContext.isComposable) {
    containerType = 'Hook';
  } else if (fileContext.isBackend) {
    containerType = 'Service';
    isBackend = true;
  } else if (fileContext.isService || fileContext.isModel) {
    containerType = 'Service';
  } else if (fileContext.isStore) {
    containerType = 'Store';
  } else {
    containerType = 'Function';
  }

  if (!elements.fileContainers.has(filePath)) {
    elements.fileContainers.set(filePath, {
      type: containerType,
      functions: new Set(),
      nodeId: stem,
      displayName: stem,
      isBackend,
    });
  }
  elements.fileContainers.get(filePath)!.functions.add(funcName);
}

function classifyName(
  name: string,
  declarationType: string,
  fileContext: FileContext,
  elements: Elements,
  foundItems: FoundItems,
  filePath?: string
): void {
  // Class declarations always go to services (even in util context) AND tracked as classes
  if (declarationType === 'ClassDeclaration') {
    addToSet(name, foundItems.services, elements.services);
    if (!elements.classes.includes(name)) elements.classes.push(name);
    if (filePath) addToFileContainer(filePath, name, fileContext, elements);
    return;
  }
  if (fileContext.isService || fileContext.isModel) {
    addToSet(name, foundItems.services, elements.services);
  } else if (fileContext.isStore) {
    addToSet(name, foundItems.stores, elements.stores);
  } else if (fileContext.isUtil) {
    addToSet(name, foundItems.utilities, elements.utilities);
  } else if (fileContext.isHook || fileContext.isComposable) {
    addToSet(name, foundItems.hooks, elements.hooks);
  } else {
    addToSet(name, foundItems.functions, elements.functions);
  }
  if (fileContext.isWorker) {
    elements.workers.push(name);
  }
  if (filePath) addToFileContainer(filePath, name, fileContext, elements);
}

// ---------------------------------------------------------------------------
// Pattern detection helpers
// ---------------------------------------------------------------------------

/** Detect `new EventEmitter()` or similar event emitter creation patterns. */
function detectEventEmitterCreation(
  name: string,
  init: ASTNode,
  elements: Elements
): void {
  if (init.type === 'NewExpression') {
    const callee = init.callee as ASTNode | undefined;
    const calleeName = callee?.name as string | undefined;
    if (calleeName === 'EventEmitter' || calleeName === 'EventTarget') {
      if (!elements.eventEmitters.has(name)) {
        elements.eventEmitters.set(name, new Set());
      }
    }
  }
}

/** Detect `.emit('event')` and `.on('event')` / `.addEventListener('event')` patterns. */
function detectEventListenerRegistration(
  expr: ASTNode,
  elements: Elements
): void {
  if (expr.type !== 'CallExpression') return;
  const callee = expr.callee as ASTNode | undefined;
  if (callee?.type !== 'MemberExpression') return;

  const obj = callee.object as ASTNode | undefined;
  const prop = callee.property as ASTNode | undefined;
  const objName = obj?.name as string | undefined;
  const method = prop?.name as string | undefined;
  if (!objName || !method) return;

  const args = expr.arguments as ASTNode[] | undefined;
  const eventName = args?.[0]?.value as string | undefined;
  if (!eventName) return;

  if (method === 'emit') {
    if (!elements.eventEmitters.has(objName)) {
      elements.eventEmitters.set(objName, new Set());
    }
    elements.eventEmitters.get(objName)!.add(eventName);
  } else if (method === 'on' || method === 'addEventListener' || method === 'addListener') {
    if (!elements.eventListeners.has(objName)) {
      elements.eventListeners.set(objName, new Set());
    }
    elements.eventListeners.get(objName)!.add(eventName);
  }
}

/** Detect Mongoose Schema / Sequelize define / Prisma-like model creation. */
function detectDbModelCreation(
  name: string,
  init: ASTNode,
  elements: Elements
): void {
  // new Schema({...}) — Mongoose
  if (init.type === 'NewExpression') {
    const callee = init.callee as ASTNode | undefined;
    const calleeName = callee?.name as string | undefined;
    if (calleeName === 'Schema') {
      const fields = extractObjectKeys(init.arguments as ASTNode[] | undefined);
      elements.dbModels.set(name, { fields, type: 'mongoose' });
      return;
    }
  }
  // sequelize.define('Name', {...})
  if (init.type === 'CallExpression') {
    const callee = init.callee as ASTNode | undefined;
    if (callee?.type === 'MemberExpression') {
      const method = (callee.property as ASTNode | undefined)?.name as string | undefined;
      if (method === 'define') {
        const args = init.arguments as ASTNode[] | undefined;
        const modelName = args?.[0]?.value as string | undefined;
        const fields = args?.[1] ? extractObjectKeys([args[1]]) : [];
        elements.dbModels.set(modelName ?? name, { fields, type: 'sequelize' });
      }
    }
  }
}

/** Extract top-level keys from the first ObjectExpression argument. */
function extractObjectKeys(args: ASTNode[] | undefined): string[] {
  if (!args || args.length === 0) return [];
  const first = args[0];
  if (first.type !== 'ObjectExpression') return [];
  const props = first.properties as ASTNode[] | undefined;
  if (!props) return [];
  return props
    .map(p => (p.key as ASTNode | undefined)?.name as string | undefined ?? (p.key as ASTNode | undefined)?.value as string | undefined)
    .filter((s): s is string => typeof s === 'string');
}

/** Detect auth guard patterns: passport.authenticate, jwt.verify, auth middleware HOCs. */
function detectAuthGuardPattern(
  name: string,
  init: ASTNode,
  elements: Elements
): void {
  if (init.type === 'CallExpression') {
    const callee = init.callee as ASTNode | undefined;
    if (callee?.type === 'MemberExpression') {
      const obj = callee.object as ASTNode | undefined;
      const prop = callee.property as ASTNode | undefined;
      const objName = obj?.name as string | undefined;
      const method = prop?.name as string | undefined;
      if (
        (objName === 'passport' && method === 'authenticate') ||
        (objName === 'jwt' && method === 'verify')
      ) {
        elements.authGuards.add(name);
      }
    }
    // Direct call: requireAuth(), withAuth(), etc.
    const calleeName = (init.callee as ASTNode | undefined)?.name as string | undefined;
    if (calleeName && /^(requireAuth|withAuth|ensureAuth|isAuthenticated|checkAuth|authGuard|protect)$/i.test(calleeName)) {
      elements.authGuards.add(name);
    }
  }
}

/** Detect Express/Fastify-style route registrations: app.get('/path', handler) */
function detectApiEndpointRegistration(
  expr: ASTNode,
  elements: Elements
): void {
  if (expr.type !== 'CallExpression') return;
  const callee = expr.callee as ASTNode | undefined;
  if (callee?.type !== 'MemberExpression') return;

  const prop = callee.property as ASTNode | undefined;
  const method = prop?.name as string | undefined;
  const httpMethods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);
  if (!method || !httpMethods.has(method)) return;

  const obj = callee.object as ASTNode | undefined;
  const objName = obj?.name as string | undefined;
  if (!objName || !(/^(app|router|server|api)$/i.test(objName))) return;

  const args = expr.arguments as ASTNode[] | undefined;
  if (!args || args.length < 2) return;

  const pathArg = args[0];
  const routePath = pathArg.value as string | undefined;
  if (!routePath || typeof routePath !== 'string') return;

  const handlers: string[] = [];
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.type === 'Identifier') {
      handlers.push(arg.name as string);
    }
  }

  const key = `${method.toUpperCase()} ${routePath}`;
  elements.apiEndpoints.set(key, {
    method: method.toUpperCase(),
    path: routePath,
    handlers,
  });
}

function processVanillaNode(
  node: ASTNode,
  fileContext: FileContext,
  elements: Elements,
  foundItems: FoundItems,
  filePath?: string
): void {
  const type = node.type as string;

  if (type === 'ImportDeclaration') {
    const src = (node.source as ASTNode | undefined)?.value as string | undefined;
    if (src && !src.startsWith('.') && !src.startsWith('/')) {
      if (!elements.imports.libraries.includes(src)) {
        elements.imports.libraries.push(src);
      }
    }
    // Track relative imports for moduleImportRelationships
    if (src && src.startsWith('.') && filePath) {
      const importedBase = src.replace(/\\/g, '/').split('/').pop() ?? '';
      const stem = importedBase.replace(/\.[^.]+$/, '') || importedBase;
      if (stem && stem !== '.') {
        if (!elements.moduleImportRelationships.has(filePath)) {
          elements.moduleImportRelationships.set(filePath, new Set());
        }
        elements.moduleImportRelationships.get(filePath)!.add(stem);
      }
    }
    return;
  }

  if (type === 'ExportNamedDeclaration') {
    const decl = node.declaration as ASTNode | undefined;
    if (!decl) return;
    const dt = decl.type as string;
    // Extract TypeScript interfaces and type aliases into sharedInterfaces
    if (dt === 'TSInterfaceDeclaration' || dt === 'TSTypeAliasDeclaration') {
      const name = (decl.id as ASTNode | undefined)?.name as string | undefined;
      if (name && filePath) {
        if (!elements.interfaces.includes(name)) elements.interfaces.push(name);
        elements.sharedInterfaces.set(name, {
          name,
          filePath,
          kind: dt === 'TSInterfaceDeclaration' ? 'interface' : 'type',
        });
      }
      return;
    }
    if (dt === 'TSEnumDeclaration') {
      return;
    }
    if (dt === 'VariableDeclaration') {
      const decls = decl.declarations as ASTNode[] | undefined;
      if (decls) {
        for (const d of decls) {
          const name = (d.id as ASTNode | undefined)?.name as string | undefined;
          if (name) {
            classifyName(name, 'variable', fileContext, elements, foundItems, filePath);
            // Detect event emitter patterns: new EventEmitter()
            const init = d.init as ASTNode | undefined;
            if (init) {
              detectEventEmitterCreation(name, init, elements);
              detectDbModelCreation(name, init, elements);
              detectAuthGuardPattern(name, init, elements);
              detectApiEndpointRegistration(init, elements);
            }
          }
        }
      }
    } else {
      const name = (decl.id as ASTNode | undefined)?.name as string | undefined;
      if (name) {
        classifyName(name, dt, fileContext, elements, foundItems, filePath);
        if (dt === 'FunctionDeclaration' && !fileContext.isComponent) {
          const body = decl.body as ASTNode | undefined;
          if (body) deepWalkForCallSites(body, name, elements, 0);
        }
        // Track exported symbols that share the file base name (need _file suffix on container)
        if (filePath) {
          const stem = getFileStem(filePath);
          if (stem && name === stem) {
            elements.filesNeedingSuffix.add(stem);
          }
        }
      }
    }
    return;
  }

  if (type === 'ExportDefaultDeclaration') {
    const decl = node.declaration as ASTNode | undefined;
    if (!decl) return;
    const dt = decl.type as string;
    if (dt === 'FunctionDeclaration' || dt === 'ClassDeclaration') {
      const name = (decl.id as ASTNode | undefined)?.name as string | undefined;
      if (name) {
        classifyName(name, dt, fileContext, elements, foundItems, filePath);
        if (dt === 'FunctionDeclaration' && !fileContext.isComponent) {
          const body = decl.body as ASTNode | undefined;
          if (body) deepWalkForCallSites(body, name, elements, 0);
        }
        // Track exported symbols that share the file base name (need _file suffix on container)
        if (filePath) {
          const stem = getFileStem(filePath);
          if (stem && name === stem) {
            elements.filesNeedingSuffix.add(stem);
          }
        }
      }
    }
    return;
  }

  if (type === 'FunctionDeclaration') {
    const name = (node.id as ASTNode | undefined)?.name as string | undefined;
    if (name) {
      classifyName(name, 'FunctionDeclaration', fileContext, elements, foundItems, filePath);
      if (!fileContext.isComponent) {
        const body = node.body as ASTNode | undefined;
        if (body) deepWalkForCallSites(body, name, elements, 0);
      }
    }
    return;
  }

  if (type === 'ClassDeclaration') {
    const name = (node.id as ASTNode | undefined)?.name as string | undefined;
    if (name) classifyName(name, 'ClassDeclaration', fileContext, elements, foundItems, filePath);
    return;
  }

  // Top-level expression statements: detect app.get(), router.post(), emitter.on(), etc.
  if (type === 'ExpressionStatement') {
    const expr = node.expression as ASTNode | undefined;
    if (expr) {
      detectApiEndpointRegistration(expr, elements);
      detectEventListenerRegistration(expr, elements);
    }
    return;
  }

  // Top-level VariableDeclaration (not exported) — detect patterns
  if (type === 'VariableDeclaration') {
    const decls = node.declarations as ASTNode[] | undefined;
    if (decls) {
      for (const d of decls) {
        const name = (d.id as ASTNode | undefined)?.name as string | undefined;
        const init = d.init as ASTNode | undefined;
        if (name && init) {
          detectEventEmitterCreation(name, init, elements);
          detectDbModelCreation(name, init, elements);
          detectAuthGuardPattern(name, init, elements);
        }
      }
    }
    return;
  }
  // ExportAllDeclaration, etc. — no-op
}

// ---------------------------------------------------------------------------
// traverseVanillaAST
// ---------------------------------------------------------------------------

export function traverseVanillaAST(
  ast: unknown,
  filePath: string,
  fileContext: FileContext,
  elements: Elements,
  foundItems: FoundItems
): void {
  const a = ast as ASTNode;
  const body = (a.program as ASTNode | undefined)?.body as ASTNode[] | undefined;
  if (!body) return;
  for (const node of body) {
    processVanillaNode(node, fileContext, elements, foundItems, filePath);
  }
}

// ---------------------------------------------------------------------------
// React component body analysis helpers
// ---------------------------------------------------------------------------

const REACT_BUILTIN_HOOKS = new Set([
  'useState', 'useEffect', 'useRef', 'useMemo', 'useCallback',
  'useContext', 'useReducer', 'useLayoutEffect', 'useImperativeHandle',
  'useDebugValue', 'useDeferredValue', 'useTransition', 'useId',
  'useInsertionEffect', 'useSyncExternalStore',
]);

function getInternalFunctionLabel(name: string, calleeName: string): string {
  const lower = name.toLowerCase();
  if (calleeName === 'useMemo') return 'render helper';
  if (lower.includes('update')) return 'update helper';
  if (lower.includes('calculate')) return 'calculation helper';
  if (lower.startsWith('get')) return 'getter function';
  const isRenderRelated = lower.includes('render') || lower.includes('animate') || lower.includes('memoized');
  if (calleeName === 'useCallback' && isRenderRelated) return 'render helper';
  return 'internal function';
}

/** Collect component names contained inside a boundary (Suspense/Error) JSX subtree. */
function collectContainedComponents(
  node: unknown,
  boundaryName: string,
  containmentMap: Map<string, Set<string>>,
  _type: string
): void {
  if (!node || typeof node !== 'object') return;
  const n = node as ASTNode;
  if (n.type === 'JSXElement') {
    const opening = n.openingElement as ASTNode | undefined;
    const nameNode = opening?.name as ASTNode | undefined;
    if ((nameNode?.type as string) === 'JSXIdentifier') {
      const childName = nameNode?.name as string | undefined;
      if (childName && /^[A-Z]/.test(childName)) {
        if (!containmentMap.has(boundaryName)) {
          containmentMap.set(boundaryName, new Set());
        }
        containmentMap.get(boundaryName)!.add(childName);
      }
    }
    const children = n.children as unknown[] | undefined;
    if (children) {
      for (const c of children) collectContainedComponents(c, boundaryName, containmentMap, _type);
    }
  }
  if (n.type === 'JSXFragment') {
    const children = n.children as unknown[] | undefined;
    if (children) {
      for (const c of children) collectContainedComponents(c, boundaryName, containmentMap, _type);
    }
  }
  if (n.type === 'JSXExpressionContainer') {
    collectContainedComponents(n.expression, boundaryName, containmentMap, _type);
  }
}

/** Walk a JSX tree and collect child component relationships, Suspense and error boundaries. */
function walkNodeForJSX(
  node: unknown,
  parentComponent: string,
  elements: Elements,
  depth: number
): void {
  if (!node || typeof node !== 'object' || depth > 25) return;
  const n = node as ASTNode;
  const nodeType = n.type as string;

  if (nodeType === 'JSXElement') {
    const opening = n.openingElement as ASTNode | undefined;
    const nameNode = opening?.name as ASTNode | undefined;
    let childName: string | undefined;
    if ((nameNode?.type as string) === 'JSXIdentifier') {
      childName = nameNode?.name as string | undefined;
    }
    if (childName && /^[A-Z]/.test(childName)) {
      // Detect Suspense boundaries
      if (childName === 'Suspense') {
        elements.suspenseBoundaries.add(parentComponent);
        // Track containment: children inside Suspense belong to this component
        const children = n.children as unknown[] | undefined;
        if (children) {
          for (const c of children) {
            collectContainedComponents(c, parentComponent, elements.errorContainment, 'suspense');
          }
        }
      }

      const attrs = opening?.attributes as ASTNode[] | undefined;
      const propNames: string[] = [];
      if (attrs) {
        for (const attr of attrs) {
          if ((attr.type as string) === 'JSXAttribute') {
            const propName = (attr.name as ASTNode)?.name as string | undefined;
            if (propName) propNames.push(propName);
          }
        }
      }
      elements.componentRelationships.push({
        parent: parentComponent,
        child: childName,
        props: propNames.length > 0 ? propNames : ['uses'],
      });
      if (propNames.length > 0) {
        if (!elements.componentPropsRelationships.has(parentComponent)) {
          elements.componentPropsRelationships.set(parentComponent, new Map());
        }
        const parentMap = elements.componentPropsRelationships.get(parentComponent)!;
        if (!parentMap.has(childName)) {
          parentMap.set(childName, new Set());
        }
        const propSet = parentMap.get(childName)!;
        for (const p of propNames) propSet.add(p);
      }
    }
    const children = n.children as unknown[] | undefined;
    if (children) {
      for (const c of children) walkNodeForJSX(c, parentComponent, elements, depth + 1);
    }
    return;
  }

  if (nodeType === 'JSXFragment') {
    const children = n.children as unknown[] | undefined;
    if (children) children.forEach(c => walkNodeForJSX(c, parentComponent, elements, depth + 1));
    return;
  }

  if (nodeType === 'JSXExpressionContainer') {
    walkNodeForJSX(n.expression, parentComponent, elements, depth + 1);
    return;
  }

  // Recurse into common statement/expression types
  const subProps = [
    'body', 'consequent', 'alternate', 'left', 'right', 'argument',
    'expression', 'callee', 'arguments', 'elements', 'properties',
    'declarations', 'init', 'object', 'property',
  ];
  for (const prop of subProps) {
    const val = (n as Record<string, unknown>)[prop];
    if (!val) continue;
    if (Array.isArray(val)) {
      for (const item of val) walkNodeForJSX(item, parentComponent, elements, depth + 1);
    } else if (typeof val === 'object' && (val as Record<string, unknown>).type) {
      walkNodeForJSX(val, parentComponent, elements, depth + 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Deep call-site traversal — finds ALL CallExpression nodes in a subtree
// and records them as RawCallSite entries (NOT deduplicated).
// ---------------------------------------------------------------------------

const SKIP_CALL_NAMES = new Set([
  // React built-ins
  'useState', 'useEffect', 'useRef', 'useMemo', 'useCallback',
  'useContext', 'useReducer', 'useLayoutEffect', 'useImperativeHandle',
  'useDebugValue', 'useDeferredValue', 'useTransition', 'useId',
  'useInsertionEffect', 'useSyncExternalStore',
  // Common noise
  'console', 'Object', 'Array', 'Math', 'JSON', 'Promise', 'Error',
  'parseInt', 'parseFloat', 'String', 'Number', 'Boolean',
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
  'require', 'import',
]);

/**
 * Recursively walk any AST node and record every CallExpression whose callee
 * refers to a user-defined function or store method.
 * Results are pushed onto elements.rawCallSites (no deduplication).
 */
function deepWalkForCallSites(
  node: unknown,
  callerName: string,
  elements: Elements,
  depth: number
): void {
  if (!node || typeof node !== 'object' || depth > 30) return;
  const n = node as ASTNode;
  const nodeType = n.type as string;

  if (!nodeType) return;

  if (nodeType === 'CallExpression') {
    const callee = n.callee as ASTNode | undefined;
    if (callee) {
      const calleeType = callee.type as string;

      if (calleeType === 'Identifier') {
        const calleeName = callee.name as string | undefined;
        if (
          calleeName &&
          !SKIP_CALL_NAMES.has(calleeName) &&
          !calleeName.startsWith('use')  // custom hooks already tracked in componentDependencies
        ) {
          elements.rawCallSites.push({ caller: callerName, calleeName });
          // Also track in functionCallRelationships for non-component callers
          if (!elements.functionCallRelationships.has(callerName)) {
            elements.functionCallRelationships.set(callerName, new Set());
          }
          elements.functionCallRelationships.get(callerName)!.add({
            target: calleeName,
            label: `calls ${calleeName}`,
            type: 'function',
          });
        }
      } else if (calleeType === 'MemberExpression') {
        const obj = callee.object as ASTNode | undefined;
        const prop = callee.property as ASTNode | undefined;
        const objName = (obj?.type as string) === 'Identifier'
          ? (obj?.name as string | undefined)
          : undefined;
        const propName = prop?.name as string | undefined;

        if (objName && (propName === 'getState' || propName === 'setState')) {
          elements.rawCallSites.push({
            caller: callerName,
            calleeName: objName,
            method: `.${propName}()`,
          });
          // Track setState calls as actions in storeUsageRelationships
          if (propName === 'setState') {
            if (!elements.storeUsageRelationships.has(callerName)) {
              elements.storeUsageRelationships.set(callerName, new Map());
            }
            const storeMap = elements.storeUsageRelationships.get(callerName)!;
            if (!storeMap.has(objName)) {
              storeMap.set(objName, { properties: new Set(), actions: new Set() });
            }
            storeMap.get(objName)!.actions.add('setState');
          }
        }
      }
    }
    // Recurse into arguments
    const args = n.arguments as unknown[] | undefined;
    if (args) {
      for (const arg of args) deepWalkForCallSites(arg, callerName, elements, depth + 1);
    }
    // Recurse into callee (for chained calls)
    deepWalkForCallSites(n.callee, callerName, elements, depth + 1);
    return;
  }

  // For function expressions / arrow functions, recurse into their body
  if (
    nodeType === 'FunctionExpression' ||
    nodeType === 'ArrowFunctionExpression' ||
    nodeType === 'FunctionDeclaration'
  ) {
    deepWalkForCallSites(n.body, callerName, elements, depth + 1);
    return;
  }

  // Recurse into child nodes
  const childProps = [
    'body', 'consequent', 'alternate', 'argument', 'expression',
    'declarations', 'init', 'test', 'update', 'block', 'handler', 'finalizer',
    'left', 'right', 'object', 'property', 'elements', 'properties',
    'params', 'cases', 'discriminant', 'value',
  ];
  for (const prop of childProps) {
    const val = (n as Record<string, unknown>)[prop];
    if (!val) continue;
    if (Array.isArray(val)) {
      for (const item of val) deepWalkForCallSites(item, callerName, elements, depth + 1);
    } else if (typeof val === 'object' && (val as Record<string, unknown>).type) {
      deepWalkForCallSites(val, callerName, elements, depth + 1);
    }
  }
}

/**
 * Extract internal functions and hook dependencies from a component body,
 * and JSX child relationships from the return path.
 */
function analyzeComponentBody(
  componentName: string,
  body: ASTNode,
  elements: Elements
): void {
  const blockBody = body.body as ASTNode[] | undefined;
  if (!Array.isArray(blockBody)) {
    // Expression body (arrow function returning JSX directly)
    walkNodeForJSX(body, componentName, elements, 0);
    return;
  }

  for (const stmt of blockBody) {
    const stmtType = stmt.type as string;

    if (stmtType === 'VariableDeclaration') {
      const decls = stmt.declarations as ASTNode[] | undefined;
      if (!decls) continue;

      for (const decl of decls) {
        const id = decl.id as ASTNode | undefined;
        if (!id) continue;
        const idType = id.type as string;

        const init = decl.init as ASTNode | undefined;
        if (!init) continue;
        const initType = init.type as string;

        if (initType === 'CallExpression') {
          const callee = init.callee as ASTNode | undefined;
          let calleeName = callee?.name as string | undefined;
          if (!calleeName && (callee?.type as string) === 'MemberExpression') {
            calleeName = (callee!.property as ASTNode)?.name as string | undefined;
          }
          if (!calleeName) continue;

          if (calleeName === 'useMemo' || calleeName === 'useCallback') {
            // Internal memoized/callback function
            if (idType === 'Identifier') {
              const varName = id.name as string | undefined;
              if (varName) {
                const prefixed = componentName.toLowerCase() +
                  varName.charAt(0).toUpperCase() + varName.slice(1);
                const label = getInternalFunctionLabel(varName, calleeName);
                elements.componentInternalFunctions.push({
                  componentName,
                  functionName: prefixed,
                  label,
                });
              }
            }
          } else if (calleeName.startsWith('use') && !REACT_BUILTIN_HOOKS.has(calleeName)) {
            // Custom hook dependency — detect if it's a store hook
            let destructured: string[] = [];
            if (idType === 'ObjectPattern') {
              const props = id.properties as ASTNode[] | undefined;
              if (props) {
                destructured = props
                  .map(p => (p.key as ASTNode)?.name as string | undefined)
                  .filter((s): s is string => typeof s === 'string');
              }
            }

            // Detect selector-pattern: useStore(state => state.x) → property 'x'
            const callArgs = init.arguments as ASTNode[] | undefined;
            const selectorProperties: string[] = [];
            if (callArgs && callArgs.length > 0) {
              const selectorArg = callArgs[0] as ASTNode;
              const selectorArgType = selectorArg.type as string;
              if (
                selectorArgType === 'ArrowFunctionExpression' ||
                selectorArgType === 'FunctionExpression'
              ) {
                const selectorBody = selectorArg.body as ASTNode | undefined;
                if (selectorBody && (selectorBody.type as string) === 'MemberExpression') {
                  const propName = (selectorBody.property as ASTNode)?.name as string | undefined;
                  if (propName) selectorProperties.push(propName);
                }
              }
            }

            // Identify store hooks: name ends with 'Store' (e.g. useStore, useObjectsStore)
            const isStoreHook = /Store$/.test(calleeName);

            if (isStoreHook) {
              // Track store property usage
              const storeProperties = [...destructured, ...selectorProperties];
              if (storeProperties.length > 0) {
                if (!elements.storeUsageRelationships.has(componentName)) {
                  elements.storeUsageRelationships.set(componentName, new Map());
                }
                const storeMap = elements.storeUsageRelationships.get(componentName)!;
                if (!storeMap.has(calleeName)) {
                  storeMap.set(calleeName, { properties: new Set(), actions: new Set() });
                }
                const storeInfo = storeMap.get(calleeName)!;
                for (const prop of storeProperties) storeInfo.properties.add(prop);
              }
            } else if (destructured.length > 0) {
              // Track hook return value destructuring
              if (!elements.hookReturnValueRelationships.has(componentName)) {
                elements.hookReturnValueRelationships.set(componentName, []);
              }
              elements.hookReturnValueRelationships.get(componentName)!.push({
                hook: calleeName,
                returnValues: destructured,
              });
            }

            const label = isStoreHook
              ? 'uses store'
              : destructured.length > 0
                ? `{${destructured.join(', ')}}`
                : 'uses hook';
            elements.componentDependencies.push({
              component: componentName,
              target: calleeName,
              targetNodeId: calleeName,
              destructured,
              label,
            });
          } else if (
            (callee?.type as string) === 'MemberExpression' &&
            (callee!.property as ASTNode)?.name === 'getState' &&
            idType === 'ObjectPattern'
          ) {
            // Detect: const { x, y } = useXxxStore.getState()
            const storeObj = (callee!.object as ASTNode | undefined);
            const storeName = storeObj?.name as string | undefined;
            if (storeName) {
              const props = id.properties as ASTNode[] | undefined;
              if (props) {
                const propsArr = props
                  .map(p => (p.key as ASTNode)?.name as string | undefined)
                  .filter((s): s is string => typeof s === 'string');
                if (propsArr.length > 0) {
                  if (!elements.storeUsageRelationships.has(componentName)) {
                    elements.storeUsageRelationships.set(componentName, new Map());
                  }
                  const storeMap = elements.storeUsageRelationships.get(componentName)!;
                  if (!storeMap.has(storeName)) {
                    storeMap.set(storeName, { properties: new Set(), actions: new Set() });
                  }
                  const storeInfo = storeMap.get(storeName)!;
                  for (const prop of propsArr) storeInfo.properties.add(prop);
                }
              }
            }
          }
        } else if (
          (initType === 'ArrowFunctionExpression' || initType === 'FunctionExpression') &&
          idType === 'Identifier'
        ) {
          const varName = id.name as string | undefined;
          if (varName && !varName.startsWith('use')) {
            const prefixed = componentName.toLowerCase() +
              varName.charAt(0).toUpperCase() + varName.slice(1);
            const label = getInternalFunctionLabel(varName, 'function');
            elements.componentInternalFunctions.push({
              componentName,
              functionName: prefixed,
              label,
            });
          }
        }
      }
    } else if (stmtType === 'FunctionDeclaration') {
      const funcName = (stmt.id as ASTNode)?.name as string | undefined;
      if (funcName && !funcName.startsWith('use')) {
        const prefixed = componentName.toLowerCase() +
          funcName.charAt(0).toUpperCase() + funcName.slice(1);
        const label = getInternalFunctionLabel(funcName, 'function');
        elements.componentInternalFunctions.push({
          componentName,
          functionName: prefixed,
          label,
        });
      }
    }
  }

  // Walk the entire body looking for JSX relationships
  for (const stmt of blockBody) {
    walkNodeForJSX(stmt, componentName, elements, 0);
  }

  // Deep walk for per-call-site function call tracking
  deepWalkForCallSites(body, componentName, elements, 0);
}

// ---------------------------------------------------------------------------
// traverseReactAST — delegates to vanilla then does a React-specific pass
// ---------------------------------------------------------------------------

function processReactDecl(
  decl: ASTNode,
  fileContext: FileContext,
  elements: Elements,
  foundItems: FoundItems
): void {
  const dt = decl.type as string;

  if (dt === 'FunctionDeclaration' || dt === 'FunctionExpression') {
    const name = (decl.id as ASTNode | undefined)?.name as string | undefined;
    const body = decl.body as unknown;
    if (name && containsJSX(body, fileContext as unknown as Record<string, unknown>)) {
      addToSet(name, foundItems.components, elements.components);
      analyzeComponentBody(name, body as ASTNode, elements);
    }
    return;
  }

  if (dt === 'VariableDeclaration') {
    const decls = decl.declarations as ASTNode[] | undefined;
    if (decls) {
      for (const d of decls) {
        const name = (d.id as ASTNode | undefined)?.name as string | undefined;
        const init = d.init as ASTNode | undefined;
        if (name && init?.type === 'ArrowFunctionExpression') {
          const arrowBody = init.body as unknown;
          if (containsJSX(arrowBody, fileContext as unknown as Record<string, unknown>)) {
            addToSet(name, foundItems.components, elements.components);
            analyzeComponentBody(name, arrowBody as ASTNode, elements);
          }
        }
      }
    }
    return;
  }

  if (dt === 'ClassDeclaration') {
    const name = (decl.id as ASTNode | undefined)?.name as string | undefined;
    const superClass = decl.superClass as ASTNode | undefined;
    if (name && superClass) {
      const superObjName = (superClass.object as ASTNode | undefined)?.name as string | undefined;
      const superPropName = (superClass.property as ASTNode | undefined)?.name as string | undefined;
      if (superObjName === 'React' && (superPropName === 'Component' || superPropName === 'PureComponent')) {
        addToSet(name, foundItems.components, elements.components);
        // Check for error boundary methods: componentDidCatch / getDerivedStateFromError
        const classBody = decl.body as ASTNode | undefined;
        const bodyItems = classBody?.body as ASTNode[] | undefined;
        if (bodyItems) {
          for (const member of bodyItems) {
            const memberKey = member.key as ASTNode | undefined;
            const memberName = memberKey?.name as string | undefined;
            if (memberName === 'componentDidCatch' || memberName === 'getDerivedStateFromError') {
              elements.errorBoundaries.add(name);
              break;
            }
          }
        }
      }
    }
    return;
  }

  if (dt === 'CallExpression') {
    const callee = decl.callee as ASTNode | undefined;
    const args = decl.arguments as ASTNode[] | undefined;

    const isMemo =
      (callee?.type === 'MemberExpression' &&
        (callee.object as ASTNode | undefined)?.name === 'React' &&
        (callee.property as ASTNode | undefined)?.name === 'memo') ||
      callee?.name === 'memo';

    const isForwardRef =
      callee?.name === 'forwardRef' ||
      (callee?.type === 'MemberExpression' &&
        (callee.property as ASTNode | undefined)?.name === 'forwardRef');

    if ((isMemo || isForwardRef) && args && args.length > 0) {
      const fn = args[0];
      const fnType = fn.type as string;
      if (fnType === 'FunctionExpression' || fnType === 'ArrowFunctionExpression') {
        const name = (fn.id as ASTNode | undefined)?.name as string | undefined;
        const body = fn.body as unknown;
        if (name && containsJSX(body, fileContext as unknown as Record<string, unknown>)) {
          addToSet(name, foundItems.components, elements.components);
          analyzeComponentBody(name, body as ASTNode, elements);
        }
      }
    }
    return;
  }
}

export function traverseReactAST(
  ast: unknown,
  filePath: string,
  fileContext: FileContext,
  elements: Elements,
  foundItems: FoundItems
): void {
  // Snapshot to detect components and hooks added in this file
  const componentsBefore = new Set(foundItems.components);
  const hooksBefore = new Set(foundItems.hooks);
  const relsBefore = elements.componentRelationships.length;

  // Base extraction via vanilla traversal
  traverseVanillaAST(ast, filePath, fileContext, elements, foundItems);

  // React-specific second pass
  const a = ast as ASTNode;
  const body = (a.program as ASTNode | undefined)?.body as ASTNode[] | undefined;
  if (!body) return;

  for (const node of body) {
    const nodeType = node.type as string;

    if (nodeType === 'ExportNamedDeclaration' || nodeType === 'ExportDefaultDeclaration') {
      const decl = node.declaration as ASTNode | undefined;
      if (decl) processReactDecl(decl, fileContext, elements, foundItems);
      continue;
    }

    if (nodeType === 'FunctionDeclaration') {
      processReactDecl(node, fileContext, elements, foundItems);
      continue;
    }

    // Top-level VariableDeclaration: detect store creation patterns
    if (nodeType === 'VariableDeclaration' && fileContext.isStore) {
      const decls = node.declarations as ASTNode[] | undefined;
      if (decls) {
        for (const d of decls) {
          const name = (d.id as ASTNode | undefined)?.name as string | undefined;
          const init = d.init as ASTNode | undefined;
          if (name && init?.type === 'CallExpression') {
            const callee = init.callee as ASTNode | undefined;
            const calleeName = callee?.name as string | undefined;
            if (calleeName === 'create' || calleeName === 'createStore' || calleeName === 'defineStore') {
              addToSet(name, foundItems.stores, elements.stores);
            }
          }
        }
      }
      continue;
    }
  }

  // Detect internal helper components: components added in this file that
  // appear in JSX relationships added in this file (both parent & child are new).
  const newComponents = [...foundItems.components].filter(c => !componentsBefore.has(c));
  if (newComponents.length >= 2) {
    const newCompSet = new Set(newComponents);
    const newRels = elements.componentRelationships.slice(relsBefore);
    const seenHelpers = new Set<string>();
    for (const rel of newRels) {
      if (
        newCompSet.has(rel.parent) &&
        newCompSet.has(rel.child) &&
        rel.parent !== rel.child
      ) {
        const key = `${rel.parent}|${rel.child}`;
        if (!seenHelpers.has(key)) {
          seenHelpers.add(key);
          elements.internalHelperComponents.push({
            parent: rel.parent,
            child: rel.child,
            label: 'internal',
          });
        }
      }
    }
  }

  // Detect hook-in-hook-file: a hook whose name matches its containing file's
  // base name (e.g. useAuth defined in useAuth.ts).  The file container must
  // use a _file suffix to avoid an ID collision with the hook node.
  // Also detect when a component file defines a hook with the same name.
  const fileStem = getFileStem(filePath);
  if (fileStem) {
    const hookAddedHere = !hooksBefore.has(fileStem) && foundItems.hooks.has(fileStem);
    if (hookAddedHere) {
      if (fileContext.isHook || fileContext.isComposable) {
        elements.filesNeedingSuffix.add(fileStem);
        elements.internalHooks.set(fileStem, { parent: fileStem, parentType: 'hook' });
      } else if (fileContext.isComponent) {
        elements.internalHooks.set(fileStem, { parent: fileStem, parentType: 'component' });
      }
    }
  }

  // Detect Next.js API route handler exports (export function GET, POST, etc.)
  if (body) {
    const httpMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
    for (const node of body) {
      const nodeType = node.type as string;
      if (nodeType === 'ExportNamedDeclaration') {
        const decl = node.declaration as ASTNode | undefined;
        if (!decl) continue;
        const declType = decl.type as string;
        let funcName: string | undefined;
        if (declType === 'FunctionDeclaration') {
          funcName = (decl.id as ASTNode | undefined)?.name as string | undefined;
        } else if (declType === 'VariableDeclaration') {
          const decls = decl.declarations as ASTNode[] | undefined;
          if (decls?.[0]) {
            funcName = (decls[0].id as ASTNode | undefined)?.name as string | undefined;
          }
        }
        if (funcName && httpMethods.has(funcName)) {
          // Derive route path from file path
          const routePath = deriveNextjsRoutePath(filePath);
          const key = `${funcName} ${routePath}`;
          elements.apiEndpoints.set(key, {
            method: funcName,
            path: routePath,
            handlers: [funcName],
          });
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Next.js route helpers
// ---------------------------------------------------------------------------

/** Derive a Next.js route path from a file system path. */
function deriveNextjsRoutePath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  // Match from app/ or pages/ directory
  const appMatch = /(?:^|\/)(app|pages)\/(.*)$/.exec(normalized);
  if (!appMatch) return '/';
  const segments = appMatch[2].split('/');
  // Remove the filename (page.tsx, route.ts, layout.tsx, etc.)
  segments.pop();
  if (segments.length === 0) return '/';
  return '/' + segments.join('/');
}

/**
 * Build a Next.js route map by scanning file paths that match app/ routing conventions.
 * Call this from extension.ts for Next.js projects.
 */
export function buildNextjsRouteMap(
  filePaths: string[],
  elements: Elements
): void {
  const routeFiles = new Set(['page.tsx', 'page.jsx', 'page.ts', 'page.js',
    'layout.tsx', 'layout.jsx', 'layout.ts', 'layout.js',
    'route.ts', 'route.js',
    'loading.tsx', 'loading.jsx', 'loading.ts', 'loading.js',
    'error.tsx', 'error.jsx', 'error.ts', 'error.js',
    'not-found.tsx', 'not-found.jsx', 'not-found.ts', 'not-found.js']);

  for (const fp of filePaths) {
    const normalized = fp.replace(/\\/g, '/');
    const appMatch = /(?:^|\/)app\/(.*)$/.exec(normalized);
    if (!appMatch) continue;

    const relativePath = appMatch[1];
    const parts = relativePath.split('/');
    const fileName = parts[parts.length - 1];
    if (!routeFiles.has(fileName)) continue;

    const routeSegments = parts.slice(0, -1);
    const routePath = '/' + routeSegments.join('/');
    const parentRoutePath = routeSegments.length > 0
      ? '/' + routeSegments.slice(0, -1).join('/')
      : '/';
    const segment = routeSegments[routeSegments.length - 1] ?? '';
    const baseName = fileName.replace(/\.[^.]+$/, '');

    const info = {
      segment,
      routePath: routePath === '/' ? '/' : routePath.replace(/\/$/, ''),
      parentRoutePath: parentRoutePath === '/' ? '/' : parentRoutePath.replace(/\/$/, ''),
      isLayout: baseName === 'layout',
      isPage: baseName === 'page',
      isLoading: baseName === 'loading',
      isError: baseName === 'error',
      isNotFound: baseName === 'not-found',
      isAppShell: routeSegments.length === 0 && baseName === 'layout',
      isDocument: false,
      isMiddleware: false,
      isApi: relativePath.includes('api/'),
      filePath: fp,
    };

    elements.nextjsRouteMap.set(fp, info);
  }
}

// ---------------------------------------------------------------------------
// traversePythonSource — regex-based extraction
// ---------------------------------------------------------------------------

function classifyPython(
  name: string,
  fileContext: FileContext,
  elements: Elements,
  foundItems: FoundItems,
  filePath: string,
): void {
  if (fileContext.isService || fileContext.isModel) {
    addToSet(name, foundItems.services, elements.services);
  } else if (fileContext.isUtil) {
    addToSet(name, foundItems.utilities, elements.utilities);
  } else {
    addToSet(name, foundItems.functions, elements.functions);
  }
  addToFileContainer(filePath, name, fileContext, elements);
}

export function traversePythonSource(
  source: string,
  filePath: string,
  fileContext: FileContext,
  elements: Elements,
  foundItems: FoundItems
): void {
  // Extract class definitions — always go to services
  const classRegex = /^class\s+(\w+)/gm;
  let match: RegExpExecArray | null;
  while ((match = classRegex.exec(source)) !== null) {
    const name = match[1];
    addToSet(name, foundItems.services, elements.services);
    if (!elements.classes.includes(name)) elements.classes.push(name);
    addToFileContainer(filePath, name, fileContext, elements);
  }

  // Detect Django/SQLAlchemy model classes
  const modelClassRegex = /^class\s+(\w+)\s*\(\s*(models\.Model|db\.Model|Base)\s*\)/gm;
  while ((match = modelClassRegex.exec(source)) !== null) {
    const modelName = match[1];
    const parentClass = match[2];
    const modelType = parentClass === 'models.Model' ? 'django'
      : parentClass === 'db.Model' ? 'sqlalchemy'
        : 'sqlalchemy';
    // Extract field names from class body (simplified)
    const fields = extractPythonModelFields(source, modelName);
    elements.dbModels.set(modelName, { fields, type: modelType });
  }

  // Detect Flask/FastAPI route decorators
  const routeDecoratorRegex = /^@(?:app|router|api)\.(get|post|put|patch|delete|route)\s*\(\s*['"]([^'"]+)['"]/gm;
  while ((match = routeDecoratorRegex.exec(source)) !== null) {
    const method = match[1] === 'route' ? 'GET' : match[1].toUpperCase();
    const routePath = match[2];
    // Find the function name on the next line
    const afterDecorator = source.slice(match.index + match[0].length);
    const funcMatch = /^\s*\)?\s*\n\s*(?:async\s+)?def\s+(\w+)/m.exec(afterDecorator);
    const handler = funcMatch ? funcMatch[1] : 'handler';
    const key = `${method} ${routePath}`;
    elements.apiEndpoints.set(key, { method, path: routePath, handlers: [handler] });
  }

  // Detect Celery task decorators
  const celeryTaskRegex = /^@(?:app|celery)\.task(?:\(.*?\))?\s*\n\s*(?:async\s+)?def\s+(\w+)/gm;
  while ((match = celeryTaskRegex.exec(source)) !== null) {
    const name = match[1];
    addToSet(name, foundItems.functions, elements.functions);
  }

  // Extract function definitions (def / async def), skip private and dunder
  const funcRegex = /^(?:async\s+)?def\s+(\w+)/gm;
  while ((match = funcRegex.exec(source)) !== null) {
    const name = match[1];
    if (name.startsWith('_')) continue;
    classifyPython(name, fileContext, elements, foundItems, filePath);
  }

  // Absolute imports: `import X` → add X to libraries
  const importRegex = /^import\s+(\S+)/gm;
  while ((match = importRegex.exec(source)) !== null) {
    const topMod = match[1].split('.')[0];
    if (!elements.imports.libraries.includes(topMod)) {
      elements.imports.libraries.push(topMod);
    }
  }

  // From-imports: `from X import Y`
  const fromImportRegex = /^from\s+(\S+)\s+import/gm;
  while ((match = fromImportRegex.exec(source)) !== null) {
    const mod = match[1];
    if (mod.startsWith('.')) {
      // Relative import → track in moduleImportRelationships
      const withoutDots = mod.replace(/^\.+/, '');
      const parts = withoutDots.split('.');
      const stem = parts[parts.length - 1] || '';
      if (stem) {
        if (!elements.moduleImportRelationships.has(filePath)) {
          elements.moduleImportRelationships.set(filePath, new Set());
        }
        elements.moduleImportRelationships.get(filePath)!.add(stem);
      }
      continue;
    }
    const topMod = mod.split('.')[0];
    if (!elements.imports.libraries.includes(topMod)) {
      elements.imports.libraries.push(topMod);
    }
  }
}

/** Extract field names from a Python model class body (simplified heuristic). */
function extractPythonModelFields(source: string, className: string): string[] {
  const classStart = source.indexOf(`class ${className}`);
  if (classStart === -1) return [];
  const afterClass = source.slice(classStart);
  // Find indented lines until next class/def at same level
  const lines = afterClass.split('\n').slice(1);
  const fields: string[] = [];
  for (const line of lines) {
    if (/^\S/.test(line) && line.trim().length > 0) break; // Reached next top-level definition
    const fieldMatch = /^\s+(\w+)\s*=\s*(?:models\.\w+|db\.Column|Column)/.exec(line);
    if (fieldMatch) {
      fields.push(fieldMatch[1]);
    }
  }
  return fields;
}

// ---------------------------------------------------------------------------
// traverseVueSource — handles .vue SFCs and delegates JS to traverseVanillaAST
// ---------------------------------------------------------------------------

function parseJS(
  source: string,
  filePath: string,
  fileContext: FileContext,
  elements: Elements,
  foundItems: FoundItems
): void {
  try {
    const ast = parse(source, {
      sourceType: 'module',
      plugins: [
        'jsx',
        'typescript',
        'decorators-legacy',
        'classProperties',
        'classPrivateProperties',
        'classPrivateMethods',
        'exportDefaultFrom',
        'exportNamespaceFrom',
        'dynamicImport',
        'nullishCoalescingOperator',
        'optionalChaining',
        'objectRestSpread',
        'asyncGenerators',
        'functionBind',
        'functionSent',
        'numericSeparator',
        'optionalCatchBinding',
        'throwExpressions',
        'topLevelAwait',
      ],
      errorRecovery: true,
      allowImportExportEverywhere: true,
      allowAwaitOutsideFunction: true,
      allowReturnOutsideFunction: true,
      allowSuperOutsideMethod: true,
      allowUndeclaredExports: true,
    });
    traverseVanillaAST(ast, filePath, fileContext, elements, foundItems);
  } catch {
    // silently ignore parse errors
  }
}

export function traverseVueSource(
  source: string,
  filePath: string,
  fileContext: FileContext,
  elements: Elements,
  foundItems: FoundItems
): void {
  const isVueFile = filePath.endsWith('.vue');

  if (!isVueFile) {
    // Non-.vue file (e.g. composable .js/.ts): parse as JS directly
    parseJS(source, filePath, fileContext, elements, foundItems);
    return;
  }

  // Determine component name: prefer `name: 'Xxx'` in script, fall back to filename
  let componentName: string | null = null;
  const nameMatch = /name:\s*['"](\w+)['"]/m.exec(source);
  if (nameMatch) {
    componentName = nameMatch[1];
  } else {
    const base = filePath.split('/').pop() ?? filePath;
    const stem = base.replace(/\.vue$/, '');
    if (stem.length > 0) {
      componentName = stem.charAt(0).toUpperCase() + stem.slice(1);
    }
  }

  if (componentName) {
    addToSet(componentName, foundItems.components, elements.components);
  }

  // Extract and process <script> or <script setup> content
  const scriptMatch = /<script(?:[^>]*)>([\s\S]*?)<\/script[^>]*>/i.exec(source);
  if (scriptMatch) {
    const scriptContent = scriptMatch[1].trim();
    if (scriptContent) {
      parseJS(scriptContent, filePath, fileContext, elements, foundItems);

      // Track composable/hook dependencies from script setup
      if (componentName) {
        const composableRegex = /\b(use[A-Z]\w*)\s*\(/g;
        let composableMatch: RegExpExecArray | null;
        const seenComposables = new Set<string>();
        while ((composableMatch = composableRegex.exec(scriptContent)) !== null) {
          const calleeName = composableMatch[1];
          if (!REACT_BUILTIN_HOOKS.has(calleeName) && !seenComposables.has(calleeName)) {
            seenComposables.add(calleeName);
            elements.componentDependencies.push({
              component: componentName,
              target: calleeName,
              targetNodeId: calleeName,
              destructured: [],
              label: 'uses',
            });
          }
        }
      }
    }
  }

  // Scan template for PascalCase child component usage → componentRelationships
  const templateMatch = /<template[^>]*>([\s\S]*?)<\/template>/i.exec(source);
  if (templateMatch && componentName) {
    const templateContent = templateMatch[1];
    const componentTagRegex = /<([A-Z][a-zA-Z0-9]*)\s*[\s/>"]/g;
    let tagMatch: RegExpExecArray | null;
    const seenChildren = new Set<string>();
    while ((tagMatch = componentTagRegex.exec(templateContent)) !== null) {
      const childName = tagMatch[1];
      if (!seenChildren.has(childName)) {
        seenChildren.add(childName);
        elements.componentRelationships.push({
          parent: componentName,
          child: childName,
          props: ['uses'],
        });
      }
    }
  }
}

/**
 * Extract shader symbols (uniforms and function definitions) from a GLSL/WGSL/HLSL
 * source file using regex. Skips Babel parsing entirely.
 */
export function extractShaderSymbols(
  source: string,
  filePath: string,
  fileContext: FileContext,
  elements: Elements,
  foundItems: FoundItems
): void {
  // Extract uniform declarations: uniform type name; (GLSL/HLSL)
  const uniformRegex = /\buniform\s+\w+\s+(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = uniformRegex.exec(source)) !== null) {
    const name = match[1];
    if (!elements.shaders.includes(name)) {
      elements.shaders.push(name);
    }
    addToFileContainer(filePath, name, fileContext, elements);
  }

  // Extract GLSL/HLSL function definitions: returnType name(params) {
  // Covers GLSL types (vec2/3/4, mat2/3/4, sampler*) and common HLSL types (float2-4, Texture2D, etc.)
  const glslHlslFuncRegex = /\b(?:void|float[234]?|double|vec[234]|dvec[234]|ivec[234]|uvec[234]|bvec[234]|mat[234](?:x[234])?|int|uint|bool|sampler\w*|Texture\w*|SamplerState\w*)\s+(\w+)\s*\(/g;
  while ((match = glslHlslFuncRegex.exec(source)) !== null) {
    const name = match[1];
    if (name === 'main') continue; // skip main entry point
    if (!elements.shaders.includes(name)) {
      elements.shaders.push(name);
    }
    addToFileContainer(filePath, name, fileContext, elements);
  }

  // Extract WGSL function definitions: fn name(params)
  const wgslFuncRegex = /\bfn\s+(\w+)\s*\(/g;
  while ((match = wgslFuncRegex.exec(source)) !== null) {
    const name = match[1];
    if (name === 'main') continue;
    if (!elements.shaders.includes(name)) {
      elements.shaders.push(name);
    }
    addToFileContainer(filePath, name, fileContext, elements);
  }

  // Group all shader symbols under a shared "shaders" container node
  const shaderContainerName = 'shaders';
  if (!elements.fileContainers.has(shaderContainerName)) {
    elements.fileContainers.set(shaderContainerName, {
      type: 'Function',
      functions: new Set(),
      nodeId: shaderContainerName,
      displayName: shaderContainerName,
      isBackend: false,
    });
  }
  const container = elements.fileContainers.get(shaderContainerName)!;
  for (const name of elements.shaders) {
    container.functions.add(name);
  }

  // foundItems is included for API consistency with other traversal functions
  void foundItems;
}
