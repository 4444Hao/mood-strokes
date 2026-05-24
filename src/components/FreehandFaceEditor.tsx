import { useMemo, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { FreehandFace, Point, Stroke } from '../types/mood'

type FreehandFaceEditorProps = {
  value: FreehandFace
  onChange: (next: FreehandFace) => void
}

const DRAW_STROKE_WIDTH = 3.2

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function toSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number): Point {
  const rect = svg.getBoundingClientRect()
  const x = ((clientX - rect.left) / rect.width) * 100
  const y = ((clientY - rect.top) / rect.height) * 100
  return {
    x: clamp(x, 0, 100),
    y: clamp(y, 0, 100),
    t: Date.now(),
  }
}

function pointsToPath(points: Point[]): string {
  if (points.length === 0) {
    return ''
  }
  if (points.length === 1) {
    const p = points[0]
    return `M ${p.x} ${p.y} L ${p.x} ${p.y}`
  }
  return points.map((p, index) => `${index === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
}

export function FreehandFaceEditor({ value, onChange }: FreehandFaceEditorProps) {
  const [drawing, setDrawing] = useState<{
    pointerId: number
    points: Point[]
  } | null>(null)

  const draftPath = useMemo(() => pointsToPath(drawing?.points ?? []), [drawing?.points])

  const startDrawing = (event: ReactPointerEvent<SVGSVGElement>) => {
    const svg = event.currentTarget
    svg.setPointerCapture(event.pointerId)
    const first = toSvgPoint(svg, event.clientX, event.clientY)
    setDrawing({
      pointerId: event.pointerId,
      points: [{ ...first, pressure: event.pressure > 0 ? event.pressure : undefined }],
    })
  }

  const moveDrawing = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drawing || drawing.pointerId !== event.pointerId) {
      return
    }
    const next = toSvgPoint(event.currentTarget, event.clientX, event.clientY)
    setDrawing((prev) => {
      if (!prev || prev.pointerId !== event.pointerId) {
        return prev
      }
      return {
        ...prev,
        points: [...prev.points, { ...next, pressure: event.pressure > 0 ? event.pressure : undefined }],
      }
    })
  }

  const commitDrawing = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drawing || drawing.pointerId !== event.pointerId) {
      return
    }

    if (drawing.points.length > 0) {
      const stroke: Stroke = {
        id: crypto.randomUUID(),
        points: drawing.points,
        strokeWidth: DRAW_STROKE_WIDTH,
      }
      onChange({
        mode: 'freehand',
        strokes: [...value.strokes, stroke],
      })
    }
    setDrawing(null)
  }

  const handleUndo = () => {
    onChange({
      mode: 'freehand',
      strokes: value.strokes.slice(0, -1),
    })
  }

  const handleClear = () => {
    onChange({
      mode: 'freehand',
      strokes: [],
    })
  }

  return (
    <div className="freehand-editor">
      <svg
        className="freehand-canvas"
        viewBox="0 0 100 100"
        onPointerDown={startDrawing}
        onPointerMove={moveDrawing}
        onPointerUp={commitDrawing}
        onPointerCancel={commitDrawing}
        aria-label="自由手绘画布"
      >
        <rect x="0" y="0" width="100" height="100" className="freehand-bg" />
        {value.strokes.map((stroke) => (
          <path
            key={stroke.id}
            d={pointsToPath(stroke.points)}
            className="freehand-line"
            style={{ strokeWidth: stroke.strokeWidth }}
          />
        ))}
        {draftPath ? <path d={draftPath} className="freehand-line draft" style={{ strokeWidth: DRAW_STROKE_WIDTH }} /> : null}
      </svg>

      <div className="freehand-actions">
        <button type="button" className="ghost-btn" onClick={handleUndo} disabled={value.strokes.length === 0}>
          撤销上一笔
        </button>
        <button type="button" className="ghost-btn warn" onClick={handleClear} disabled={value.strokes.length === 0}>
          清空
        </button>
      </div>
      <p className="editor-hint">随手画几条线就可以，不用对称，也不用解释。</p>
    </div>
  )
}
