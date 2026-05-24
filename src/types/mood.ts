export type SyncStatus = 'local' | 'synced' | 'dirty'

export type Point = {
  x: number
  y: number
  pressure?: number
  t: number
}

export type Stroke = {
  id: string
  points: Point[]
  strokeWidth: number
}

export type StrokeRole = 'unknown' | 'leftEye' | 'rightEye' | 'mouth'

export type LocalNudge = {
  id: string
  center: Point
  delta: {
    x: number
    y: number
  }
  radius: number
  strength: number
}

export type MouthAdjustment = {
  leftCornerLift: number
  rightCornerLift: number
  cornerInward: number
  middleSag: number
  tension: number
  softness: number
}

export type EyeAdjustment = {
  innerCornerLift: number
  outerCornerLift: number
  squint: number
  wrinkle: number
  droop: number
}

export type StrokeAdjustment = {
  localNudges: LocalNudge[]
  tension: number
  softness: number
  weight: number
  mouth?: MouthAdjustment
  eye?: EyeAdjustment
}

export type StrokeStyle = {
  strokeWidth: number
}

export type EditableStroke = {
  id: string
  role: StrokeRole
  originalPoints: Point[]
  adjustments: StrokeAdjustment
  style: StrokeStyle
}

export type ArcParams = {
  x: number
  y: number
  width: number
  curve: number
  tilt: number
  strokeWidth: number
}

export type ParametricFace = {
  mode: 'parametric'
  leftEye: ArcParams
  rightEye: ArcParams
  mouth: ArcParams
  presetId?: string
}

export type FreehandFace = {
  mode: 'freehand'
  strokes: Stroke[]
}

export type ExpressiveFace = {
  mode: 'expressive'
  strokes: EditableStroke[]
}

export type MoodFace = ParametricFace | FreehandFace | ExpressiveFace

export type MoodEntry = {
  id: string
  date: string
  face: MoodFace
  note?: string
  createdAt: string
  updatedAt: string
  syncStatus: SyncStatus
}
