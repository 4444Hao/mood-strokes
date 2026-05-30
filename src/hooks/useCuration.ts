import { useCallback, useEffect, useState } from 'react'
import {
  featureSubmission,
  listFeaturedTemplates,
  listMySubmissions,
  listReviewQueue,
  rejectSubmission,
  submitMoodEntry,
  withdrawSubmission,
} from '../lib/curation'
import type { AuthSummary } from '../lib/cloudSync'
import type { FeaturedTemplate, MoodSubmission, SubmitMoodPayload } from '../types/curation'

export function useCuration(auth: AuthSummary) {
  const [featuredTemplates, setFeaturedTemplates] = useState<FeaturedTemplate[]>([])
  const [mySubmissions, setMySubmissions] = useState<MoodSubmission[]>([])
  const [reviewQueue, setReviewQueue] = useState<MoodSubmission[]>([])

  useEffect(() => {
    if (!auth.configured) {
      setFeaturedTemplates([])
      return
    }
    void listFeaturedTemplates(50, 0)
      .then(setFeaturedTemplates)
      .catch(() => setFeaturedTemplates([]))
  }, [auth.configured])

  const reloadCuration = useCallback(async () => {
    if (!auth.configured || !auth.signedIn) {
      setMySubmissions([])
      setReviewQueue([])
      return
    }
    try {
      const mine = await listMySubmissions()
      setMySubmissions(mine)
    } catch {
      setMySubmissions([])
    }
    if (auth.role === 'admin') {
      try {
        const queue = await listReviewQueue()
        setReviewQueue(queue)
      } catch {
        setReviewQueue([])
      }
    } else {
      setReviewQueue([])
    }
  }, [auth.configured, auth.role, auth.signedIn])

  useEffect(() => {
    void reloadCuration()
  }, [reloadCuration])

  const handleSubmitMood = useCallback(
    async (payload: SubmitMoodPayload) => {
      await submitMoodEntry(payload)
      await reloadCuration()
    },
    [reloadCuration],
  )

  const handleWithdrawSubmission = useCallback(
    async (submissionId: string) => {
      await withdrawSubmission(submissionId)
      await reloadCuration()
      try {
        const templates = await listFeaturedTemplates()
        setFeaturedTemplates(templates)
      } catch {
        setFeaturedTemplates([])
      }
    },
    [reloadCuration],
  )

  const handleRejectSubmission = useCallback(
    async (submissionId: string, reviewComment?: string) => {
      await rejectSubmission(submissionId, reviewComment)
      await reloadCuration()
    },
    [reloadCuration],
  )

  const handleFeatureSubmission = useCallback(
    async (submissionId: string, title: string, description?: string) => {
      await featureSubmission({ submissionId, title, description })
      await reloadCuration()
      try {
        const templates = await listFeaturedTemplates()
        setFeaturedTemplates(templates)
      } catch {
        setFeaturedTemplates([])
      }
    },
    [reloadCuration],
  )

  return {
    featuredTemplates,
    mySubmissions,
    reviewQueue,
    reloadCuration,
    handleSubmitMood,
    handleWithdrawSubmission,
    handleRejectSubmission,
    handleFeatureSubmission,
  }
}
