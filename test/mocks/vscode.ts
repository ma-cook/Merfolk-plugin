import { vi } from 'vitest';

export const workspace = {
  findFiles: vi.fn().mockResolvedValue([]),
  workspaceFolders: [
    {
      uri: { fsPath: '/mock/workspace' },
      name: 'mock-workspace',
      index: 0,
    },
  ],
};

export const window = {
  showInformationMessage: vi.fn(),
  showErrorMessage: vi.fn(),
};

export const commands = {
  registerCommand: vi.fn(),
};

export const Uri = {
  file: (path: string) => ({ fsPath: path, path }),
};
