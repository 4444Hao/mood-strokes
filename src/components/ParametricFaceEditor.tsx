import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { FACE_PRESETS } from '../lib/presets'
import type { ArcParams, ParametricFace } from '../types/mood'

type FacePartKey = 'leftEye' | 'rightEye' | 'mouth'
type HandleKey = 'left' | 'right' | 'mid'

type DragState = {
  part: FacePartKey
  handle: HandleKey
  pointerId: number
  startPoint: { x: number; y: number }
  startArc: ArcParams
} | null

type ParametricFaceEditorProps = {
  value: ParametricFace
  onChange: (next: ParametricFace) => void
}

const PART_KEYS: FacePartKey[] = ['leftEye', 'rightEye', 'mouth']

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function cloneFace(face: ParametricFace): ParametricFace {
  return {
    ...face,
    leftEye: { ...face.leftEye },
    rightEye: { ...face.rightEye },
    mouth: { ...face.mouth },
  }
}

function linePoints(arc: ArcParams): {
  left: { x: number; y: number }
  right: { x: number; y: number }
  control: { x: number; y: number }
} {
  const half = arc.width / 2
  return {
    left: { x: arc.x - half, y: arc.y + arc.tilt / 2 },
    right: { x: arc.x + half, y: arc.y - arc.tilt / 2 },
    control: { x: arc.x, y: arc.y - arc.curve },
  }
}

function arcPath(arc: ArcParams): string {
  const pts = linePoints(arc)
  return `M ${pts.left.x} ${pts.left.y} Q ${pts.control.x} ${pts.control.y} ${pts.right.x} ${pts.right.y}`
}

function getSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
  const rect = svg.getBoundingClientRect()
  const x = ((clientX - rect.left) / rect.width) * 100
  const y = ((clientY - rect.top) / rect.height) * 100
  return { x, y }
}

function derivePresetLabel(face: ParametricFace): string | undefined {
  return FACE_PRESETS.find((preset) => preset.id === face.presetId)?.label
}

