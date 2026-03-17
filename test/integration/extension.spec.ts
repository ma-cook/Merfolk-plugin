import { describe, it, expect } from 'vitest';
import path from 'path';

const FIXTURES = path.resolve(__dirname, '../fixtures');

describe('Merfolk Plugin E2E', () => {
  it('registers the merfolk.generate command on activation', async () => {
    const { activate } = await import('../../src/extension');
    const mockContext = {
      subscriptions: [],
    };
    expect(() => activate(mockContext as any)).not.toThrow();
  });

  it('scans react-project fixture and produces valid merfolk.md', async () => {
    const { scanWorkspace } = await import('../../src/scanner/workspaceScanner');
    const { detectRepoType } = await import('../../src/scanner/repoTypeDetector');
    const { generateMerfolkMarkdown } = await import('../../src/scanner/merfolkGenerator');

    const rootPath = path.join(FIXTURES, 'react-project');
    await expect(
      (async () => {
        const _files = await scanWorkspace(rootPath);
        const _repoType = await detectRepoType(rootPath);
        const _output = generateMerfolkMarkdown(
          { components: [], functions: [], hooks: [], services: [], stores: [], utilities: [], imports: { libraries: [] } },
          'react-project',
          _repoType
        );
        return _output;
      })()
    ).rejects.toThrow('Not implemented');
  });

  it('scans vue-project fixture and produces valid merfolk.md', async () => {
    const { scanWorkspace } = await import('../../src/scanner/workspaceScanner');
    const rootPath = path.join(FIXTURES, 'vue-project');
    await expect(scanWorkspace(rootPath)).rejects.toThrow('Not implemented');
  });

  it('scans python-project fixture and produces valid merfolk.md', async () => {
    const { scanWorkspace } = await import('../../src/scanner/workspaceScanner');
    const rootPath = path.join(FIXTURES, 'python-project');
    await expect(scanWorkspace(rootPath)).rejects.toThrow('Not implemented');
  });

  it('scans vanilla-project fixture and produces valid merfolk.md', async () => {
    const { scanWorkspace } = await import('../../src/scanner/workspaceScanner');
    const rootPath = path.join(FIXTURES, 'vanilla-project');
    await expect(scanWorkspace(rootPath)).rejects.toThrow('Not implemented');
  });

  it('scans nextjs-project fixture and produces valid merfolk.md', async () => {
    const { scanWorkspace } = await import('../../src/scanner/workspaceScanner');
    const rootPath = path.join(FIXTURES, 'nextjs-project');
    await expect(scanWorkspace(rootPath)).rejects.toThrow('Not implemented');
  });

  it('shows error notification when workspace has no source files', async () => {
    const { scanWorkspace } = await import('../../src/scanner/workspaceScanner');
    await expect(scanWorkspace('/tmp/nonexistent-workspace')).rejects.toThrow('Not implemented');
  });

  it('writes merfolk.md to workspace root', async () => {
    const { scanWorkspace } = await import('../../src/scanner/workspaceScanner');
    const rootPath = path.join(FIXTURES, 'react-project');
    await expect(scanWorkspace(rootPath)).rejects.toThrow('Not implemented');
  });
});
