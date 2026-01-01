export type Direction = 'Across' | 'Down' | string

export interface ClueTextPart {
  plain?: string
  formatted?: string
}

export interface Clue {
  cells: number[]
  direction: Direction
  label?: string
  text?: ClueTextPart[]
  answer?: string
}

export interface ClueList {
  name: string
  clues: number[]
}

export interface Cell {
  answer?: string
  clues?: number[]
  label?: string
  type?: number
}

export interface Dimensions {
  height: number
  width: number
}

export interface PuzzleBody {
  SVG?: unknown
  board?: string
  cells: Cell[]
  clueLists: ClueList[]
  clues: Clue[]
  dimensions?: Dimensions
}

export interface PuzzleFile {
  body?: PuzzleBody[]
}
