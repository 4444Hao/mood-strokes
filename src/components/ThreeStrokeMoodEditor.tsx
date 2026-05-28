import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import {
  applyStrokeAdjustments,
  createDefaultAdjustment,
  getAdjustedStrokeWidth,
  nearestPointOnStroke,
  pointsToSmoothPath,
} from '../lib/strokeAdjust'
import type {
  ArcParams,
  EditableStroke,
  MoodFace,
  Point,
  Stroke,
  StrokeAdjustment,
  StrokeRole,
} from '../types/mood'

type ThreeStrokeMoodEditorProps = {
  value?: MoodFace
  onChange: (face: MoodFace | undefined) => void
}

type DragState =
  | {
      kind: 'nudge'
      strokeId: string
      nudgeId: string
      pointerId: number
      startPoint: { x: number; y: number }
    }
  | null

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function getSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
  const rect = svg.getBoundingClientRect()
  const x = ((clientX - rect.left) / rect.width) * 100
  const y = ((clientY - rect.top) / rect.height) * 100
  return { x: clamp(x, 0, 100), y: clamp(y, 0, 100) }
}

function centroidY(stroke: Stroke): number {
  return stroke.points.reduce((sum, point) => sum + point.y, 0) / Math.max(stroke.points.length, 1)
}

function centroidX(stroke: Stroke): number {
  return stroke.points.reduce((sum, point) => sum + point.x, 0) / Math.max(stroke.points.length, 1)
}

function inferRoles(strokes: Stroke[]): Array<{ stroke: Stroke; role: StrokeRole }> {
  if (strokes.length !== 3) {
    return strokes.map((stroke) => ({ stroke, role: 'unknown' }))
  }
  const sorted = [...strokes].sort((a, b) => centroidY(a) - centroidY(b))
  const topTwo = sorted.slice(0, 2).sort((a, b) => centroidX(a) - centroidX(b))
  const mouth = sorted[2]

  return [
    { stroke: topTwo[0], role: 'leftEye' },
    { stroke: topTwo[1], role: 'rightEye' },
    { stroke: mouth, role: 'mouth' },
  ]
}

function cloneAdjustment(adjustment: StrokeAdjustment): StrokeAdjustment {
  return {
    ...adjustment,
    localNudges: adjustment.localNudges.map((nudge) => ({
      ...nudge,
      center: { ...nudge.center },
      delta: { ...nudge.delta },
    })),
    mouth: adjustment.mouth ? { ...adjustment.mouth } : undefined,
    eye: adjustment.eye ? { ...adjustment.eye } : undefined,
  }
}

function cloneEditableStroke(stroke: EditableStroke): EditableStroke {
  return {
    id: stroke.id,
    role: stroke.role,
    originalPoints: stroke.originalPoints.map((point) => ({ ...point })),
    adjustments: cloneAdjustment(stroke.adjustments),
    style: { ...stroke.style },
  }
}

function ensureAdjustmentForRole(current: StrokeAdjustment, role: StrokeRole): StrokeAdjustment {
  const defaultMouth = createDefaultAdjustment('mouth').mouth ?? {
    leftCornerLift: 0,
    rightCornerLift: 0,
    cornerInward: 0,
    middleSag: 0,
    tension: 0,
    softness: 0,
  }
  const defaultEye = createDefaultAdjustment('leftEye').eye ?? {
    innerCornerLift: 0,
    outerCornerLift: 0,
    squint: 0,
    wrinkle: 0,
    droop: 0,
  }

  const next: StrokeAdjustment = {
    ...current,
    localNudges: current.localNudges,
    tension: current.tension,
    softness: current.softness,
    weight: current.weight,
    mouth: role === 'mouth' ? { ...defaultMouth, ...current.mouth } : undefined,
    eye:
      role === 'leftEye' || role === 'rightEye'
        ? { ...defaultEye, ...current.eye }
        : undefined,
  }
  return next
}

function createEditableStrokes(strokes: Stroke[]): EditableStroke[] {
  return inferRoles(strokes).map(({ stroke, role }) => ({
    id: stroke.id,
    role,
    originalPoints: stroke.points.map((point) => ({ ...point })),
    adjustments: createDefaultAdjustment(role),
    style: { strokeWidth: stroke.strokeWidth },
  }))
}

