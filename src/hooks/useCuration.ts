import { useCallback, useEffect, useRef, useState } from 'react'
import {
  approveSubmission,
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

const PAGE_SIZE = 12

export function useCuration(auth: AuthSummary) {
  const [featuredTemplates, setFeaturedTemplates] = useState<FeaturedTemplate[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [mySubmissions, setMySubmissions] = useState<MoodSubmission[]>([])
  const [reviewQueue, setReviewQueue] = useState<MoodSubmission[]>([])
  const offsetRef = useRef(0)

  useEffect(() => {
    if (!auth.configured) {
      setFeaturedTemplates([])
      setHasMore(false)
      offsetRef.current = 0
      return
    }
    void listFeaturedTemplates(PAGE_SIZE, 0)
      .then((list) => {
        setFeaturedTemplates(list)
        setHasMore(list.length >= PAGE_SIZE)
        offsetRef.current = list.length
      })
      .catch(() => setFeaturedTemplates([]))
  }, [auth.configured])

  const loadMoreFeatured = useCallback(async () => {
    try {
      const list = await listFeaturedTemplates(PAGE_SIZE, offsetRef.current)
      if (list.length === 0) {
        setHasMore(false)
        return
      }
      setFeaturedTemplates((prev) => [...prev, ...list])
      offsetRef.current += list.length
      setHasMore(list.length >= PAGE_SIZE)
    } catch {
      // silently ignore
    }
  }, [])

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
    },
    [reloadCuration],
  )

  const handleApproveSubmission = useCallback(
    async (submissionId: string, reviewComment?: string) => {
      await approveSubmission(submissionId, reviewComment)
      await reloadCuration()
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
    hasMore,
    loadMoreFeatured,
    mySubmissions,
    reviewQueue,
    reloadCuration,
    handleSubmitMood,
    handleWithdrawSubmission,
    handleApproveSubmission,
    handleRejectSubmission,
    handleFeatureSubmission,
  }
}
