import React, { useEffect, useRef, useState } from 'react'
import './App.css'
import type { PuzzleBody, Clue, ClueList, Cell, ClueTextPart, PuzzleFile } from './types'
import { getDay } from 'date-fns'

function App() {
  // Track current direction (Across/Down)
  const [direction, setDirection] = useState<'Across' | 'Down' | null>(null)
  const initializeState = () => {
    const modules = import.meta.glob('../puzzles/*.json', { eager: true }) as Record<string, { default?: PuzzleFile }>
    const entries = Object.entries(modules)
      .map(([path, mod]) => {
        const name = path.split('/').pop()?.replace('.json', '') || path
        const p = (mod.default || mod) as PuzzleFile
        const body = p.body && p.body[0]
        return body ? { path, name, body } : null
      })
      .filter((e): e is { path: string; name: string; body: PuzzleBody } => !!e)
    return entries
  }

  const puzzleFilesInitial = initializeState()
  const firstFile = puzzleFilesInitial.length > 0 ? puzzleFilesInitial[0] : null

  const [puzzle, setPuzzle] = useState<PuzzleBody | null>(firstFile?.body || null)
  const [grid, setGrid] = useState<string[]>(firstFile?.body?.cells ? Array(firstFile.body.cells.length).fill('') : [])
  const [reveal, setReveal] = useState(false)

  const [clueLists, setClueLists] = useState<ClueList[]>(firstFile?.body?.clueLists || [])
  const [clues, setClues] = useState<Clue[]>(firstFile?.body?.clues || [])

  const [rebus, setRebus] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
  const [activeClueIndex, setActiveClueIndex] = useState<number | null>(null)

  const [puzzleFiles,] = useState<{ path: string; name: string; body: PuzzleBody }[]>(puzzleFilesInitial)
  const [selectedPuzzlePath, setSelectedPuzzlePath] = useState<string>(firstFile?.path || '')

  // reveal confirmation modal
  const [showRevealConfirm, setShowRevealConfirm] = useState(false)
  const revealConfirmBtnRef = useRef<HTMLButtonElement | null>(null)

  // theme override (light / dark). Persist in localStorage and apply as data-theme on :root
  type Theme = 'light' | 'dark'
  const getInitialTheme = (): Theme => {
    try {
      const stored = localStorage.getItem('theme') as Theme | null
      if (stored === 'light' || stored === 'dark') return stored
    } catch (e) {
      console.error(e);
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
    return 'light'
  }
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    try {
      localStorage.setItem('theme', theme)
    } catch (e) {
      console.error(e);
    }
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))

  const inputRefs = useRef<Array<HTMLInputElement | null>>([])
  const clueRefs = useRef<Array<HTMLDivElement | null>>([])

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

  // Close reveal modal on Escape and focus the confirm button when opened
  useEffect(() => {
    if (!showRevealConfirm) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowRevealConfirm(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showRevealConfirm])

  useEffect(() => {
    if (showRevealConfirm && revealConfirmBtnRef.current) {
      revealConfirmBtnRef.current.focus()
    }
  }, [showRevealConfirm])
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
          // preserve the current clue direction when moving to next cell
          focusIndex(seq[pos + 1], currentClue.direction as 'Across' | 'Down')
          return
        }
      }
      // Do not auto-advance into the next word — stay on last cell if at end
    }
  }

  function handlePuzzleSelect(path: string) {
    const entry = puzzleFiles.find((p) => p.path === path)
    if (!entry) return
    setSelectedPuzzlePath(path)
    const body = entry.body
    setPuzzle(body)
    setGrid(Array(body.cells.length).fill(''))
    setClueLists(body.clueLists || [])
    setClues(body.clues || [])
    setFocusedIndex(null)
    setActiveClueIndex(null)
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
    const isDown = preferDirection === 'Down'
    const clueIdx = cells[i].clues[+isDown]
    setActiveClueIndex(clueIdx)
    setDirection(clueIdx !== null && clueIdx !== undefined ? clues[clueIdx]?.direction ?? null : null)

    // scroll the clue into view if possible
    if (clueIdx !== null && clueIdx !== undefined && clueRefs.current && clueRefs.current[clueIdx]) {
      try {
        clueRefs.current[clueIdx]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      } catch (e) {
        /* ignore */
        console.error(e);
      }
    }
  }

  /**
   * Find the next non-black cell in the given direction from index i
   */
  function findNextInDirection(i: number, dir: 'left' | 'right' | 'up' | 'down'): number | null {
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

  function focusIndex(idx: number | null, preferDirection?: 'Across' | 'Down') {
    setFocusedIndex(idx)
    if (idx === null) return
    const el = inputRefs.current[idx]
    if (el) {
      el.focus()
      el.select()
    }
    setActiveClueByCell(idx, preferDirection)
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

    /**
     * Check if the given direction is the active direction for the current cell
     */
    const isActiveDirectionForCell = (idx: number, dir: 'Across' | 'Down') => {
      if (activeClueIndex === null) return false
      const activeClue = clues[activeClueIndex]
      return !!(activeClue && activeClue.direction === dir && activeClue.cells && activeClue.cells.includes(idx))
    }

    const arrowHandler = (dir: 'left' | 'right' | 'up' | 'down', clueDir: 'Across' | 'Down') => {
      e.preventDefault()
      if (!isActiveDirectionForCell(i, clueDir)) {
        setActiveClueByCell(i, clueDir)
        return
      }
      const nx = findNextInDirection(i, dir)
      if (nx !== null) {
        focusIndex(nx, clueDir)
        setActiveClueByCell(nx, clueDir)
      }
    }

    if (key === 'ArrowLeft') {
      arrowHandler('left', 'Across')
      return
    }

    if (key === 'ArrowRight') {
      arrowHandler('right', 'Across')
      return
    }

    if (key === 'ArrowUp') {
      arrowHandler('up', 'Down')
      return
    }

    if (key === 'ArrowDown') {
      arrowHandler('down', 'Down')
      return
    }

    if (key === 'Backspace') {
      e.preventDefault()
      // If current cell has a letter, delete it and stay
      if (grid[i]) {
        setGrid((prev) => {
          const next = [...prev]
          next[i] = ''
          return next
        })
        return
      }

      // If we're inside the active clue, prefer the previous cell in that clue (works for Across or Down)
      const currentClue = activeClueIndex !== null ? clues[activeClueIndex] : null
      if (currentClue && currentClue.cells && currentClue.cells.includes(i)) {
        const seq = currentClue.cells
        const pos = seq.indexOf(i)
        if (pos > 0) {
          const prevCell = seq[pos - 1]
          setGrid((prevg) => {
            const next = [...prevg]
            next[prevCell] = ''
            return next
          })
          focusIndex(prevCell, currentClue.direction as 'Across' | 'Down')
          return
        }
      }

      // otherwise prefer previous in same row (left)
      const leftPrev = findNextInDirection(i, 'left')
      if (leftPrev !== null) {
        setGrid((prevg) => {
          const next = [...prevg]
          next[leftPrev] = ''
          return next
        })
        focusIndex(leftPrev)
        return
      }

      // otherwise find previous non-black cell in reading order (scan backwards)
      let prevIdx: number | null = null
      for (let idx = i - 1; idx >= 0; idx--) {
        if (!isBlack(idx)) {
          prevIdx = idx
          break
        }
      }
      if (prevIdx !== null) {
        setGrid((prevg) => {
          const next = [...prevg]
          next[prevIdx] = ''
          return next
        })
        focusIndex(prevIdx)
      }
      return
    }

    if (key === 'Tab') {
      e.preventDefault()
      if (!clues || activeClueIndex === null) return
      // Use direction state to determine which clue list to advance
      const dir = direction || clues[activeClueIndex].direction
      let targetIdx = -1;
      if (e.shiftKey) {
        // Find previous clue in the same direction
        for (let idx = activeClueIndex - 1; idx >= 0; idx--) {
          if (clues[idx].direction === dir) {
            targetIdx = idx;
            break;
          }
        }
        if (targetIdx === -1) {
          // wrap around to last in direction
          for (let idx = clues.length - 1; idx > activeClueIndex; idx--) {
            if (clues[idx].direction === dir) {
              targetIdx = idx;
              break;
            }
          }
        }
      } else {
        // Find next clue in the same direction
        for (let idx = activeClueIndex + 1; idx < clues.length; idx++) {
          if (clues[idx].direction === dir) {
            targetIdx = idx;
            break;
          }
        }
        if (targetIdx === -1) {
          // wrap around to first in direction
          for (let idx = 0; idx < activeClueIndex; idx++) {
            if (clues[idx].direction === dir) {
              targetIdx = idx;
              break;
            }
          }
        }
      }
      if (targetIdx !== -1) {
        setActiveClueIndex(targetIdx)
        setDirection(dir)
        const firstCell = clues[targetIdx].cells?.[0]
        if (firstCell !== undefined) focusIndex(firstCell, dir)
      }
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

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="App">
      <div className="controls">
        <label className="puzzleSelectLabel">
          Puzzle:
          <select value={selectedPuzzlePath} onChange={(e) => handlePuzzleSelect(e.target.value)}>
            {puzzleFiles.map((p) => (
              <option key={p.path} value={p.path}>{p.name + ` (${dayNames[getDay(p.name) + 1]})`}</option>
            ))}
          </select>
        </label>

        <button
          onClick={() => {
            if (!reveal) setShowRevealConfirm(true)
            else setReveal(false)
          }}
          className={reveal ? 'active' : ''}
        >{reveal ? 'Hide' : 'Reveal'}</button>
        <button onClick={() => setRebus((r) => !r)} className={rebus ? 'active rebus' : 'rebus'}>{rebus ? 'Rebus: On' : 'Rebus: Off'}</button>

        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        >
          {theme === 'light' ? '🌞' : '🌙'}
        </button>
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
              <div
                key={i}
                className={`cell ${isBlk ? 'black' : ''} ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}`}
                role="gridcell"
                onClick={() => {
                  const dir = activeClueIndex !== null ? clues[activeClueIndex]?.direction : undefined
                  const prefer = dir === 'Across' || dir === 'Down' ? (dir as 'Across' | 'Down') : undefined
                  focusIndex(i, prefer)
                }}
              >
                {!isBlk && cell.label && <div className="label">{cell.label}</div>}
                {!isBlk && (
                  <input
                    ref={(el) => {
                      inputRefs.current[i] = el
                    }}
                    value={reveal ? (cell.answer || '') : grid[i] || ''}
                    onChange={(e) => handleChange(i, e.target.value)}
                    onFocus={() => {
                      const dir = activeClueIndex !== null ? clues[activeClueIndex]?.direction : undefined
                      const prefer = dir === 'Across' || dir === 'Down' ? (dir as 'Across' | 'Down') : undefined
                      focusIndex(i, prefer)
                    }}
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

      {showRevealConfirm && (
        <div className="modalOverlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowRevealConfirm(false) }}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="reveal-title">
            <h3 id="reveal-title">Reveal answers?</h3>
            <p>Revealing will show all answers. Are you sure you want to reveal the puzzle?</p>
            <div className="modalActions">
              <button
                ref={(el) => { revealConfirmBtnRef.current = el }}
                className="danger"
                onClick={() => { setReveal(true); setShowRevealConfirm(false) }}
              >Reveal</button>
              <button onClick={() => setShowRevealConfirm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
