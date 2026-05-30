import type { MoodFace } from '../types/mood'
import type {
  FeaturedTemplate,
  MoodSubmission,
  SubmitMoodPayload,
  SubmissionStatus,
  UserRole,
} from '../types/curation'
import {
  FEATURED_TEMPLATES_TABLE,
  MOOD_SUBMISSIONS_TABLE,
  PROFILES_TABLE,
  getSupabaseClient,
  isSupabaseConfigured,
} from './supabase'

type SubmissionRow = {
  id: string
  user_id: string
  entry_date: string
  face: MoodFace
  note: string | null
  share_caption: string | null
  consent_public: boolean
  consent_template: boolean
  is_anonymous?: boolean
  status: SubmissionStatus
  review_comment: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

type FeaturedTemplateRow = {
  id: string
  source_submission_id: string | null
  created_by: string
  title: string
  description: string | null
  face: MoodFace
  note: string | null
  is_anonymous?: boolean | null
  is_active: boolean
  created_at: string
}

type SubmissionAuthorRow = {
  id: string
  user_id: string
  is_anonymous?: boolean
}

type ProfileNameRow = {
  user_id: string
  display_name: string | null
}

export type CurationAuthSummary = {
  configured: boolean
  signedIn: boolean
  email?: string
  role?: UserRole
}

function ensureConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error('未配置 Supabase，请先设置 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY。')
  }
}

async function requireSessionUser(): Promise<{ id: string; email?: string }> {
  ensureConfigured()
  const client = getSupabaseClient()
  if (!client) {
    throw new Error('Supabase 客户端未初始化。')
  }
  const { data, error } = await client.auth.getSession()
  if (error) {
    throw new Error(error.message)
  }
  if (!data.session?.user) {
    throw new Error('当前未登录，请先登录后再操作。')
  }
  return {
    id: data.session.user.id,
    email: data.session.user.email,
  }
}

