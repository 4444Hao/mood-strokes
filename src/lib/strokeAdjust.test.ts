import {
  applyStrokeAdjustments,
  createDefaultAdjustment,
  getAdjustedStrokeWidth,
  nearestPointOnStroke,
  pointAtStrokeT,
  pointsToSmoothPath,
} from './strokeAdjust'
import type { EditableStroke, Point, StrokeAdjustment } from '../types/mood'

function makePoints(count: number): Point[] {
  return Array.from({ length: count }, (_, i) => ({
    x: 10 + i * 5,
    y: 50 + Math.sin(i * 0.5) * 10,
    t: Date.now(),
  }))
}

function makeStroke(overrides: Partial<EditableStroke> = {}): EditableStroke {
  return {
    id: 's1',
    role: 'mouth',
    originalPoints: makePoints(10),
    adjustments: createDefaultAdjustment('mouth'),
    style: { strokeWidth: 3.4 },
    ...overrides,
  }
}

describe('strokeAdjust', () => {
  describe('createDefaultAdjustment', () => {
    it('creates mouth defaults with mouthAdjustment', () => {
      const adj = createDefaultAdjustment('mouth')
      expect(adj.mouth).toBeDefined()
      expect(adj.mouth!.leftCornerLift).toBe(0)
      expect(adj.mouth!.rightCornerLift).toBe(0)
      expect(adj.mouth!.cornerInward).toBe(0)
      expect(adj.mouth!.middleSag).toBe(0)
    })

    it('creates eye defaults with eyeAdjustment', () => {
      const adj = createDefaultAdjustment('leftEye')
      expect(adj.eye).toBeDefined()
      expect(adj.eye!.outerCornerLift).toBe(0)
      expect(adj.eye!.squint).toBe(0)
    })

    it('creates no role-specific adjustment for unknown', () => {
      const adj = createDefaultAdjustment('unknown')
      expect(adj.mouth).toBeUndefined()
      expect(adj.eye).toBeUndefined()
    })
  })

  describe('applyStrokeAdjustments', () => {
    it('returns identical points when no adjustments are applied', () => {
      const original = makePoints(8)
      const result = applyStrokeAdjustments(original, createDefaultAdjustment('mouth'), 'mouth')
      expect(result).toHaveLength(8)
      result.forEach((p, i) => {
        expect(p.x).toBeCloseTo(original[i].x, 5)
        expect(p.y).toBeCloseTo(original[i].y, 5)
      })
    })

    it('shifts points near a local nudge center', () => {
      const original = Array.from({ length: 5 }, (_, i) => ({
        x: 50,
        y: 50 + i * 5,
        t: Date.now(),
      }))
      const adjustment: StrokeAdjustment = {
        localNudges: [
          {
            id: 'n1',
            center: { x: 50, y: 55, t: 0 },
            delta: { x: 3, y: -2 },
            radius: 10,
            strength: 1,
          },
        ],
        tension: 0,
        softness: 0,
        weight: 0,
      }
      const result = applyStrokeAdjustments(original, adjustment, 'mouth')
      const midPoint = result[1] // y=55, closest to nudge center
      expect(midPoint.x).toBeGreaterThan(50)
      expect(midPoint.y).toBeLessThan(55)
    })

    it('applies mouth leftCornerLift to left side of mouth', () => {
      const original = Array.from({ length: 10 }, (_, i) => ({
        x: 20 + i * 6,
        y: 60,
        t: Date.now(),
      }))
      const adjustment = createDefaultAdjustment('mouth')
      adjustment.mouth!.leftCornerLift = 5
      const result = applyStrokeAdjustments(original, adjustment, 'mouth')
      // Left-most point should be lifted (lower y)
      expect(result[0].y).toBeLessThan(60)
    })

    it('applies mouth middleSag to center of mouth', () => {
      const original = Array.from({ length: 10 }, (_, i) => ({
        x: 20 + i * 6,
        y: 60,
        t: Date.now(),
      }))
      const adjustment = createDefaultAdjustment('mouth')
      adjustment.mouth!.middleSag = 5
      const result = applyStrokeAdjustments(original, adjustment, 'mouth')
      // Center point should sag (higher y)
      expect(result[5].y).toBeGreaterThan(60)
    })

    it('applies eye outerCornerLift based on role direction', () => {
      const points = Array.from({ length: 8 }, (_, i) => ({
        x: 20 + i * 5,
        y: 40,
        t: Date.now(),
      }))
      const adjRight = createDefaultAdjustment('rightEye')
      adjRight.eye!.outerCornerLift = 5
      const resultRight = applyStrokeAdjustments(points, adjRight, 'rightEye')
      // For rightEye, outer = right side (high px), should be lifted
      expect(resultRight[7].y).toBeLessThan(40)

      const adjLeft = createDefaultAdjustment('leftEye')
      adjLeft.eye!.outerCornerLift = 5
      const resultLeft = applyStrokeAdjustments(points, adjLeft, 'leftEye')
      // For leftEye, outer = left side (low px), should be lifted
      expect(resultLeft[0].y).toBeLessThan(40)
    })

    it('applies eye squint to compress vertically', () => {
      const points = Array.from({ length: 8 }, (_, i) => ({
        x: 25 + i * 5,
        y: 40 + (i % 3) * 2,
        t: Date.now(),
      }))
      const adj = createDefaultAdjustment('rightEye')
      adj.eye!.squint = 5
      const result = applyStrokeAdjustments(points, adj, 'rightEye')
      const origSpan = Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y))
      const resultSpan = Math.max(...result.map(p => p.y)) - Math.min(...result.map(p => p.y))
      expect(resultSpan).toBeLessThan(origSpan + 0.01)
    })

    it('applies tension to pull points toward the start-end line', () => {
      const points = Array.from({ length: 6 }, (_, i) => ({
        x: 20 + i * 8,
        y: 50 + (i === 3 ? 15 : 0),
        t: Date.now(),
      }))
      const adj: StrokeAdjustment = { localNudges: [], tension: 5, softness: 0, weight: 0 }
      const result = applyStrokeAdjustments(points, adj, 'mouth')
      // Middle point should be pulled toward the straight line
      const midBefore = Math.abs(points[3].y - 50)
      const midAfter = Math.abs(result[3].y - 50)
      expect(midAfter).toBeLessThan(midBefore)
    })

    it('applies softness to smooth points', () => {
      const points = Array.from({ length: 10 }, (_, i) => ({
        x: 10 + i * 8,
        y: 50 + (i % 2 === 0 ? 8 : -8),
        t: Date.now(),
      }))
      const adj: StrokeAdjustment = { localNudges: [], tension: 0, softness: 5, weight: 0 }
      const result = applyStrokeAdjustments(points, adj, 'mouth')
      // Smoothed points should have less variation between neighbors
      const origJitter = points.reduce((sum, p, i) => i > 0 ? sum + Math.abs(p.y - points[i-1].y) : sum, 0)
      const resultJitter = result.reduce((sum, p, i) => i > 0 ? sum + Math.abs(p.y - result[i-1].y) : sum, 0)
      expect(resultJitter).toBeLessThan(origJitter)
    })

    it('handles empty points array', () => {
      const result = applyStrokeAdjustments([], createDefaultAdjustment('mouth'), 'mouth')
      expect(result).toHaveLength(0)
    })

    it('handles single point', () => {
      const points = [{ x: 50, y: 50, t: Date.now() }]
      const result = applyStrokeAdjustments(points, createDefaultAdjustment('mouth'), 'mouth')
      expect(result).toHaveLength(1)
      expect(result[0].x).toBe(50)
      expect(result[0].y).toBe(50)
    })

    it('applies negative softness to sharpen', () => {
      const points = Array.from({ length: 10 }, (_, i) => ({
        x: 10 + i * 8,
        y: 50 + (i % 2 === 0 ? 8 : -8),
        t: Date.now(),
      }))
      const adj: StrokeAdjustment = { localNudges: [], tension: 0, softness: -5, weight: 0 }
      const result = applyStrokeAdjustments(points, adj, 'mouth')
      // Should not throw, and should return same number of points
      expect(result).toHaveLength(10)
    })
  })

  describe('getAdjustedStrokeWidth', () => {
    it('returns base width when weight is zero', () => {
      const stroke = makeStroke({ style: { strokeWidth: 3.4 } })
      expect(getAdjustedStrokeWidth(stroke)).toBeCloseTo(3.4, 2)
    })

    it('increases width with positive weight', () => {
      const stroke = makeStroke({
        style: { strokeWidth: 3 },
        adjustments: { ...createDefaultAdjustment('mouth'), weight: 5 },
      })
      expect(getAdjustedStrokeWidth(stroke)).toBeGreaterThan(3)
    })

    it('clamps to minimum 1.2', () => {
      const stroke = makeStroke({
        style: { strokeWidth: 1 },
        adjustments: { ...createDefaultAdjustment('mouth'), weight: -5 },
      })
      expect(getAdjustedStrokeWidth(stroke)).toBe(1.2)
    })

    it('clamps to maximum 6', () => {
      const stroke = makeStroke({
        style: { strokeWidth: 5 },
        adjustments: { ...createDefaultAdjustment('mouth'), weight: 5 },
      })
      expect(getAdjustedStrokeWidth(stroke)).toBeLessThanOrEqual(6)
    })
  })

  describe('pointsToSmoothPath', () => {
    it('returns empty string for empty points', () => {
      expect(pointsToSmoothPath([])).toBe('')
    })

    it('returns a point at single coordinate', () => {
      const path = pointsToSmoothPath([{ x: 30, y: 40, t: 0 }])
      expect(path).toContain('M')
      expect(path).toContain('30')
      expect(path).toContain('40')
    })

    it('returns a line for two points', () => {
      const path = pointsToSmoothPath([
        { x: 10, y: 20, t: 0 },
        { x: 30, y: 40, t: 0 },
      ])
      expect(path).toContain('M 10 20')
      expect(path).toContain('L 30 40')
    })

    it('uses quadratic curves for three or more points', () => {
      const points = makePoints(4)
      const path = pointsToSmoothPath(points)
      expect(path).toContain('Q')
    })
  })

  describe('nearestPointOnStroke', () => {
    it('finds nearest point on a horizontal line', () => {
      const points: Point[] = [
        { x: 0, y: 50, t: 0 },
        { x: 100, y: 50, t: 0 },
      ]
      const result = nearestPointOnStroke(points, { x: 50, y: 60 })
      expect(result.point.x).toBeCloseTo(50, 1)
      expect(result.point.y).toBeCloseTo(50, 1)
      expect(result.t).toBeCloseTo(0.5, 1)
    })

    it('returns center for empty input', () => {
      const result = nearestPointOnStroke([], { x: 50, y: 50 })
      expect(result.point.x).toBe(50)
      expect(result.point.y).toBe(50)
      expect(result.t).toBeCloseTo(0.5, 1)
    })

    it('clamps t to valid range', () => {
      const points: Point[] = [
        { x: 0, y: 0, t: 0 },
        { x: 100, y: 0, t: 0 },
      ]
      const result = nearestPointOnStroke(points, { x: -10, y: 0 })
      expect(result.t).toBeGreaterThanOrEqual(0)
      expect(result.t).toBeLessThanOrEqual(1)
    })
  })

  describe('pointAtStrokeT', () => {
    it('returns start point at t=0', () => {
      const points = makePoints(5)
      const result = pointAtStrokeT(points, 0)
      expect(result.x).toBeCloseTo(points[0].x, 2)
      expect(result.y).toBeCloseTo(points[0].y, 2)
    })

    it('returns end point at t=1', () => {
      const points = makePoints(5)
      const result = pointAtStrokeT(points, 1)
      expect(result.x).toBeCloseTo(points[4].x, 2)
      expect(result.y).toBeCloseTo(points[4].y, 2)
    })

    it('interpolates at t=0.5', () => {
      const points: Point[] = [
        { x: 0, y: 0, t: 0 },
        { x: 10, y: 10, t: 0 },
        { x: 20, y: 0, t: 0 },
      ]
      const result = pointAtStrokeT(points, 0.5)
      expect(result.x).toBeCloseTo(10, 2)
    })
  })
})
