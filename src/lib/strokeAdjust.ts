import type {
  EditableStroke,
  EyeAdjustment,
  LocalNudge,
  MouthAdjustment,
  Point,
  StrokeAdjustment,
  StrokeRole,
} from '../types/mood'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function clonePoints(points: Point[]): Point[] {
  return points.map((point) => ({ ...point }))
}

function pointAtIndexRatio(points: Point[], t: number): Point {
  if (points.length === 0) {
    return { x: 50, y: 50, t: Date.now() }
  }
  if (points.length === 1) {
    return { ...points[0] }
  }
  const safe = clamp(t, 0, 1)
  const scaled = safe * (points.length - 1)
  const left = Math.floor(scaled)
  const right = Math.min(points.length - 1, left + 1)
  const ratio = scaled - left
  const a = points[left]
  const b = points[right]
  return {
    x: lerp(a.x, b.x, ratio),
    y: lerp(a.y, b.y, ratio),
    t: Date.now(),
  }
}

function smoothOnce(points: Point[]): Point[] {
  if (points.length < 4) {
    return points
  }
  const next: Point[] = []
  next.push({ ...points[0] })
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1]
    const curr = points[i]
    const after = points[i + 1]
    next.push({
      ...curr,
      x: (prev.x + curr.x * 2 + after.x) / 4,
      y: (prev.y + curr.y * 2 + after.y) / 4,
    })
  }
  next.push({ ...points[points.length - 1] })
  return next
}

function applyLocalNudge(points: Point[], nudge: LocalNudge): Point[] {
  return points.map((point) => {
    const dx = point.x - nudge.center.x
    const dy = point.y - nudge.center.y
    const dist = Math.hypot(dx, dy)
    if (dist > nudge.radius) {
      return point
    }
    const falloff = (1 - dist / nudge.radius) ** 2
    return {
      ...point,
      x: point.x + nudge.delta.x * falloff * nudge.strength,
      y: point.y + nudge.delta.y * falloff * nudge.strength,
    }
  })
}

function applyMouthAdjustment(points: Point[], mouth: MouthAdjustment): Point[] {
  if (points.length < 2) {
    return points
  }
  const centerX = points.reduce((sum, point) => sum + point.x, 0) / points.length
  const centerY = points.reduce((sum, point) => sum + point.y, 0) / points.length

  return points.map((point, index) => {
    const t = index / (points.length - 1)
    const leftWeight = (1 - t) ** 1.8
    const rightWeight = t ** 1.8
    const centerWeight = Math.exp(-((t - 0.5) ** 2) / (2 * 0.18 * 0.18))
    const cornerWeight = leftWeight + rightWeight

    let x = point.x
    let y = point.y

    y -= mouth.leftCornerLift * leftWeight
    y -= mouth.rightCornerLift * rightWeight
    y += mouth.middleSag * centerWeight

    const inward = mouth.cornerInward * cornerWeight
    if (point.x <= centerX) {
      x += inward * 0.6
    } else {
      x -= inward * 0.6
    }

    const tightRatio = clamp(mouth.tension * 0.08, -0.25, 0.35)
    x = lerp(x, centerX, tightRatio)
    y = lerp(y, centerY, tightRatio * 0.55)

    return {
      ...point,
      x,
      y,
    }
  })
}

function applyEyeAdjustment(points: Point[], eye: EyeAdjustment, role: StrokeRole): Point[] {
  if (points.length < 2) {
    return points
  }
  const centerY = points.reduce((sum, point) => sum + point.y, 0) / points.length
  const minX = Math.min(...points.map((point) => point.x))
  const maxX = Math.max(...points.map((point) => point.x))
  const spanX = Math.max(maxX - minX, 0.01)

  return points.map((point) => {
    const px = (point.x - minX) / spanX
    const outerWeight = role === 'rightEye' ? px ** 1.8 : (1 - px) ** 1.8
    const innerWeight = role === 'rightEye' ? (1 - px) ** 1.8 : px ** 1.8
    const centerWeight = 1 - Math.abs(px - 0.5) * 2

    let x = point.x
    let y = point.y

    y -= eye.outerCornerLift * outerWeight
    y -= eye.innerCornerLift * innerWeight
    y += eye.droop * 0.5

    const squintRatio = clamp(eye.squint * 0.08, -0.25, 0.45)
    y = centerY + (y - centerY) * (1 - squintRatio)

    const wrinkle = eye.wrinkle * outerWeight * 0.28
    y -= wrinkle
    x += (role === 'rightEye' ? 1 : -1) * wrinkle * 0.25 * centerWeight

    return {
      ...point,
      x,
      y,
    }
  })
}

