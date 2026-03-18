import type { Elements, FoundItems, FileContext } from '../types';
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

function classifyName(
  name: string,
  declarationType: string,
  fileContext: FileContext,
  elements: Elements,
  foundItems: FoundItems
): void {
  // Class declarations always go to services (even in util context)
  if (declarationType === 'ClassDeclaration') {
    addToSet(name, foundItems.services, elements.services);
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
}

function processVanillaNode(
  node: ASTNode,
  fileContext: FileContext,
  elements: Elements,
  foundItems: FoundItems
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
          if (name) classifyName(name, 'variable', fileContext, elements, foundItems);
        }
      }
    } else {
      const name = (decl.id as ASTNode | undefined)?.name as string | undefined;
      if (name) classifyName(name, dt, fileContext, elements, foundItems);
    }
    return;
  }

  if (type === 'ExportDefaultDeclaration') {
    const decl = node.declaration as ASTNode | undefined;
    if (!decl) return;
    const dt = decl.type as string;
    if (dt === 'FunctionDeclaration' || dt === 'ClassDeclaration') {
      const name = (decl.id as ASTNode | undefined)?.name as string | undefined;
      if (name) classifyName(name, dt, fileContext, elements, foundItems);
    }
    return;
  }

  if (type === 'FunctionDeclaration') {
    const name = (node.id as ASTNode | undefined)?.name as string | undefined;
    if (name) classifyName(name, 'FunctionDeclaration', fileContext, elements, foundItems);
    return;
  }

  if (type === 'ClassDeclaration') {
    const name = (node.id as ASTNode | undefined)?.name as string | undefined;
    if (name) classifyName(name, 'ClassDeclaration', fileContext, elements, foundItems);
    return;
  }
  // ExportAllDeclaration, VariableDeclaration (CommonJS require), etc. — no-op
}

// ---------------------------------------------------------------------------
// traverseVanillaAST
// ---------------------------------------------------------------------------

export function traverseVanillaAST(
  ast: unknown,
  _filePath: string,
  fileContext: FileContext,
  elements: Elements,
  foundItems: FoundItems
): void {
  const a = ast as ASTNode;
  const body = (a.program as ASTNode | undefined)?.body as ASTNode[] | undefined;
  if (!body) return;
  for (const node of body) {
    processVanillaNode(node, fileContext, elements, foundItems);
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
          if (containsJSX(init.body as unknown, fileContext as unknown as Record<string, unknown>)) {
            addToSet(name, foundItems.components, elements.components);
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
