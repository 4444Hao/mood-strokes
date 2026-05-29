import type { MoodFace } from './mood'

export type UserRole = 'user' | 'admin'

export type SubmissionStatus =
  | 'uploaded'
  | 'approved'
  | 'rejected'
  | 'featured'
  | 'withdrawn'

export type MoodSubmission = {
  id: string
  userId: string
  authorDisplayName?: string
  entryDate: string
  face: MoodFace
  note?: string
  shareCaption?: string
  consentPublic: boolean
  consentTemplate: boolean
  isAnonymous: boolean
  status: SubmissionStatus
  reviewComment?: string
  reviewedBy?: string
  reviewedAt?: string
  createdAt: string
  updatedAt: string
}

export type FeaturedTemplate = {
  id: string
  sourceSubmissionId?: string
  createdBy: string
  authorUserId?: string
  authorName?: string
  isAnonymous?: boolean
  title: string
  description?: string
  face: MoodFace
  note?: string
  isActive: boolean
  createdAt: string
}

export type SubmitMoodPayload = {
  entryDate: string
  face: MoodFace
  note?: string
  shareCaption?: string
  consentPublic: boolean
  consentTemplate: boolean
  isAnonymous: boolean
}