function toExpressiveFace(strokes: EditableStroke[]): MoodFace {
  return {
    mode: 'expressive',
    strokes: strokes.map(cloneEditableStroke),
  }
}

function sampleArcPoint(arc: ArcParams, t: number): Point {
  const clampedT = clamp(t, 0, 1)
  const half = arc.width / 2
  const start = { x: arc.x - half, y: arc.y + arc.tilt / 2 }
  const end = { x: arc.x + half, y: arc.y - arc.tilt / 2 }
  const control = { x: arc.x, y: arc.y - arc.curve }
  const one = 1 - clampedT
  return {
    x: one * one * start.x + 2 * one * clampedT * control.x + clampedT * clampedT * end.x,
    y: one * one * start.y + 2 * one * clampedT * control.y + clampedT * clampedT * end.y,
    t: Date.now(),
  }
}

function editableFromParametric(face: Extract<MoodFace, { mode: 'parametric' }>): EditableStroke[] {
  const parts: Array<{ id: string; role: StrokeRole; arc: ArcParams }> = [
    { id: 'left-eye', role: 'leftEye', arc: face.leftEye },
    { id: 'right-eye', role: 'rightEye', arc: face.rightEye },
    { id: 'mouth', role: 'mouth', arc: face.mouth },
  ]

  return parts.map((part) => ({
    id: part.id,
    role: part.role,
    originalPoints: Array.from({ length: 30 }, (_, index) => sampleArcPoint(part.arc, index / 29)),
    adjustments: createDefaultAdjustment(part.role),
    style: { strokeWidth: part.arc.strokeWidth },
  }))
}

function roleLabel(role: StrokeRole): string {
  if (role === 'leftEye') {
    return '左眼'
  }
  if (role === 'rightEye') {
    return '右眼'
  }
  if (role === 'mouth') {
    return '嘴巴'
  }
  return '线条'
}