function applyTension(points: Point[], tension: number): Point[] {
  if (points.length < 3 || Math.abs(tension) < 0.01) {
    return points
  }
  const start = points[0]
  const end = points[points.length - 1]
  const ratio = clamp(tension * 0.1, -0.2, 0.4)

  return points.map((point, index) => {
    if (index === 0 || index === points.length - 1) {
      return point
    }
    const t = index / (points.length - 1)
    const lineX = lerp(start.x, end.x, t)
    const lineY = lerp(start.y, end.y, t)
    if (ratio >= 0) {
      return {
        ...point,
        x: lerp(point.x, lineX, ratio),
        y: lerp(point.y, lineY, ratio),
      }
    }
    const expand = 1 + Math.abs(ratio) * 0.8
    return {
      ...point,
      x: lineX + (point.x - lineX) * expand,
      y: lineY + (point.y - lineY) * expand,
    }
  })
}

function applySoftness(points: Point[], softness: number): Point[] {
  if (points.length < 4 || Math.abs(softness) < 0.01) {
    return points
  }
  const strength = clamp(Math.abs(softness) * 0.16, 0, 0.5)
  const smoothed = smoothOnce(points)

  if (softness > 0) {
    return points.map((point, index) => ({
      ...point,
      x: lerp(point.x, smoothed[index].x, strength),
      y: lerp(point.y, smoothed[index].y, strength),
    }))
  }

  return points.map((point, index) => ({
    ...point,
    x: point.x + (point.x - smoothed[index].x) * strength,
    y: point.y + (point.y - smoothed[index].y) * strength,
  }))
}

export function createDefaultAdjustment(role: StrokeRole): StrokeAdjustment {
  const base: StrokeAdjustment = {
    localNudges: [],
    tension: 0,
    softness: 0,
    weight: 0,
  }
  if (role === 'mouth') {
    base.mouth = {
      leftCornerLift: 0,
      rightCornerLift: 0,
      cornerInward: 0,
      middleSag: 0,
      tension: 0,
      softness: 0,
    }
  }
  if (role === 'leftEye' || role === 'rightEye') {
    base.eye = {
      innerCornerLift: 0,
      outerCornerLift: 0,
      squint: 0,
      wrinkle: 0,
      droop: 0,
    }
  }
  return base
}

export function getAdjustedStrokeWidth(stroke: EditableStroke): number {
  const base = stroke.style.strokeWidth
  const adjusted = base + stroke.adjustments.weight * 0.5
  return clamp(adjusted, 1.2, 6)
}

export function applyStrokeAdjustments(
  originalPoints: Point[],
  adjustment: StrokeAdjustment,
  role: StrokeRole,
): Point[] {
  let points = clonePoints(originalPoints)

  adjustment.localNudges.forEach((nudge) => {
    points = applyLocalNudge(points, nudge)
  })

  if (role === 'mouth' && adjustment.mouth) {
    points = applyMouthAdjustment(points, adjustment.mouth)
    points = applyTension(points, adjustment.mouth.tension)
    points = applySoftness(points, adjustment.mouth.softness)
  }

  if ((role === 'leftEye' || role === 'rightEye') && adjustment.eye) {
    points = applyEyeAdjustment(points, adjustment.eye, role)
  }

  points = applyTension(points, adjustment.tension)
  points = applySoftness(points, adjustment.softness)
  return points
}

export function pointsToSmoothPath(points: Point[]): string {
  if (points.length === 0) {
    return ''
  }
  if (points.length === 1) {
    const p = points[0]
    return `M ${p.x} ${p.y} L ${p.x} ${p.y}`
  }
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`
  }

  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length - 1; i += 1) {
    const p = points[i]
    const next = points[i + 1]
    const midX = (p.x + next.x) / 2
    const midY = (p.y + next.y) / 2
    d += ` Q ${p.x} ${p.y} ${midX} ${midY}`
  }
  const last = points[points.length - 1]
  const prev = points[points.length - 2]
  d += ` Q ${prev.x} ${prev.y} ${last.x} ${last.y}`
  return d
}

export function nearestPointOnStroke(
  points: Point[],
  target: { x: number; y: number },
): {
  point: Point
  t: number
} {
  if (points.length === 0) {
    return {
      point: { x: target.x, y: target.y, t: Date.now() },
      t: 0.5,
    }
  }
  if (points.length === 1) {
    return {
      point: { ...points[0] },
      t: 0.5,
    }
  }

  let bestDist = Number.POSITIVE_INFINITY
  let bestT = 0.5
  let bestPoint = points[0]

  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]
    const b = points[i]
    const vx = b.x - a.x
    const vy = b.y - a.y
    const segLenSq = vx * vx + vy * vy
    if (segLenSq === 0) {
      continue
    }
    const ux = target.x - a.x
    const uy = target.y - a.y
    const segT = clamp((ux * vx + uy * vy) / segLenSq, 0, 1)
    const px = a.x + vx * segT
    const py = a.y + vy * segT
    const distSq = (target.x - px) ** 2 + (target.y - py) ** 2
    if (distSq < bestDist) {
      bestDist = distSq
      bestPoint = { x: px, y: py, t: Date.now() }
      bestT = (i - 1 + segT) / (points.length - 1)
    }
  }

  return {
    point: bestPoint,
    t: clamp(bestT, 0.01, 0.99),
  }
}

export function pointAtStrokeT(points: Point[], t: number): Point {
  return pointAtIndexRatio(points, t)
}