function fromSubmissionRow(row: SubmissionRow): MoodSubmission {
  return {
    id: row.id,
    userId: row.user_id,
    entryDate: row.entry_date,
    face: row.face,
    note: row.note ?? undefined,
    shareCaption: row.share_caption ?? undefined,
    consentPublic: row.consent_public,
    consentTemplate: row.consent_template,
    isAnonymous: Boolean(row.is_anonymous),
    status: row.status,
    reviewComment: row.review_comment ?? undefined,
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function fromTemplateRow(
  row: FeaturedTemplateRow,
  options?: { authorUserId?: string; authorName?: string; isAnonymous?: boolean },
): FeaturedTemplate {
  return {
    id: row.id,
    sourceSubmissionId: row.source_submission_id ?? undefined,
    createdBy: row.created_by,
    authorUserId: options?.authorUserId,
    authorName: options?.authorName,
    isAnonymous: options?.isAnonymous ?? Boolean(row.is_anonymous),
    title: row.title,
    description: row.description ?? undefined,
    face: row.face,
    note: row.note ?? undefined,
    isActive: row.is_active,
    createdAt: row.created_at,
  }
}

export async function getCurationAuthSummary(): Promise<CurationAuthSummary> {
  if (!isSupabaseConfigured()) {
    return { configured: false, signedIn: false }
  }
  const client = getSupabaseClient()
  if (!client) {
    return { configured: false, signedIn: false }
  }

  const { data, error } = await client.auth.getSession()
  if (error || !data.session?.user) {
    return { configured: true, signedIn: false }
  }

  const user = data.session.user
  const { data: profile } = await client
    .from(PROFILES_TABLE)
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  return {
    configured: true,
    signedIn: true,
    email: user.email,
    role: (profile?.role as UserRole | undefined) ?? 'user',
  }
}

export async function listFeaturedTemplates(limit = 12, offset = 0): Promise<FeaturedTemplate[]> {
  ensureConfigured()
  const client = getSupabaseClient()
  if (!client) {
    throw new Error('Supabase 客户端未初始化。')
  }

  let rows: FeaturedTemplateRow[]
  {
    const withAnonymous = await client
      .from(FEATURED_TEMPLATES_TABLE)
      .select('id,source_submission_id,created_by,title,description,face,note,is_anonymous,is_active,created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
      .limit(limit)
    if (withAnonymous.error && withAnonymous.error.message.includes('is_anonymous')) {
      const fallback = await client
        .from(FEATURED_TEMPLATES_TABLE)
        .select('id,source_submission_id,created_by,title,description,face,note,is_active,created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)
        .limit(limit)
      if (fallback.error) {
        throw new Error(fallback.error.message)
      }
      rows = (fallback.data ?? []) as FeaturedTemplateRow[]
    } else if (withAnonymous.error) {
      throw new Error(withAnonymous.error.message)
    } else {
      rows = (withAnonymous.data ?? []) as FeaturedTemplateRow[]
    }
  }

  if (rows.length === 0) {
    return []
  }

  const sourceIds = rows
    .map((row) => row.source_submission_id)
    .filter((id): id is string => Boolean(id))
  if (sourceIds.length === 0) {
    return rows.map((row) => fromTemplateRow(row))
  }

  const authorBySource = new Map<string, string>()
  const anonymousBySource = new Map<string, boolean>()
  {
    const withAnonymous = await client
      .from(MOOD_SUBMISSIONS_TABLE)
      .select('id,user_id,is_anonymous')
      .in('id', sourceIds)
    if (withAnonymous.error && withAnonymous.error.message.includes('is_anonymous')) {
      const fallback = await client
        .from(MOOD_SUBMISSIONS_TABLE)
        .select('id,user_id')
        .in('id', sourceIds)
      if (!fallback.error) {
        ;((fallback.data ?? []) as SubmissionAuthorRow[]).forEach((row) => {
          authorBySource.set(row.id, row.user_id)
        })
      }
    } else if (!withAnonymous.error) {
      ;((withAnonymous.data ?? []) as SubmissionAuthorRow[]).forEach((row) => {
        authorBySource.set(row.id, row.user_id)
        anonymousBySource.set(row.id, Boolean(row.is_anonymous))
      })
    }
  }

  const authorIds = Array.from(new Set(Array.from(authorBySource.values())))
  const nameByUser = new Map<string, string>()
  if (authorIds.length > 0) {
    const { data: profileRows } = await client
      .from(PROFILES_TABLE)
      .select('user_id,display_name')
      .in('user_id', authorIds)
    ;((profileRows ?? []) as ProfileNameRow[]).forEach((row) => {
      if (row.display_name && row.display_name.trim()) {
        nameByUser.set(row.user_id, row.display_name.trim())
      }
    })
  }

  return rows.map((row) => {
    const sourceId = row.source_submission_id ?? ''
    const authorUserId = authorBySource.get(sourceId)
    const authorName = authorUserId ? nameByUser.get(authorUserId) : undefined
    const isAnonymous = anonymousBySource.get(sourceId) ?? Boolean(row.is_anonymous)
    return fromTemplateRow(row, { authorUserId, authorName, isAnonymous })
  })
}

export async function submitMoodEntry(payload: SubmitMoodPayload): Promise<MoodSubmission> {
  await requireSessionUser()
  const client = getSupabaseClient()
  if (!client) {
    throw new Error('Supabase 客户端未初始化。')
  }

  if (!payload.consentPublic || !payload.consentTemplate) {
    throw new Error('投稿前请先确认公开展示与模板授权。')
  }

  const { data, error } = await client
    .rpc('submit_mood_submission', {
      p_entry_date: payload.entryDate,
      p_face: payload.face,
      p_note: payload.note?.trim() || null,
      p_share_caption: payload.shareCaption?.trim() || null,
      p_consent_public: payload.consentPublic,
      p_consent_template: payload.consentTemplate,
      p_is_anonymous: payload.isAnonymous,
    })
    .single()

  if (error) {
    const message = error.message.toLowerCase()
    if (message.includes('submit_mood_submission')) {
      throw new Error('数据库尚未启用投稿限流函数。请先执行最新的 Supabase 迁移 SQL。')
    }
    if (message.includes('你本小时投稿次数已达上限')) {
      throw new Error('你本小时投稿次数已达上限（10次），请稍后再试。')
    }
    if (error.message.includes('is_anonymous')) {
      throw new Error('数据库尚未启用匿名投稿字段。请先执行迁移 SQL 后重试。')
    }
    throw new Error(error.message)
  }

  return fromSubmissionRow(data as SubmissionRow)
}

export async function listMySubmissions(limit = 30): Promise<MoodSubmission[]> {
  const user = await requireSessionUser()
  const client = getSupabaseClient()
  if (!client) {
    throw new Error('Supabase 客户端未初始化。')
  }

  const { data, error } = await client
    .from(MOOD_SUBMISSIONS_TABLE)
    .select('id,user_id,entry_date,face,note,share_caption,consent_public,consent_template,is_anonymous,status,review_comment,reviewed_by,reviewed_at,created_at,updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(error.message)
  }

  const submissions = ((data ?? []) as SubmissionRow[]).map(fromSubmissionRow)
  return attachDisplayNames(submissions)
}

export async function withdrawSubmission(submissionId: string): Promise<void> {
  await requireSessionUser()
  const client = getSupabaseClient()
  if (!client) {
    throw new Error('Supabase 客户端未初始化。')
  }

  const { error } = await client.rpc('withdraw_submission', {
    p_submission_id: submissionId,
  })

  if (error) {
    const message = error.message.toLowerCase()
    if (message.includes('withdraw_submission')) {
      throw new Error('数据库尚未启用撤回联动函数。请先执行最新的 Supabase 迁移 SQL。')
    }
    throw new Error(error.message)
  }
}

async function requireAdminUser(): Promise<{ id: string }> {
  const user = await requireSessionUser()
  const client = getSupabaseClient()
  if (!client) {
    throw new Error('Supabase 客户端未初始化。')
  }

  const { data, error } = await client
    .from(PROFILES_TABLE)
    .select('user_id,role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data || data.role !== 'admin') {
    throw new Error('当前账号不是管理员，无法进行精选审核。')
  }

  return { id: user.id }
}

async function attachDisplayNames(submissions: MoodSubmission[]): Promise<MoodSubmission[]> {
  if (submissions.length === 0) return submissions
  const userIds = Array.from(new Set(submissions.map((s) => s.userId)))
  const client = getSupabaseClient()
  if (!client) return submissions
  const nameMap = new Map<string, string>()
  try {
    const { data } = await client
      .from(PROFILES_TABLE)
      .select('user_id,display_name')
      .in('user_id', userIds)
    ;((data ?? []) as ProfileNameRow[]).forEach((row) => {
      if (row.display_name?.trim()) nameMap.set(row.user_id, row.display_name.trim())
    })
  } catch { /* ignore */ }
  return submissions.map((s) => ({
    ...s,
    authorDisplayName: nameMap.get(s.userId),
  }))
}

export async function listReviewQueue(limit = 60): Promise<MoodSubmission[]> {
  await requireAdminUser()
  const client = getSupabaseClient()
  if (!client) {
    throw new Error('Supabase 客户端未初始化。')
  }

  const { data, error } = await client
    .from(MOOD_SUBMISSIONS_TABLE)
    .select('id,user_id,entry_date,face,note,share_caption,consent_public,consent_template,is_anonymous,status,review_comment,reviewed_by,reviewed_at,created_at,updated_at')
    .in('status', ['uploaded'])
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(error.message)
  }

  const submissions = ((data ?? []) as SubmissionRow[]).map(fromSubmissionRow)
  return attachDisplayNames(submissions)
}

export async function rejectSubmission(submissionId: string, reviewComment?: string): Promise<void> {
  const admin = await requireAdminUser()
  const client = getSupabaseClient()
  if (!client) {
    throw new Error('Supabase 客户端未初始化。')
  }

  const { error } = await client
    .from(MOOD_SUBMISSIONS_TABLE)
    .update({
      status: 'rejected',
      review_comment: reviewComment?.trim() || '暂不入选精选，欢迎继续投稿。',
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', submissionId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function approveSubmission(submissionId: string, reviewComment?: string): Promise<void> {
  const admin = await requireAdminUser()
  const client = getSupabaseClient()
  if (!client) {
    throw new Error('Supabase 客户端未初始化。')
  }

  const { error } = await client
    .from(MOOD_SUBMISSIONS_TABLE)
    .update({
      status: 'approved',
      review_comment: reviewComment?.trim() || '这条心情很有细节，已通过审核。',
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', submissionId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function featureSubmission(params: {
  submissionId: string
  title: string
  description?: string
}): Promise<void> {
  const admin = await requireAdminUser()
  const client = getSupabaseClient()
  if (!client) {
    throw new Error('Supabase 客户端未初始化。')
  }

  const { error } = await client.rpc('feature_submission', {
    p_submission_id: params.submissionId,
    p_admin_id: admin.id,
    p_title: params.title.trim(),
    p_description: params.description?.trim() || null,
  })

  if (error) {
    const message = error.message.toLowerCase()
    if (message.includes('feature_submission')) {
      throw new Error('数据库尚未启用入选模板函数。请先执行最新的 Supabase 迁移 SQL。')
    }
    if (message.includes('未授权作为模板')) {
      throw new Error('该投稿未授权作为模板，无法入选。')
    }
    if (message.includes('不是管理员')) {
      throw new Error('当前账号不是管理员，无法进行精选审核。')
    }
    throw new Error(error.message)
  }
}

export async function archiveFeaturedTemplate(templateId: string): Promise<void> {
  await requireAdminUser()
  const client = getSupabaseClient()
  if (!client) {
    throw new Error('Supabase 客户端未初始化。')
  }

  const { error } = await client
    .from(FEATURED_TEMPLATES_TABLE)
    .update({ is_active: false })
    .eq('id', templateId)

  if (error) {
    throw new Error(error.message)
  }
}
