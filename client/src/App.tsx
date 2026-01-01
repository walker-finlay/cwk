import React, { useEffect, useRef, useState } from 'react'
import './App.css'
import type { PuzzleBody, Clue, ClueList, Cell, ClueTextPart, PuzzleFile } from './types'

function App() {
  const [puzzle, setPuzzle] = useState<PuzzleBody | null>(null)
  const [grid, setGrid] = useState<string[]>([])
  const [reveal, setReveal] = useState(false)

  const [clueLists, setClueLists] = useState<ClueList[]>([])
  const [clues, setClues] = useState<Clue[]>([])

  const [rebus, setRebus] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
  const [activeClueIndex, setActiveClueIndex] = useState<number | null>(null)

  const inputRefs = useRef<Array<HTMLInputElement | null>>([])
  const clueRefs = useRef<Array<HTMLDivElement | null>>([])

  useEffect(() => {
    import('../puzzles/2026-01-01.json').then((mod) => {
      const p = ((mod as { default?: PuzzleFile }).default || mod) as PuzzleFile
      const body = p.body && p.body[0]
      setPuzzle(body || null)
      if (body && body.cells) {
        setGrid(Array(body.cells.length).fill(''))
      }
      if (body) {
        setClueLists(body.clueLists || [])
        setClues(body.clues || [])
      }
    })
  }, [])

  // make sure rebus cell font sizes are adjusted when rebus or grid change
  useEffect(() => {
    function adjustFontSizeLocal(i: number) {
      const el = inputRefs.current[i]
      if (!el) return
      const val = grid[i] || ''
      const len = val.length
      if (!rebus) {
        el.style.fontSize = ''
        return
      }
      // base size for one character
      let size = 18
      if (len <= 1) size = 18
      else {
        // decrease font by ~2px per extra char, clamp to 10px
        size = Math.max(10, Math.floor(18 - (len - 1) * 2))
      }
      el.style.fontSize = `${size}px`
    }

    if (rebus) {
      grid.forEach((_, idx) => adjustFontSizeLocal(idx))
    } else {
      grid.forEach((_, idx) => {
        const el = inputRefs.current[idx]
        if (el) el.style.fontSize = ''
      })
    }
  }, [rebus, grid])
  if (!puzzle) return <div className="App">Loading puzzle…</div>

  const cells = puzzle.cells as Cell[]
  const size = Math.round(Math.sqrt(cells.length))

  function isBlack(i: number) {
    const c = cells[i]
    return !c || Object.keys(c).length === 0 || !c.answer
  }

  function handleChange(i: number, val: string) {
    if (rebus) {
      // allow multi-character entries, uppercase all, limit to 10 chars
      val = (val || '').toUpperCase().slice(0, 10)
    } else {
      val = (val || '').toUpperCase().slice(0, 1)
    }

    setGrid((prev) => {
      const next = [...prev]
      next[i] = val
      return next
    })

    if (rebus) {
      // adjust font size so the entry fits the cell
      setTimeout(() => adjustFontSize(i), 0)
      return // do not auto-advance in rebus mode
    }

    // auto-advance when typing a letter, but only within the current clue
    if (val) {
      const currentClue = activeClueIndex !== null ? clues[activeClueIndex] : null
      if (currentClue && currentClue.cells) {
        const seq = currentClue.cells
        const pos = seq.indexOf(i)
        // only advance if we're inside the clue and not at the final cell
        if (pos >= 0 && pos < seq.length - 1) {
          focusIndex(seq[pos + 1])
          return
        }
      }
      // Do not auto-advance into the next word — stay on last cell if at end
    }
  }

  function adjustFontSize(i: number) {
    const el = inputRefs.current[i]
    if (!el) return
    const val = grid[i] || ''
    const len = val.length
    if (!rebus) {
      el.style.fontSize = ''
      return
    }
    // base size for one character
    let size = 18
    if (len <= 1) size = 18
    else {
      // decrease font by ~2px per extra char, clamp to 10px
      size = Math.max(10, Math.floor(18 - (len - 1) * 2))
    }
    el.style.fontSize = `${size}px`
  }

  function setActiveClueByCell(i: number, preferDirection?: 'Across' | 'Down') {
    if (!clues || clues.length === 0) return
    let found = -1
    if (preferDirection) {
      found = clues.findIndex((c) => c.direction === preferDirection && c.cells && c.cells.includes(i))
    }
    if (found === -1) {
      found = clues.findIndex((c) => c.cells && c.cells.includes(i))
    }
    const final = found === -1 ? null : found
    setActiveClueIndex(final)

    // scroll the clue into view if possible
    if (final !== null && clueRefs.current && clueRefs.current[final]) {
      try {
        clueRefs.current[final]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      } catch (e) {
        /* ignore */
        console.error(e);
      }
    }
  }

  function findNextInDirection(i: number, dir: 'left' | 'right' | 'up' | 'down') {
    const r = Math.floor(i / size)
    const c = i % size
    if (dir === 'left') {
      for (let cc = c - 1; cc >= 0; cc--) {
        const idx = r * size + cc
        if (!isBlack(idx)) return idx
      }
      return null
    }
    if (dir === 'right') {
      for (let cc = c + 1; cc < size; cc++) {
        const idx = r * size + cc
        if (!isBlack(idx)) return idx
      }
      return null
    }
    if (dir === 'up') {
      for (let rr = r - 1; rr >= 0; rr--) {
        const idx = rr * size + c
        if (!isBlack(idx)) return idx
      }
      return null
    }
    // down
    for (let rr = r + 1; rr < size; rr++) {
      const idx = rr * size + c
      if (!isBlack(idx)) return idx
    }
    return null
  }

  function focusIndex(idx: number | null) {
    setFocusedIndex(idx)
    if (idx === null) return
    const el = inputRefs.current[idx]
    if (el) {
      el.focus()
      el.select()
    }
    setActiveClueByCell(idx)
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    const key = e.key

    // If composing (IME), don't intercept
    const ne = e.nativeEvent as unknown as { isComposing?: boolean }
    if (ne.isComposing) return

    // If a single letter key was pressed, always overwrite the current cell (even if same letter)
    // but only when NOT in rebus mode
    if (
      !rebus &&
      key.length === 1 &&
      /^[a-zA-Z]$/.test(key) &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey
    ) {
      e.preventDefault()
      handleChange(i, key)
      return
    }

    // Helper: check if current active clue matches desired direction and contains i
    function isActiveDirection(dir: 'Across' | 'Down') {
      if (activeClueIndex === null) return false
      const c = clues[activeClueIndex]
      return !!(c && c.direction === dir && c.cells && c.cells.includes(i))
    }

    if (key === 'ArrowLeft') {
      e.preventDefault()
      // First press should set Across without moving
      if (!isActiveDirection('Across')) {
        setActiveClueByCell(i, 'Across')
        return
      }
      const nx = findNextInDirection(i, 'left')
      if (nx !== null) {
        focusIndex(nx)
        setActiveClueByCell(nx, 'Across')
      }
      return
    }

    if (key === 'ArrowRight') {
      e.preventDefault()
      if (!isActiveDirection('Across')) {
        setActiveClueByCell(i, 'Across')
        return
      }
      const nx = findNextInDirection(i, 'right')
      if (nx !== null) {
        focusIndex(nx)
        setActiveClueByCell(nx, 'Across')
      }
      return
    }

    if (key === 'ArrowUp') {
      e.preventDefault()
      if (!isActiveDirection('Down')) {
        setActiveClueByCell(i, 'Down')
        return
      }
      const nx = findNextInDirection(i, 'up')
      if (nx !== null) {
        focusIndex(nx)
        setActiveClueByCell(nx, 'Down')
      }
      return
    }

    if (key === 'ArrowDown') {
      e.preventDefault()
      if (!isActiveDirection('Down')) {
        setActiveClueByCell(i, 'Down')
        return
      }
      const nx = findNextInDirection(i, 'down')
      if (nx !== null) {
        focusIndex(nx)
        setActiveClueByCell(nx, 'Down')
      }
      return
    }

    if (key === 'Backspace') {
      e.preventDefault()
      // If current cell has a letter, delete it and stay; otherwise go to previous cell and delete that
      if (grid[i]) {
        setGrid((prev) => {
          const next = [...prev]
          next[i] = ''
          return next
        })
        return
      }

      // prefer previous in same row, otherwise previous row
      const prev = findNextInDirection(i, 'left') ?? findNextInDirection(i, 'up')
      if (prev !== null) {
        setGrid((prevg) => {
          const next = [...prevg]
          next[prev] = ''
          return next
        })
        focusIndex(prev)
      }
      return
    }

    if (key === 'Tab') {
      e.preventDefault()
      // Move to next word (clue). Shift+Tab moves to previous
      const currentClue = activeClueIndex !== null ? activeClueIndex : (() => {
        const found = clues.findIndex((c) => c.cells && c.cells.includes(i))
        return found === -1 ? null : found
      })()

      if (currentClue === null) return

      // find which clueList contains this clue
      const listIdx = clueLists.findIndex((l) => l.clues && l.clues.includes(currentClue))
      if (listIdx === -1) return
      const list = clueLists[listIdx]
      const pos = list.clues.indexOf(currentClue)
      let targetClueIndex: number | null = null
      if (!e.shiftKey) {
        targetClueIndex = list.clues[pos + 1] ?? null
      } else {
        targetClueIndex = list.clues[pos - 1] ?? null
      }

      if (targetClueIndex === null) return
      focusClue(targetClueIndex)
      return
    }

    // allow Enter/Tab browser defaults in other cases
  }

  function focusClue(clueIndex: number) {
    const clue = clues[clueIndex]
    if (!clue || !clue.cells || clue.cells.length === 0) return
    // scroll the clicked clue into view
    if (clueRefs.current && clueRefs.current[clueIndex]) {
      try { clueRefs.current[clueIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) } catch (e) {
        console.error(e);
      }
    }
    const first = clue.cells[0]
    focusIndex(first)
  }

  function renderClueText(clue?: Clue) {
    if (!clue || !clue.text) return ''
    return clue.text.map((t: ClueTextPart) => t.plain || t.formatted || '').join(' ')
  }

  const activeCells = activeClueIndex !== null && clues[activeClueIndex] ? new Set(clues[activeClueIndex].cells) : new Set<number>()

  return (
    <div className="App">
      <div className="controls">
        <button onClick={() => setReveal((r) => !r)} className={reveal ? 'active' : ''}>{reveal ? 'Hide' : 'Reveal'}</button>
        <button onClick={() => setRebus((r) => !r)} className={rebus ? 'active rebus' : 'rebus'}>{rebus ? 'Rebus: On' : 'Rebus: Off'}</button>
      </div>

      <div className="puzzle-container">
        <div
          className="crossword"
          style={{ gridTemplateColumns: `repeat(${size}, 36px)` }}
          role="grid"
        >
          {cells.map((cell, i) => {
            const isBlk = isBlack(i)
            const isActive = activeCells.has(i)
            const isSelected = focusedIndex === i
            return (
              <div key={i} className={`cell ${isBlk ? 'black' : ''} ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}`} role="gridcell">
                {!isBlk && cell.label && <div className="label">{cell.label}</div>}
                {!isBlk && (
                  <input
                    ref={(el) => {
                      inputRefs.current[i] = el
                    }}
                    value={reveal ? (cell.answer || '') : grid[i] || ''}
                    onChange={(e) => handleChange(i, e.target.value)}
                    onFocus={() => focusIndex(i)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    maxLength={rebus ? 10 : 1}
                    aria-label={`Cell ${i + 1}`}
                    className={rebus ? 'rebus-input' : 'hide-caret'}
                  />
                )}
              </div>
            )
          })}
        </div>

        <div className="clues">
          {clueLists.map((list: ClueList, idx: number) => (
            <div key={idx} className="clueList">
              <h3>{list.name}</h3>
              <div>
                {list.clues.map((clueIndex: number) => {
                  const clue = clues[clueIndex]
                  if (!clue) return null
                  const isActiveClue = activeClueIndex === clueIndex
                  return (
                    <div
                      key={clueIndex}
                      ref={(el) => {
                        clueRefs.current[clueIndex] = el
                      }}
                      className={`clue ${isActiveClue ? 'active' : ''}`}
                      onClick={() => focusClue(clueIndex)}
                      onKeyDown={(e) => (e.key === 'Enter' ? focusClue(clueIndex) : undefined)}
                      role="button"
                      tabIndex={0}
                    >
                      <span className="clueLabel">{clue.label}</span>
                      <span className="clueText">{renderClueText(clue)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="legend">
        <p>
          <strong>Note:</strong> Use arrow keys to move, Backspace deletes letters, Tab moves to next word. Click a clue to focus its first cell. Use <em>Rebus</em> mode to enter multiple letters in a cell.
        </p>
      </div>
    </div>
  )
}

export default App
