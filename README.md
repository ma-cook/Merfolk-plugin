# Merfolk Plugin

A VS Code extension that scans a workspace's source code and generates a `merfolk.md` file — a Merfolk DSL diagram describing the project's architecture.

## Overview

Merfolk Plugin automatically detects your project type (React, Next.js, Vue, Python, or vanilla JS/TS) and extracts components, functions, hooks, services, stores, utilities, and library imports. It then produces a structured `merfolk.md` diagram in the workspace root.

The extension registers a single command: **"Generate Merfolk Diagram"** (`merfolk.generate`), accessible from the VS Code Command Palette.

## Supported Project Types

- React
- Next.js
- Vue
- Python
- Vanilla JavaScript/TypeScript

## What It Does

1. Recursively scans workspace files (skipping `node_modules`, `.git`, `dist`, `build`, etc.)
2. Detects the repository/framework type from `package.json` dependencies, file extensions, and project structure
3. Parses source files using Babel (for JS/TS/JSX/TSX), regex (for Python), and script extraction (for Vue SFCs)
4. Extracts architectural elements: components, functions, hooks, services, stores, utilities, and library imports
5. Generates a `merfolk.md` file in the workspace root

## Local Testing

### Method 1: Extension Development Host (recommended)

This is the fastest way to test the extension without packaging it.

1. Clone the repository:
   ```bash
   git clone https://github.com/ma-cook/Merfolk-plugin.git
   cd Merfolk-plugin
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the TypeScript source:
   ```bash
   npm run build
   ```
4. Open the project in VS Code:
   ```bash
   code .
   ```
5. Press **F5** (or go to **Run → Start Debugging**) to launch the Extension Development Host.
6. In the new VS Code window that opens, open a project folder.
7. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run **"Generate Merfolk Diagram"**.
8. A `merfolk.md` file will be created in the workspace root.

### Method 2: Install as a `.vsix` package

1. Clone and build as described above.
2. Package the extension:
   ```bash
   npm run package
   ```
   This runs `npx vsce package` and produces a `.vsix` file (e.g. `merfolk-plugin-0.0.1.vsix`).
3. Install the extension into VS Code:
   ```bash
   code --install-extension merfolk-plugin-0.0.1.vsix
   ```
4. Restart VS Code, open a workspace, and run **"Generate Merfolk Diagram"** from the Command Palette.

## Running Tests

```bash
# Run the full test suite
npm test

# Run tests in watch mode
npm run test:watch
```

## Tech Stack

| Technology | Purpose |
|---|---|
| TypeScript | Primary language |
| VS Code Extension API | Extension host integration |
| `@babel/parser` | AST parsing for JS/TS/JSX/TSX files |
| Vitest | Unit and integration testing |

## License

[MIT](LICENSE)
