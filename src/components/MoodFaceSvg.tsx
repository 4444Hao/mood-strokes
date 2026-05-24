import { applyStrokeAdjustments, getAdjustedStrokeWidth, pointsToSmoothPath } from '../lib/strokeAdjust'
import type { ArcParams, MoodFace, Stroke } from '../types/mood'

type MoodFaceSvgProps = {
  face: MoodFace
  className?: string
}

function arcPath(arc: ArcParams): string {
  const half = arc.width / 2
  const x1 = arc.x - half
  const y1 = arc.y + arc.tilt / 2
  const x2 = arc.x + half
  const y2 = arc.y - arc.tilt / 2
  const cx = arc.x
  const cy = arc.y - arc.curve
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`
}

function freehandPath(stroke: Stroke): string {
  return pointsToSmoothPath(stroke.points)
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
            const points = applyStrokeAdjustments(stroke.originalPoints, stroke.adjustments, stroke.role)
            if (points.length === 0) {
              return null
            }
            return (
              <path
                key={stroke.id}
                d={pointsToSmoothPath(points)}
                className="mood-face-line"
                style={{ strokeWidth: getAdjustedStrokeWidth(stroke) }}
              />
            )
          })}
        </>
      )}
    </svg>
  )
}
