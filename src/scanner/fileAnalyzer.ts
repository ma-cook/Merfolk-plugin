import type { FileContext } from '../types';

export function analyzeFile(filePath: string, repoType = 'react'): FileContext {
  const isComponent =
    /(?:^|\/)components\//.test(filePath) ||
    filePath.endsWith('/App.jsx') ||
    filePath === 'App.jsx';
  const isHook = /(?:^|\/)hooks\//.test(filePath);
  const isService = /(?:^|\/)services\//.test(filePath);
  const isStore = /(?:^|\/)stores\//.test(filePath) || /(?:^|\/)store\//.test(filePath);
  const isUtil =
    /(?:^|\/)utils\//.test(filePath) ||
    /(?:^|\/)helpers\//.test(filePath) ||
    /(?:^|\/)lib\//.test(filePath);
  const isWorker =
    /(?:^|\/)workers\//.test(filePath) || /[Ww]orker\.(js|ts|jsx|tsx)$/.test(filePath);
  const isShader =
    /(?:^|\/)shaders\//.test(filePath) ||
    /\.(glsl|wgsl|hlsl|vert|frag|comp)$/.test(filePath);
  const isBackend =
    /(?:^|\/)functions\//.test(filePath) ||
    /(?:^|\/)api\//.test(filePath) ||
    /(?:^|\/)server\//.test(filePath) ||
    /(?:^|\/)backend\//.test(filePath) ||
    /(?:^|\/)lambda\//.test(filePath) ||
    /(?:^|\/)routes\//.test(filePath);
  const isNextRoute =
    repoType === 'nextjs' &&
    /(?:^|\/)(?:app|pages)\//.test(filePath) &&
    !isBackend &&
    !isComponent &&
    !isHook &&
    !isService &&
    !isStore &&
    !isUtil &&
    !isWorker;
  const isModel = /(?:^|\/)models\//.test(filePath);
  const isView = /(?:^|\/)views\//.test(filePath) || /(?:^|\/)templates\//.test(filePath);
  const isController =
    /(?:^|\/)controllers\//.test(filePath) || /(?:^|\/)handlers\//.test(filePath);
  const isMiddleware = /(?:^|\/)middleware\//.test(filePath);
  const isConfig = /(?:^|\/)config\//.test(filePath) || /(?:^|\/)settings\//.test(filePath);
  const isMigration =
    /(?:^|\/)migrations\//.test(filePath) || /(?:^|\/)alembic\//.test(filePath);
  const isCommand =
    /(?:^|\/)commands\//.test(filePath) || /(?:^|\/)management\//.test(filePath);
  const isSerializer =
    /(?:^|\/)serializers\//.test(filePath) || /(?:^|\/)schemas\//.test(filePath);
  const isTask = /(?:^|\/)tasks\//.test(filePath) || /(?:^|\/)celery\//.test(filePath);
  const isComposable = /(?:^|\/)composables?\//.test(filePath);
  const isPlugin = /(?:^|\/)plugins?\//.test(filePath);
  const isDirective = /(?:^|\/)directives?\//.test(filePath);
  const isMixin = /(?:^|\/)mixins?\//.test(filePath);
  const isLayout = /(?:^|\/)layouts?\//.test(filePath);
  const isPage = /(?:^|\/)pages?\//.test(filePath) || /(?:^|\/)views?\//.test(filePath);
  const isRouter = /(?:^|\/)router\//.test(filePath);

  return {
    isComponent, isHook, isService, isStore, isUtil, isWorker, isShader, isBackend, isNextRoute,
    isModel, isView, isController, isMiddleware, isConfig, isMigration, isCommand, isSerializer,
    isTask, isComposable, isPlugin, isDirective, isMixin, isLayout, isPage, isRouter,
  };
}

type ASTNode = Record<string, unknown>;

export function containsJSX(node: unknown, fileContext: Record<string, unknown> = {}): boolean {
  if (!node) return false;
  const n = node as ASTNode;
  if (n.type === 'JSXElement' || n.type === 'JSXFragment') return true;
  if (n.type === 'ReturnStatement' && n.argument) {
    return containsJSX(n.argument, fileContext);
  }
  if (n.type === 'BlockStatement' && Array.isArray(n.body)) {
    return (n.body as unknown[]).some((stmt) => containsJSX(stmt, fileContext));
  }
  if (n.type === 'IfStatement') {
    return (
      containsJSX(n.consequent, fileContext) ||
      !!(n.alternate && containsJSX(n.alternate, fileContext))
    );
  }
  if (n.type === 'ConditionalExpression') {
    return containsJSX(n.consequent, fileContext) || containsJSX(n.alternate, fileContext);
  }
  if (n.type === 'LogicalExpression') {
    return containsJSX(n.left, fileContext) || containsJSX(n.right, fileContext);
  }
  if (n.type === 'CallExpression') {
    const callee = n.callee as ASTNode | undefined;
    const args = n.arguments as unknown[] | undefined;
    const calleePropName = (callee?.property as ASTNode | undefined)?.name as string | undefined;
    const calleeObjName = (callee?.object as ASTNode | undefined)?.name as string | undefined;
    const calleeName = callee?.name as string | undefined;

    if (calleePropName === 'map' || calleePropName === 'filter' || calleePropName === 'reduce') {
      if (args && args[0]) {
        return containsJSX(args[0], fileContext);
      }
    }
    if (calleeName === 'createElement' || calleeObjName === 'React') {
      return true;
    }
    if (calleeName === 'forwardRef' || calleePropName === 'forwardRef') {
      return true;
    }
    if (calleeName === 'memo' && args && args[0]) {
      return containsJSX(args[0], fileContext);
    }
  }
  if (n.type === 'ArrowFunctionExpression') {
    return containsJSX(n.body, fileContext);
  }
  if (n.type === 'FunctionExpression') {
    return containsJSX(n.body, fileContext);
  }
  if (fileContext.isComponent && n.type === 'Identifier') {
    if (n.name === 'children') return true;
  }
  if (fileContext.isComponent && n.type === 'MemberExpression') {
    if ((n.property as ASTNode | undefined)?.name === 'children') return true;
  }
  if (n.type === 'NullLiteral' && fileContext.isComponent) {
    return true;
  }
  return false;
}
