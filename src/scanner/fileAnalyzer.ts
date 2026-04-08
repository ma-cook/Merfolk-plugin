import type { FileContext } from '../types';

export function analyzeFile(filePath: string, repoType = 'react'): FileContext {
  // Normalize to forward slashes so regex patterns work on Windows paths too
  const fp = filePath.replace(/\\/g, '/');
  const isComponent =
    /(?:^|\/)components\//.test(fp) ||
    /(?:^|\/)App\.(jsx?|tsx?)$/.test(fp) ||
    /(?:^|\/)landing\//.test(fp) ||
    /(?:^|\/)screens\//.test(fp) ||
    fp === 'App.jsx' ||
    fp === 'App.tsx';
  const isHook = /(?:^|\/)hooks\//.test(fp);
  const isService = /(?:^|\/)services\//.test(fp);
  const isStore = /(?:^|\/)stores\//.test(fp) || /(?:^|\/)store\//.test(fp);
  const isUtil =
    /(?:^|\/)utils\//.test(fp) ||
    /(?:^|\/)helpers\//.test(fp) ||
    /(?:^|\/)lib\//.test(fp);
  const isWorker =
    /(?:^|\/)workers\//.test(fp) || /[Ww]orker\.(js|ts|jsx|tsx)$/.test(fp);
  const isShader =
    /(?:^|\/)shaders\//.test(fp) ||
    /\.(glsl|wgsl|hlsl|vert|frag|comp)$/.test(fp);
  const isBackend =
    /(?:^|\/)functions\//.test(fp) ||
    /(?:^|\/)api\//.test(fp) ||
    /(?:^|\/)server\//.test(fp) ||
    /(?:^|\/)backend\//.test(fp) ||
    /(?:^|\/)lambda\//.test(fp) ||
    /(?:^|\/)routes\//.test(fp);
  const isNextRoute =
    repoType === 'nextjs' &&
    /(?:^|\/)(?:app|pages)\//.test(fp) &&
    !isBackend &&
    !isComponent &&
    !isHook &&
    !isService &&
    !isStore &&
    !isUtil &&
    !isWorker;
  const isModel = /(?:^|\/)models\//.test(fp);
  const isView = /(?:^|\/)views\//.test(fp) || /(?:^|\/)templates\//.test(fp);
  const isController =
    /(?:^|\/)controllers\//.test(fp) || /(?:^|\/)handlers\//.test(fp);
  const isMiddleware = /(?:^|\/)middleware\//.test(fp);
  const isConfig = /(?:^|\/)config\//.test(fp) || /(?:^|\/)settings\//.test(fp);
  const isMigration =
    /(?:^|\/)migrations\//.test(fp) || /(?:^|\/)alembic\//.test(fp);
  const isCommand =
    /(?:^|\/)commands\//.test(fp) || /(?:^|\/)management\//.test(fp);
  const isSerializer =
    /(?:^|\/)serializers\//.test(fp) || /(?:^|\/)schemas\//.test(fp);
  const isTask = /(?:^|\/)tasks\//.test(fp) || /(?:^|\/)celery\//.test(fp);
  const isComposable = /(?:^|\/)composables?\//.test(fp);
  const isPlugin = /(?:^|\/)plugins?\//.test(fp);
  const isDirective = /(?:^|\/)directives?\//.test(fp);
  const isMixin = /(?:^|\/)mixins?\//.test(fp);
  const isLayout = /(?:^|\/)layouts?\//.test(fp);
  const isPage = /(?:^|\/)pages?\//.test(fp) || /(?:^|\/)views?\//.test(fp);
  const isRouter = /(?:^|\/)router\//.test(fp);

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
