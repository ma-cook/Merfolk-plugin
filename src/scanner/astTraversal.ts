import type { Elements, FoundItems, FileContext } from '../types';

export function traverseReactAST(
  _ast: unknown,
  _filePath: string,
  _fileContext: FileContext,
  _elements: Elements,
  _foundItems: FoundItems
): void {
  throw new Error('Not implemented');
}

export function traverseVanillaAST(
  _ast: unknown,
  _filePath: string,
  _fileContext: FileContext,
  _elements: Elements,
  _foundItems: FoundItems
): void {
  throw new Error('Not implemented');
}

export function traversePythonSource(
  _source: string,
  _filePath: string,
  _fileContext: FileContext,
  _elements: Elements,
  _foundItems: FoundItems
): void {
  throw new Error('Not implemented');
}

export function traverseVueSource(
  _source: string,
  _filePath: string,
  _fileContext: FileContext,
  _elements: Elements,
  _foundItems: FoundItems
): void {
  throw new Error('Not implemented');
}
