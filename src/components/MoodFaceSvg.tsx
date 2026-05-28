import { applyStrokeAdjustments, getAdjustedStrokeWidth, pointsToSmoothPath } from '../lib/strokeAdjust'
import type { ArcParams, MoodFace, Point, Stroke } from '../types/mood'

type MoodFaceSvgProps = {
  face: MoodFace
  className?: string
}

function clamp(v: number, min: number, max: number): number {
  if (Number.isNaN(v)) return 0
  return Math.max(min, Math.min(max, v))
}

function sanitizeArc(arc: ArcParams): ArcParams {
  return {
    x: clamp(arc.x, -10, 110),
    y: clamp(arc.y, -10, 110),
    width: clamp(arc.width, 1, 80),
    curve: clamp(arc.curve, -40, 40),
    tilt: clamp(arc.tilt, -40, 40),
    strokeWidth: clamp(arc.strokeWidth, 0.5, 10),
  }
}

function sanitizePoint(p: Point): Point {
  return {
    x: clamp(p.x, -20, 120),
    y: clamp(p.y, -20, 120),
    t: p.t,
    pressure: p.pressure != null ? clamp(p.pressure, 0, 1) : undefined,
  }
}

function arcPath(arc: ArcParams): string {
  const a = sanitizeArc(arc)
  const half = a.width / 2
  const x1 = a.x - half
  const y1 = a.y + a.tilt / 2
  const x2 = a.x + half
  const y2 = a.y - a.tilt / 2
  const cx = a.x
  const cy = a.y - a.curve
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`
}

function freehandPath(stroke: Stroke): string {
  return pointsToSmoothPath(stroke.points.map(sanitizePoint))
}

export function MoodFaceSvg({ face, className }: MoodFaceSvgProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <circle cx="50" cy="50" r="45" className="mood-face-bg" />

      {face.mode === 'parametric' ? (
        <>
          <path d={arcPath(face.leftEye)} className="mood-face-line" style={{ strokeWidth: face.leftEye.strokeWidth }} />
          <path d={arcPath(face.rightEye)} className="mood-face-line" style={{ strokeWidth: face.rightEye.strokeWidth }} />
          <path d={arcPath(face.mouth)} className="mood-face-line mood-face-mouth" style={{ strokeWidth: face.mouth.strokeWidth }} />
        </>
      ) : face.mode === 'freehand' ? (
        <>
          {face.strokes.map((stroke) => {
            if (stroke.points.length === 0) {
              return null
            }
            return (
              <path
                key={stroke.id}
                d={freehandPath(stroke)}
                className="mood-face-line"
                style={{ strokeWidth: stroke.strokeWidth }}
              />
            )
          })}
        </>
      ) : (
        <>
          {face.strokes.map((stroke) => {
            const clampedOriginal = stroke.originalPoints.map(sanitizePoint)
            const points = applyStrokeAdjustments(clampedOriginal, stroke.adjustments, stroke.role)
            if (points.length === 0) {
              return null
            }
            return (
              <path
                key={stroke.id}
                d={pointsToSmoothPath(points)}
                className="mood-face-line"
                style={{ strokeWidth: clamp(getAdjustedStrokeWidth(stroke), 0.5, 10) }}
              />
            )
          })}
        </>
      )}
    </svg>
  )
}
