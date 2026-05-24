import type { ParametricFace } from '../types/mood'

type PresetDef = {
  id: string
  label: string
  face: ParametricFace
}

const baseStroke = 4

export const FACE_PRESETS: PresetDef[] = [
  {
    id: 'smile',
    label: '微笑',
    face: {
      mode: 'parametric',
      presetId: 'smile',
      leftEye: { x: 33, y: 35, width: 18, curve: 3, tilt: -4, strokeWidth: baseStroke },
      rightEye: { x: 67, y: 35, width: 18, curve: 3, tilt: 4, strokeWidth: baseStroke },
      mouth: { x: 50, y: 64, width: 34, curve: 8, tilt: 0, strokeWidth: baseStroke },
    },
  },
  {
    id: 'calm',
    label: '平静',
    face: {
      mode: 'parametric',
      presetId: 'calm',
      leftEye: { x: 33, y: 36, width: 18, curve: 1, tilt: 0, strokeWidth: baseStroke },
      rightEye: { x: 67, y: 36, width: 18, curve: 1, tilt: 0, strokeWidth: baseStroke },
      mouth: { x: 50, y: 63, width: 32, curve: 0, tilt: 0, strokeWidth: baseStroke },
    },
  },
  {
    id: 'low',
    label: '低落',
    face: {
      mode: 'parametric',
      presetId: 'low',
      leftEye: { x: 33, y: 37, width: 17, curve: -2, tilt: -2, strokeWidth: baseStroke },
      rightEye: { x: 67, y: 37, width: 17, curve: -2, tilt: 2, strokeWidth: baseStroke },
      mouth: { x: 50, y: 65, width: 30, curve: -7, tilt: 0, strokeWidth: baseStroke },
    },
  },
  {
    id: 'tired-smile',
    label: '疲惫的微笑',
    face: {
      mode: 'parametric',
      presetId: 'tired-smile',
      leftEye: { x: 33, y: 36, width: 16, curve: -1, tilt: -6, strokeWidth: baseStroke },
      rightEye: { x: 67, y: 37, width: 16, curve: -2, tilt: 6, strokeWidth: baseStroke },
      mouth: { x: 50, y: 64, width: 31, curve: 4, tilt: -2, strokeWidth: baseStroke },
    },
  },
  {
    id: 'hold-on',
    label: '有点撑住',
    face: {
      mode: 'parametric',
      presetId: 'hold-on',
      leftEye: { x: 33, y: 35, width: 17, curve: 0, tilt: -3, strokeWidth: baseStroke },
      rightEye: { x: 67, y: 35, width: 17, curve: 0, tilt: 3, strokeWidth: baseStroke },
      mouth: { x: 50, y: 64, width: 33, curve: -1, tilt: 2, strokeWidth: baseStroke },
    },
  },
]

export function getPresetById(id: string): PresetDef | undefined {
  return FACE_PRESETS.find((item) => item.id === id)
}

export function getDefaultPreset(): PresetDef {
  return FACE_PRESETS[1]
}