export function ThreeStrokeMoodEditor({ value, onChange }: ThreeStrokeMoodEditorProps) {
  const [phase, setPhase] = useState<'draw' | 'tune'>('draw')
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [draft, setDraft] = useState<Point[] | null>(null)
  const [editableStrokes, setEditableStrokes] = useState<EditableStroke[]>([])
  const [completedFace, setCompletedFace] = useState<MoodFace | undefined>(undefined)
  const [selectedStrokeId, setSelectedStrokeId] = useState<string | null>(null)
  const [dragState, setDragState] = useState<DragState>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [tuneDone, setTuneDone] = useState(false)
  const editTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tuneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draftRef = useRef<Point | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastExternalRef = useRef<MoodFace | undefined>(undefined)

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
      if (tuneTimerRef.current) {
        clearTimeout(tuneTimerRef.current)
      }
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (value === lastExternalRef.current) {
      return
    }
    lastExternalRef.current = value

    if (!value) {
      setPhase('draw')
      setStrokes([])
      setDraft(null)
      setEditableStrokes([])
      setCompletedFace(undefined)
      setSelectedStrokeId(null)
      setDragState(null)
      setIsEditing(false)
      return
    }

    if (value.mode === 'expressive') {
      const cloned = value.strokes.map(cloneEditableStroke)
      setPhase('tune')
      setEditableStrokes(cloned)
      setStrokes([])
      setDraft(null)
      setCompletedFace(undefined)
      setSelectedStrokeId(cloned[0]?.id ?? null)
      setShowAdvanced(false)
      setIsEditing(false)
      return
    }

    if (value.mode === 'parametric') {
      const converted = editableFromParametric(value)
      setPhase('tune')
      setEditableStrokes(converted)
      setStrokes([])
      setDraft(null)
      setCompletedFace(undefined)
      setSelectedStrokeId(converted[0]?.id ?? null)
      setShowAdvanced(false)
      setIsEditing(false)
      return
    }

    setPhase('draw')
    setStrokes(value.strokes.slice(0, 3))
    setDraft(null)
    setEditableStrokes([])
    setCompletedFace(undefined)
    setSelectedStrokeId(null)
    setDragState(null)
    setShowAdvanced(false)
    setIsEditing(false)
  }, [value])

  useEffect(() => {
    if (phase === 'tune' && editableStrokes.length > 0) {
      const next = toExpressiveFace(editableStrokes)
      lastExternalRef.current = next
      onChange(next)
      return
    }
    if (phase === 'draw' && completedFace) {
      lastExternalRef.current = completedFace
      onChange(completedFace)
      return
    }
    onChange(undefined)
  }, [editableStrokes, completedFace, onChange, phase])

  const adjustedStrokeMap = useMemo(() => {
    const map = new Map<string, Point[]>()
    editableStrokes.forEach((stroke) => {
      map.set(stroke.id, applyStrokeAdjustments(stroke.originalPoints, stroke.adjustments, stroke.role))
    })
    return map
  }, [editableStrokes])

  const selectedStroke = useMemo(
    () => editableStrokes.find((stroke) => stroke.id === selectedStrokeId) ?? null,
    [editableStrokes, selectedStrokeId],
  )

  const updateStroke = useCallback((strokeId: string, updater: (stroke: EditableStroke) => EditableStroke) => {
    setEditableStrokes((prev) =>
      prev.map((stroke) => {
        if (stroke.id !== strokeId) {
          return stroke
        }
        return updater(stroke)
      }),
    )
  }, [])

  const startDraw = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (phase !== 'draw' || strokes.length >= 3) {
      return
    }
    const svg = event.currentTarget
    svg.setPointerCapture(event.pointerId)
    const point = getSvgPoint(svg, event.clientX, event.clientY)
    setCompletedFace(undefined)
    setDraft([{ ...point, t: Date.now(), pressure: event.pressure > 0 ? event.pressure : undefined }])
  }

  const moveDraw = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (phase !== 'draw' || !draft) {
      return
    }
    const point = getSvgPoint(event.currentTarget, event.clientX, event.clientY)
    const next: Point = { ...point, t: Date.now(), pressure: event.pressure > 0 ? event.pressure : undefined }
    draftRef.current = next
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        const pt = draftRef.current
        if (pt) {
          setDraft((prev) => (prev ? [...prev, pt] : prev))
          draftRef.current = null
        }
      })
    }
  }

  const endDraw = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (phase !== 'draw' || !draft || draft.length < 2) {
      setDraft(null)
      draftRef.current = null
      return
    }
    setStrokes((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        points: draft,
        strokeWidth: 3.4,
      },
    ])
    setDraft(null)
    draftRef.current = null
  }

  const undoLast = () => {
    if (phase !== 'draw') {
      return
    }
    setStrokes((prev) => prev.slice(0, -1))
    setCompletedFace(undefined)
  }

  const clearAll = () => {
    setPhase('draw')
    setStrokes([])
    setDraft(null)
    setEditableStrokes([])
    setCompletedFace(undefined)
    setSelectedStrokeId(null)
    setDragState(null)
    setShowAdvanced(false)
    setIsEditing(false)
    setTuneDone(false)
    onChange(undefined)
  }

  const completeDirectly = () => {
    if (strokes.length !== 3) {
      return
    }
    const next = createEditableStrokes(strokes)
    setCompletedFace(toExpressiveFace(next))
    setIsEditing(false)
    setDragState(null)
    setShowAdvanced(false)
  }

  const enterTune = () => {
    if (strokes.length !== 3) {
      return
    }
    const next = createEditableStrokes(strokes)
    setEditableStrokes(next)
    setCompletedFace(undefined)
    setSelectedStrokeId(next[0]?.id ?? null)
    setShowAdvanced(false)
    setPhase('tune')
    activateEditing()
  }

  const backToDraw = () => {
    setPhase('draw')
    setEditableStrokes([])
    setCompletedFace(undefined)
    setSelectedStrokeId(null)
    setDragState(null)
    setShowAdvanced(false)
    setIsEditing(false)
    onChange(undefined)
  }

  const completeTune = () => {
    setIsEditing(false)
    setDragState(null)
    setTuneDone(true)
    if (tuneTimerRef.current) clearTimeout(tuneTimerRef.current)
    tuneTimerRef.current = window.setTimeout(() => setTuneDone(false), 1400)
  }

  const startNudge = (
    strokeId: string,
    pointerId: number,
    startPoint: { x: number; y: number },
    center: Point,
    radius: number,
    strength = 1,
  ) => {
    const nudgeId = crypto.randomUUID()
    updateStroke(strokeId, (stroke) => ({
      ...stroke,
      adjustments: {
        ...stroke.adjustments,
        localNudges: [
          ...stroke.adjustments.localNudges,
          {
            id: nudgeId,
            center: { ...center },
            delta: { x: 0, y: 0 },
            radius,
            strength,
          },
        ],
      },
    }))
    setDragState({
      kind: 'nudge',
      strokeId,
      nudgeId,
      pointerId,
      startPoint,
    })
  }

  const beginStrokeNudge = (strokeId: string) => (event: ReactPointerEvent<SVGPathElement>) => {
    if (phase !== 'tune') {
      return
    }
    event.stopPropagation()
    const svg = event.currentTarget.ownerSVGElement
    if (!svg) {
      return
    }
    activateEditing()
    setSelectedStrokeId(strokeId)

    const cursor = getSvgPoint(svg, event.clientX, event.clientY)
    const adjusted = adjustedStrokeMap.get(strokeId)
    if (!adjusted || adjusted.length < 2) {
      return
    }
    const nearest = nearestPointOnStroke(adjusted, cursor)
    const role = editableStrokes.find((stroke) => stroke.id === strokeId)?.role ?? 'unknown'
    const radius = role === 'mouth' ? 13 : 11
    startNudge(strokeId, event.pointerId, { x: nearest.point.x, y: nearest.point.y }, nearest.point, radius, 1)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const beginEdgeNudge = (strokeId: string, edge: 'start' | 'end') => (event: ReactPointerEvent<SVGCircleElement>) => {
    if (phase !== 'tune') {
      return
    }
    event.stopPropagation()
    const adjusted = adjustedStrokeMap.get(strokeId)
    if (!adjusted || adjusted.length === 0) {
      return
    }
    const point = edge === 'start' ? adjusted[0] : adjusted[adjusted.length - 1]
    activateEditing()
    setSelectedStrokeId(strokeId)
    startNudge(strokeId, event.pointerId, { x: point.x, y: point.y }, point, 9.5, 0.85)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveTune = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (phase !== 'tune' || !dragState) {
      return
    }
    if (event.pointerId !== dragState.pointerId) {
      return
    }
    activateEditing()
    const pointer = getSvgPoint(event.currentTarget, event.clientX, event.clientY)

    if (dragState.kind === 'nudge') {
      const dx = clamp((pointer.x - dragState.startPoint.x) * 0.7, -8, 8)
      const dy = clamp((pointer.y - dragState.startPoint.y) * 0.7, -8, 8)
      updateStroke(dragState.strokeId, (stroke) => ({
        ...stroke,
        adjustments: {
          ...stroke.adjustments,
          localNudges: stroke.adjustments.localNudges.map((nudge) =>
            nudge.id === dragState.nudgeId
              ? {
                  ...nudge,
                  delta: { x: dx, y: dy },
                }
              : nudge,
          ),
        },
      }))
      return
    }
  }

  const stopTune = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return
    }
    activateEditing()
    setDragState(null)
  }

  const setRole = (role: StrokeRole) => {
    if (!selectedStrokeId) {
      return
    }
    activateEditing()
    updateStroke(selectedStrokeId, (stroke) => ({
      ...stroke,
      role,
      adjustments: ensureAdjustmentForRole(stroke.adjustments, role),
    }))
  }

  const tweakSelected = (updater: (stroke: EditableStroke) => EditableStroke) => {
    if (!selectedStrokeId) {
      return
    }
    activateEditing()
    updateStroke(selectedStrokeId, updater)
  }

  const tweakMouth = (kind: 'lift' | 'inward' | 'sag') => {
    tweakSelected((stroke) => {
      const adjustment = ensureAdjustmentForRole(stroke.adjustments, 'mouth')
      const mouth = adjustment.mouth ?? createDefaultAdjustment('mouth').mouth!
      if (kind === 'lift') {
        mouth.leftCornerLift = clamp(mouth.leftCornerLift + 0.65, -5, 5)
        mouth.rightCornerLift = clamp(mouth.rightCornerLift + 0.65, -5, 5)
      }
      if (kind === 'inward') {
        mouth.cornerInward = clamp(mouth.cornerInward + 0.55, -5, 5)
      }
      if (kind === 'sag') {
        mouth.middleSag = clamp(mouth.middleSag + 0.65, -5, 5)
      }
      return {
        ...stroke,
        adjustments: {
          ...adjustment,
          mouth,
        },
      }
    })
  }

  const tweakEye = (kind: 'liftOuter' | 'dropOuter' | 'squint') => {
    tweakSelected((stroke) => {
      const adjustment = ensureAdjustmentForRole(stroke.adjustments, stroke.role)
      const eye = adjustment.eye ?? createDefaultAdjustment('leftEye').eye!
      if (kind === 'liftOuter') {
        eye.outerCornerLift = clamp(eye.outerCornerLift + 0.6, -5, 5)
      }
      if (kind === 'dropOuter') {
        eye.outerCornerLift = clamp(eye.outerCornerLift - 0.6, -5, 5)
      }
      if (kind === 'squint') {
        eye.squint = clamp(eye.squint + 0.55, -5, 5)
      }
      return {
        ...stroke,
        adjustments: {
          ...adjustment,
          eye,
        },
      }
    })
  }

  const tweakTension = (kind: 'soft' | 'tight') => {
    tweakSelected((stroke) => ({
      ...stroke,
      adjustments: {
        ...stroke.adjustments,
        softness:
          kind === 'soft'
            ? clamp(stroke.adjustments.softness + 0.55, -5, 5)
            : clamp(stroke.adjustments.softness - 0.35, -5, 5),
        tension:
          kind === 'tight'
            ? clamp(stroke.adjustments.tension + 0.55, -5, 5)
            : clamp(stroke.adjustments.tension - 0.2, -5, 5),
      },
    }))
  }

  const undoLastNudge = () => {
    tweakSelected((stroke) => ({
      ...stroke,
      adjustments: {
        ...stroke.adjustments,
        localNudges: stroke.adjustments.localNudges.slice(0, -1),
      },
    }))
  }

  const resetSelected = () => {
    if (!selectedStrokeId || !selectedStroke) {
      return
    }
    activateEditing()
    updateStroke(selectedStrokeId, (stroke) => ({
      ...stroke,
      adjustments: createDefaultAdjustment(stroke.role),
    }))
  }

  return (
    <div className="three-editor">
      <svg
        className="three-canvas"
        viewBox="0 0 100 100"
        aria-label="三笔心情编辑器"
        onPointerDown={phase === 'draw' ? startDraw : activateEditing}
        onPointerMove={phase === 'draw' ? moveDraw : moveTune}
        onPointerUp={phase === 'draw' ? endDraw : stopTune}
        onPointerCancel={phase === 'draw' ? endDraw : stopTune}
      >
        <circle cx="50" cy="50" r="45" className="face-bg" />

        {phase === 'draw' ? (
          <>
            {strokes.map((stroke) => (
              <path key={stroke.id} d={pointsToSmoothPath(stroke.points)} className="three-draw-line" />
            ))}
            {draft ? <path d={pointsToSmoothPath(draft)} className="three-draw-line draft" /> : null}
          </>
        ) : (
          <>
            {editableStrokes.map((stroke) => {
              const adjusted = adjustedStrokeMap.get(stroke.id) ?? stroke.originalPoints
              const selected = stroke.id === selectedStrokeId
              const start = adjusted[0]
              const end = adjusted[adjusted.length - 1]
              const tone =
                stroke.role === 'mouth'
                  ? '#362315'
                  : stroke.role === 'unknown'
                    ? '#5d4634'
                    : '#473325'

              return (
                <g key={stroke.id} className={selected ? 'part-active' : ''}>
                  <path
                    d={pointsToSmoothPath(adjusted)}
                    className="line-shape"
                    style={{ strokeWidth: getAdjustedStrokeWidth(stroke), stroke: tone }}
                  />
                  <path
                    d={pointsToSmoothPath(adjusted)}
                    className="line-hit"
                    onPointerDown={beginStrokeNudge(stroke.id)}
                  />

                  {isEditing && selected && start && end ? (
                    <>
                      <circle
                        cx={start.x}
                        cy={start.y}
                        r={1.65}
                        className="handle-point"
                        onPointerDown={beginEdgeNudge(stroke.id, 'start')}
                      />
                      <circle
                        cx={end.x}
                        cy={end.y}
                        r={1.65}
                        className="handle-point"
                        onPointerDown={beginEdgeNudge(stroke.id, 'end')}
                      />
                    </>
                  ) : null}
                </g>
              )
            })}
          </>
        )}
      </svg>

      <div className="three-actions">
        {phase === 'draw' ? (
          <>
            <button type="button" className="ghost-btn" onClick={undoLast} disabled={strokes.length === 0}>
              撤销上一笔
            </button>
            <button type="button" className="ghost-btn warn" onClick={clearAll} disabled={strokes.length === 0}>
              清空
            </button>
            <button type="button" className="ghost-btn" onClick={completeDirectly} disabled={strokes.length !== 3}>
              直接完成
            </button>
            <button type="button" className="primary-btn" onClick={enterTune} disabled={strokes.length !== 3}>
              进入微调
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={`ghost-btn ${showAdvanced ? 'is-active' : ''}`}
              onClick={() => setShowAdvanced((prev) => !prev)}
            >
              {showAdvanced ? '收起更多' : '更多'}
            </button>
            <button type="button" className="ghost-btn" onClick={backToDraw}>
              返回重画
            </button>
            <button
              type="button"
              className={`ghost-btn ${tuneDone ? 'is-success' : ''}`}
              onClick={completeTune}
            >
              {tuneDone ? '已完成微调' : '完成微调'}
            </button>
            <button type="button" className="ghost-btn warn" onClick={clearAll}>
              清空重来
            </button>
          </>
        )}
      </div>

      {phase === 'tune' && selectedStroke && showAdvanced ? (
        <>
          <div className="role-row" role="group" aria-label="线条角色">
            <span className="role-title">当前线条：{roleLabel(selectedStroke.role)}</span>
            <button
              type="button"
              className={`mini-chip ${selectedStroke.role === 'leftEye' ? 'is-active' : ''}`}
              onClick={() => setRole('leftEye')}
            >
              这是左眼
            </button>
            <button
              type="button"
              className={`mini-chip ${selectedStroke.role === 'rightEye' ? 'is-active' : ''}`}
              onClick={() => setRole('rightEye')}
            >
              这是右眼
            </button>
            <button
              type="button"
              className={`mini-chip ${selectedStroke.role === 'mouth' ? 'is-active' : ''}`}
              onClick={() => setRole('mouth')}
            >
              这是嘴巴
            </button>
            <button
              type="button"
              className={`mini-chip ${selectedStroke.role === 'unknown' ? 'is-active' : ''}`}
              onClick={() => setRole('unknown')}
            >
              只是线条
            </button>
          </div>

          <div className="semantic-row" role="group" aria-label="细调选项">
            {selectedStroke.role === 'mouth' ? (
              <>
                <button type="button" className="mini-chip" onClick={() => tweakMouth('lift')}>
                  嘴角上扬一点
                </button>
                <button type="button" className="mini-chip" onClick={() => tweakMouth('inward')}>
                  嘴角内收一点
                </button>
                <button type="button" className="mini-chip" onClick={() => tweakMouth('sag')}>
                  中间垂一点
                </button>
              </>
            ) : selectedStroke.role === 'leftEye' || selectedStroke.role === 'rightEye' ? (
              <>
                <button type="button" className="mini-chip" onClick={() => tweakEye('liftOuter')}>
                  眼尾挑一点
                </button>
                <button type="button" className="mini-chip" onClick={() => tweakEye('dropOuter')}>
                  眼尾垂一点
                </button>
                <button type="button" className="mini-chip" onClick={() => tweakEye('squint')}>
                  眯一点
                </button>
              </>
            ) : null}

            <button type="button" className="mini-chip" onClick={() => tweakTension('soft')}>
              松一点
            </button>
            <button type="button" className="mini-chip" onClick={() => tweakTension('tight')}>
              紧一点
            </button>
            <button
              type="button"
              className="mini-chip"
              onClick={undoLastNudge}
              disabled={selectedStroke.adjustments.localNudges.length === 0}
            >
              撤销轻推
            </button>
            <button type="button" className="mini-chip" onClick={resetSelected}>
              重置这条线
            </button>
          </div>
        </>
      ) : null}

      <p className="editor-hint">
        {phase === 'draw'
          ? completedFace
            ? '已完成三笔。你可以直接保存，或进入微调继续细化。'
            : `先自由画三笔（${strokes.length}/3）。画完后可直接完成，或进入微调。`
          : '点一下线条进入编辑态。拖动线条做“轻推局部”，5秒后会自动收起编辑标识。'}
      </p>
    </div>
  )
}