export function ParametricFaceEditor({ value, onChange }: ParametricFaceEditorProps) {
  const [dragState, setDragState] = useState<DragState>(null)
  const [isEditing, setIsEditing] = useState(false)
  const editTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeLabel = useMemo(() => derivePresetLabel(value), [value])

  const activateEditing = useCallback(() => {
    setIsEditing((prev) => (prev ? prev : true))
    if (editTimerRef.current) {
      clearTimeout(editTimerRef.current)
    }
    editTimerRef.current = setTimeout(() => {
      setIsEditing(false)
      setDragState(null)
    }, 5000)
  }, [])

  useEffect(() => {
    return () => {
      if (editTimerRef.current) {
        clearTimeout(editTimerRef.current)
      }
    }
  }, [])

  const applyPreset = (presetId: string) => {
    const preset = FACE_PRESETS.find((item) => item.id === presetId)
    if (!preset) {
      return
    }
    onChange(cloneFace(preset.face))
  }

  const startDrag =
    (part: FacePartKey, handle: HandleKey) =>
    (event: ReactPointerEvent<SVGCircleElement | SVGPathElement>) => {
      event.stopPropagation()
      const target = event.currentTarget
      target.setPointerCapture(event.pointerId)
      const svg = event.currentTarget.ownerSVGElement
      if (!svg) {
        return
      }
      const startPoint = getSvgPoint(svg, event.clientX, event.clientY)
      const arc = value[part]
      activateEditing()
      setDragState({
        part,
        handle,
        pointerId: event.pointerId,
        startPoint,
        startArc: { ...arc },
      })
    }

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return
    }
    activateEditing()
    const svg = event.currentTarget
    const nextPoint = getSvgPoint(svg, event.clientX, event.clientY)

    onChange((() => {
      const next = cloneFace(value)
      const part = next[dragState.part]
      const startArc = dragState.startArc
      const startPts = linePoints(startArc)
      const dx = nextPoint.x - dragState.startPoint.x
      const dy = nextPoint.y - dragState.startPoint.y
      const dampDx = dx * 0.82
      const dampDy = dy * 0.82

      if (dragState.handle === 'left') {
        const right = startPts.right
        const x = clamp(startPts.left.x + dampDx, 8, right.x - 8)
        const y = clamp(startPts.left.y + dampDy, 10, 90)
        const width = right.x - x
        part.x = clamp((x + right.x) / 2, 16, 84)
        part.y = clamp((y + right.y) / 2, 12, 88)
        part.width = clamp(width, 10, 44)
        part.tilt = clamp(y - right.y, -20, 20)
      }

      if (dragState.handle === 'right') {
        const left = startPts.left
        const x = clamp(startPts.right.x + dampDx, left.x + 8, 92)
        const y = clamp(startPts.right.y + dampDy, 10, 90)
        const width = x - left.x
        part.x = clamp((x + left.x) / 2, 16, 84)
        part.y = clamp((y + left.y) / 2, 12, 88)
        part.width = clamp(width, 10, 44)
        part.tilt = clamp(left.y - y, -20, 20)
      }

      if (dragState.handle === 'mid') {
        const stretch = clamp(dampDx, -12, 12)
        const bend = clamp(dampDy, -12, 12)
        part.curve = clamp(startArc.curve - bend * 1.1, -24, 24)
        part.width = clamp(startArc.width + stretch * 0.55, 10, 48)
        part.tilt = clamp(startArc.tilt + stretch * 0.22 - bend * 0.18, -24, 24)
      }

      next.presetId = undefined
      return next
    })())
  }

  const stopDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return
    }
    activateEditing()
    setDragState(null)
  }

  return (
    <div className="parametric-editor">
      <div className="preset-row">
        {FACE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`preset-chip ${value.presetId === preset.id ? 'is-active' : ''}`}
            onClick={() => applyPreset(preset.id)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <svg
        className="face-canvas"
        viewBox="0 0 100 100"
        aria-label="三笔表情编辑器"
        onPointerDown={activateEditing}
        onPointerMove={onPointerMove}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
      >
        <circle cx="50" cy="50" r="45" className="face-bg" />

        {PART_KEYS.map((key) => {
          const arc = value[key]
          const pts = linePoints(arc)
          const mid = {
            x: (pts.left.x + 2 * pts.control.x + pts.right.x) / 4,
            y: (pts.left.y + 2 * pts.control.y + pts.right.y) / 4,
          }
          const selected = dragState?.part === key
          const stroke = key === 'mouth' ? '#3a2618' : '#4a3426'
          const showHandles = isEditing
          return (
            <g key={key} className={selected ? 'part-active' : ''}>
              <path d={arcPath(arc)} className="line-hit" />
              <path d={arcPath(arc)} className="line-shape" style={{ stroke, strokeWidth: arc.strokeWidth }} />

              {showHandles ? (
                <>
                  <circle
                    cx={pts.left.x}
                    cy={pts.left.y}
                    r={selected ? 1.9 : 1.4}
                    className="handle-point"
                    onPointerDown={startDrag(key, 'left')}
                  />
                  <circle
                    cx={pts.right.x}
                    cy={pts.right.y}
                    r={selected ? 1.9 : 1.4}
                    className="handle-point"
                    onPointerDown={startDrag(key, 'right')}
                  />
                  <circle
                    cx={mid.x}
                    cy={mid.y}
                    r={selected ? 2 : 1.8}
                    className="handle-curve"
                    onPointerDown={startDrag(key, 'mid')}
                  />
                </>
              ) : null}
            </g>
          )
        })}
      </svg>

      <p className="editor-hint">
        先点一下表情进入编辑态：每条线只有三个圆点，拖两端调形，拖线内圆点可拉伸弯曲。5 秒后自动收起。
      </p>
      <p className="editor-state">{activeLabel ? `当前图元：${activeLabel}` : '当前图元：已微调'}</p>
    </div>
  )
}
