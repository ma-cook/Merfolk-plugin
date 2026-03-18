import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import type { ExtensionContext } from 'vscode';
import type { Elements, FoundItems } from './types';
import { scanWorkspace } from './scanner/workspaceScanner';
import { detectRepoType } from './scanner/repoTypeDetector';
import { analyzeFile } from './scanner/fileAnalyzer';
import { traverseReactAST, traverseVanillaAST, traversePythonSource, traverseVueSource } from './scanner/astTraversal';
import { generateMerfolkMarkdown } from './scanner/merfolkGenerator';

export function activate(context: ExtensionContext): void {
  const disposable = vscode.commands.registerCommand(
    'merfolk.generate',
    async (rootPath?: string) => {
      const root = rootPath ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!root) {
        vscode.window.showErrorMessage('Merfolk: no workspace folder open');
        return;
      }

      try {
        const files = await scanWorkspace(root);

        if (files.length === 0) {
          vscode.window.showErrorMessage('Merfolk: no source files found in workspace');
          return;
        }

        const repoType = await detectRepoType(root);
        const repoName = path.basename(root);

        const elements: Elements = {
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

        const foundItems: FoundItems = {
          components: new Set(),
          functions: new Set(),
          hooks: new Set(),
          services: new Set(),
          stores: new Set(),
          utilities: new Set(),
        };

        for (const file of files) {
          const fileContext = analyzeFile(file.path, repoType);
          try {
            if (file.type === 'python') {
              const source = fs.readFileSync(file.path, 'utf-8');
              traversePythonSource(source, file.path, fileContext, elements, foundItems);
            } else if (file.type === 'vue') {
              const source = fs.readFileSync(file.path, 'utf-8');
              traverseVueSource(source, file.path, fileContext, elements, foundItems);
            } else if (file.type === 'file') {
              const source = fs.readFileSync(file.path, 'utf-8');
              const { parse } = await import('@babel/parser');
              const ast = parse(source, {
                sourceType: 'module',
                plugins: ['typescript', 'jsx'],
                errorRecovery: true,
              });
              if (repoType === 'react' || repoType === 'nextjs') {
                traverseReactAST(ast, file.path, fileContext, elements, foundItems);
              } else {
                traverseVanillaAST(ast, file.path, fileContext, elements, foundItems);
              }
            }
          } catch {
            // skip files that cannot be parsed
          }
        }

        const markdown = generateMerfolkMarkdown(elements, repoName, repoType);
        const outputPath = path.join(root, 'merfolk.md');
        fs.writeFileSync(outputPath, markdown);
        vscode.window.showInformationMessage(`Merfolk: Generated merfolk.md in ${root}`);
      } catch (err) {
        vscode.window.showErrorMessage(
          `Merfolk: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate(): void {
  // cleanup is handled by VS Code disposables
}
