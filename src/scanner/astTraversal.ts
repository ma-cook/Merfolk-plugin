import type { Elements, FoundItems, FileContext, ComponentInternalFunction } from '../types';
import { containsJSX } from './fileAnalyzer';
import { parse } from '@babel/parser';

type ASTNode = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  // Class declarations always go to services (even in util context)
  if (declarationType === 'ClassDeclaration') {
    addToSet(name, foundItems.services, elements.services);
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
  if (filePath) addToFileContainer(filePath, name, fileContext, elements);
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
    return;
  }

  if (type === 'ExportNamedDeclaration') {
    const decl = node.declaration as ASTNode | undefined;
    if (!decl) return;
    const dt = decl.type as string;
    // Skip TypeScript-only declarations
    if (dt === 'TSInterfaceDeclaration' || dt === 'TSTypeAliasDeclaration' || dt === 'TSEnumDeclaration') {
      return;
    }
    if (dt === 'VariableDeclaration') {
      const decls = decl.declarations as ASTNode[] | undefined;
      if (decls) {
        for (const d of decls) {
          const name = (d.id as ASTNode | undefined)?.name as string | undefined;
          if (name) classifyName(name, 'variable', fileContext, elements, foundItems, filePath);
        }
      }
    } else {
      const name = (decl.id as ASTNode | undefined)?.name as string | undefined;
      if (name) classifyName(name, dt, fileContext, elements, foundItems, filePath);
    }
    return;
  }

  if (type === 'ExportDefaultDeclaration') {
    const decl = node.declaration as ASTNode | undefined;
    if (!decl) return;
    const dt = decl.type as string;
    if (dt === 'FunctionDeclaration' || dt === 'ClassDeclaration') {
      const name = (decl.id as ASTNode | undefined)?.name as string | undefined;
      if (name) classifyName(name, dt, fileContext, elements, foundItems, filePath);
    }
    return;
  }

  if (type === 'FunctionDeclaration') {
    const name = (node.id as ASTNode | undefined)?.name as string | undefined;
    if (name) classifyName(name, 'FunctionDeclaration', fileContext, elements, foundItems, filePath);
    return;
  }

  if (type === 'ClassDeclaration') {
    const name = (node.id as ASTNode | undefined)?.name as string | undefined;
    if (name) classifyName(name, 'ClassDeclaration', fileContext, elements, foundItems, filePath);
    return;
  }
  // ExportAllDeclaration, VariableDeclaration (CommonJS require), etc. — no-op
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

/** Walk a JSX tree and collect child component relationships. */
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
            // Custom hook dependency
            let destructured: string[] = [];
            if (idType === 'ObjectPattern') {
              const props = id.properties as ASTNode[] | undefined;
              if (props) {
                destructured = props
                  .map(p => (p.key as ASTNode)?.name as string | undefined)
                  .filter((s): s is string => typeof s === 'string');
              }
            }
            const label =
              calleeName === 'useStore'
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
  // Snapshot to detect components added in this file
  const componentsBefore = new Set(foundItems.components);
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
}

// ---------------------------------------------------------------------------
// traversePythonSource — regex-based extraction
// ---------------------------------------------------------------------------

function classifyPython(
  name: string,
  fileContext: FileContext,
  elements: Elements,
  foundItems: FoundItems
): void {
  if (fileContext.isService || fileContext.isModel) {
    addToSet(name, foundItems.services, elements.services);
  } else if (fileContext.isUtil) {
    addToSet(name, foundItems.utilities, elements.utilities);
  } else {
    addToSet(name, foundItems.functions, elements.functions);
  }
}

export function traversePythonSource(
  source: string,
  _filePath: string,
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
  }

  // Extract function definitions (def / async def), skip private and dunder
  const funcRegex = /^(?:async\s+)?def\s+(\w+)/gm;
  while ((match = funcRegex.exec(source)) !== null) {
    const name = match[1];
    if (name.startsWith('_')) continue;
    classifyPython(name, fileContext, elements, foundItems);
  }

  // Absolute imports: `import X` → add X to libraries
  const importRegex = /^import\s+(\S+)/gm;
  while ((match = importRegex.exec(source)) !== null) {
    const topMod = match[1].split('.')[0];
    if (!elements.imports.libraries.includes(topMod)) {
      elements.imports.libraries.push(topMod);
    }
  }

  // From-imports: `from X import Y` — skip relative (starts with '.'), else use top-level module
  const fromImportRegex = /^from\s+(\S+)\s+import/gm;
  while ((match = fromImportRegex.exec(source)) !== null) {
    const mod = match[1];
    if (mod.startsWith('.')) continue;
    const topMod = mod.split('.')[0];
    if (!elements.imports.libraries.includes(topMod)) {
      elements.imports.libraries.push(topMod);
    }
  }
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
      plugins: ['typescript', 'jsx'],
      errorRecovery: true,
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
    }
  }
}
