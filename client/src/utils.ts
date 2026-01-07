import type { PuzzleBody, Clue, ClueTextPart } from './types';

// Extract circle cell indices from SVG for any puzzle
export function getCircleCells(puzzle: PuzzleBody | null): Set<number> {
  if (!puzzle || !puzzle.SVG) return new Set();
  try {
    const svg = puzzle.SVG as unknown;
    const children1 = (svg as { children?: unknown[] })?.children;
    const cellGroups = Array.isArray(children1) && children1[1] && (children1[1] as { children?: unknown[] }).children ? (children1[1] as { children?: unknown[] }).children : undefined;
    if (!Array.isArray(cellGroups)) return new Set();
    const circleIndices = new Set<number>();
    cellGroups.forEach((cell, idx) => {
      const children = (cell as { children?: unknown[] })?.children;
      if (Array.isArray(children) && children.some((el) => (el as { name?: string; })?.name === 'circle')) {
        circleIndices.add(idx);
      }
    });
    return circleIndices;
  } catch {
    return new Set();
  }
}

// Helper: Find referenced clues in clue text using regex
export function getReferencedCellIndices(clue: Clue, clues: Clue[]): number[] {
  if (!clue || !clue.text) return [];
  // Regex: match e.g. '12-Across' or '5-Down'
  const regex = /(\d+)-(Across|Down)/gi;
  const text = clue.text.map((t: ClueTextPart) => t.plain || t.formatted || '').join(' ');
  const matches = [...text.matchAll(regex)];
  const indices: number[] = [];
  matches.forEach(match => {
    const num = match[1];
    const dir = match[2];
    // Find the clue with this label and direction
    const refClue = clues.find(c => c.label === num && c.direction === dir);
    if (refClue && Array.isArray(refClue.cells)) {
      indices.push(...refClue.cells);
    }
  });
  return indices;
}

// Render clue text from ClueTextPart[]
export function renderClueText(clue?: Clue) {
  if (!clue || !clue.text) return '';
  return clue.text.map((t: ClueTextPart) => t.plain || t.formatted || '').join(' ');
}
