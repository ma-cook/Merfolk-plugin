import { describe, it, expect, vi } from 'vitest';
import path from 'path';
import fs from 'fs';

const FIXTURES = path.resolve(__dirname, '../fixtures');

describe('Merfolk Plugin E2E', () => {
  it('registers the merfolk.generate command on activation', async () => {
    const vscode = await import('../mocks/vscode');
    const { activate } = await import('../../src/extension');
    const mockContext = { subscriptions: [] as any[] };
    activate(mockContext as any);
    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      'merfolk.generate',
      expect.any(Function)
    );
  });

  it('scans react-project fixture and produces valid merfolk.md', async () => {
    const { scanWorkspace } = await import('../../src/scanner/workspaceScanner');
    const { detectRepoType } = await import('../../src/scanner/repoTypeDetector');
    const { generateMerfolkMarkdown } = await import('../../src/scanner/merfolkGenerator');

    const rootPath = path.join(FIXTURES, 'react-project');
    const files = await scanWorkspace(rootPath);
    const repoType = await detectRepoType(rootPath);
    expect(repoType).toBe('react');
    expect(files.length).toBeGreaterThan(0);
    const output = generateMerfolkMarkdown(
      {
        components: [], functions: [], hooks: [], services: [], stores: [], utilities: [],
        imports: { libraries: [] },
        componentInternalFunctions: [], componentRelationships: [], componentDependencies: [],
        fileContainers: new Map(), internalHelperComponents: [], rawCallSites: [],
        nextjsRouteMap: new Map(), internalHooks: new Map(), filesNeedingSuffix: new Set(),
      },
      'react-project',
      repoType
    );
    expect(output).toContain('```merfolk');
  });

  it('scans vue-project fixture and produces valid merfolk.md', async () => {
    const { scanWorkspace } = await import('../../src/scanner/workspaceScanner');
    const { detectRepoType } = await import('../../src/scanner/repoTypeDetector');
    const rootPath = path.join(FIXTURES, 'vue-project');
    const files = await scanWorkspace(rootPath);
    const repoType = await detectRepoType(rootPath);
    expect(repoType).toBe('vue');
    expect(files.some(f => f.path.endsWith('.vue'))).toBe(true);
  });

  it('scans python-project fixture and produces valid merfolk.md', async () => {
    const { scanWorkspace } = await import('../../src/scanner/workspaceScanner');
    const { detectRepoType } = await import('../../src/scanner/repoTypeDetector');
    const rootPath = path.join(FIXTURES, 'python-project');
    const files = await scanWorkspace(rootPath);
    const repoType = await detectRepoType(rootPath);
    expect(repoType).toBe('python');
    expect(files.some(f => f.path.endsWith('.py'))).toBe(true);
  });

  it('scans vanilla-project fixture and produces valid merfolk.md', async () => {
    const { scanWorkspace } = await import('../../src/scanner/workspaceScanner');
    const { detectRepoType } = await import('../../src/scanner/repoTypeDetector');
    const rootPath = path.join(FIXTURES, 'vanilla-project');
    const files = await scanWorkspace(rootPath);
    const repoType = await detectRepoType(rootPath);
    expect(repoType).toBe('vanilla');
    expect(files.length).toBeGreaterThan(0);
  });

  it('scans nextjs-project fixture and produces valid merfolk.md', async () => {
    const { scanWorkspace } = await import('../../src/scanner/workspaceScanner');
    const { detectRepoType } = await import('../../src/scanner/repoTypeDetector');
    const rootPath = path.join(FIXTURES, 'nextjs-project');
    const files = await scanWorkspace(rootPath);
    const repoType = await detectRepoType(rootPath);
    expect(repoType).toBe('nextjs');
    expect(files.some(f => f.path.endsWith('.tsx') || f.path.endsWith('.ts'))).toBe(true);
  });

  it('shows error notification when workspace has no source files', async () => {
    const vscode = await import('../mocks/vscode');
    const { activate } = await import('../../src/extension');
    const mockContext = { subscriptions: [] as any[] };
    activate(mockContext as any);
    // Invoke the registered generate command against an empty directory
    const registeredHandler = (vscode.commands.registerCommand as ReturnType<typeof vi.fn>).mock.calls
      .find(([cmd]: [string]) => cmd === 'merfolk.generate')?.[1];
    expect(registeredHandler).toBeDefined();
    await registeredHandler?.('/tmp/empty-e2e-workspace');
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('no source files')
    );
  });

  it('writes merfolk.md to workspace root', async () => {
    const { scanWorkspace } = await import('../../src/scanner/workspaceScanner');
    const { detectRepoType } = await import('../../src/scanner/repoTypeDetector');
    const { generateMerfolkMarkdown } = await import('../../src/scanner/merfolkGenerator');
    const rootPath = path.join(FIXTURES, 'react-project');
    const files = await scanWorkspace(rootPath);
    const repoType = await detectRepoType(rootPath);
    const output = generateMerfolkMarkdown(
      {
        components: [], functions: [], hooks: [], services: [], stores: [], utilities: [],
        imports: { libraries: [] },
        componentInternalFunctions: [], componentRelationships: [], componentDependencies: [],
        fileContainers: new Map(), internalHelperComponents: [], rawCallSites: [],
        nextjsRouteMap: new Map(), internalHooks: new Map(), filesNeedingSuffix: new Set(),
      },
      'react-project',
      repoType
    );
    const merfolkPath = path.join(rootPath, 'merfolk.md');
    fs.writeFileSync(merfolkPath, output);
    expect(fs.existsSync(merfolkPath)).toBe(true);
    fs.unlinkSync(merfolkPath);
  });
});
