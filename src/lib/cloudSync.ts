import type { Session } from '@supabase/supabase-js'
import type { MoodEntry } from '../types/mood'
import type { UserRole } from '../types/curation'
import {
  listAllEntries,
  markEntriesSyncedByDate,
  replaceAllEntries,
} from './storage'
import { getSupabaseClient, isSupabaseConfigured, MOOD_ENTRIES_TABLE, PROFILES_TABLE } from './supabase'

const SYNC_META_KEY = 'three-line-mood.sync-meta.v1'
const MAGIC_LINK_META_KEY = 'three-line-mood.magic-link-meta.v1'
export const EMAIL_SIGNIN_COOLDOWN_SECONDS = 90

type MagicLinkMeta = {
  lastSentAt?: string
}

type CloudMoodRow = {
  user_id: string
  date: string
  face: MoodEntry['face']
  note: string | null
  created_at: string
  updated_at: string
}

export type AuthSummary = {
  configured: boolean
  signedIn: boolean
  email?: string
  role?: UserRole
}

export type SyncSummary = {
  mode: SyncMode
  pushed: number
  pulled: number
  merged: number
  syncedAt: string
}

export type SyncMode = 'merge' | 'push_local' | 'pull_cloud'

export type SyncMeta = {
  lastSyncedAt?: string
  lastMode?: SyncMode
}

function ensureConfigured() {
  if (!isSupabaseConfigured()) {
    throw new Error('未配置 Supabase，请先设置 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY。')
  }
}

async function requireSession(): Promise<Session> {
  ensureConfigured()
  const client = getSupabaseClient()
  if (!client) {
    throw new Error('Supabase 客户端未初始化。')
  }
  const { data, error } = await client.auth.getSession()
  if (error) {
    throw new Error(error.message)
  }
  if (!data.session) {
    throw new Error('当前未登录，请先登录后同步。')
  }
  return data.session
}

function toCloudRow(userId: string, entry: MoodEntry): CloudMoodRow {
  return {
    user_id: userId,
    date: entry.date,
    face: entry.face,
    note: entry.note ?? null,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  }
}

function fromCloudRow(row: CloudMoodRow): MoodEntry {
  return {
    id: `${row.user_id}:${row.date}`,
    date: row.date,
    face: row.face,
    note: row.note ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: 'synced',
  }
}

function readSyncMeta(): SyncMeta {
  try {
    const raw = window.localStorage.getItem(SYNC_META_KEY)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw) as SyncMeta
    return parsed ?? {}
  } catch {
    return {}
  }
}

function writeSyncMeta(meta: SyncMeta): void {
  window.localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta))
}

function readMagicLinkMeta(): MagicLinkMeta {
  try {
    const raw = window.localStorage.getItem(MAGIC_LINK_META_KEY)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw) as MagicLinkMeta
    return parsed ?? {}
  } catch {
    return {}
  }
}

function writeMagicLinkMeta(meta: MagicLinkMeta): void {
  window.localStorage.setItem(MAGIC_LINK_META_KEY, JSON.stringify(meta))
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function getRedirectTarget(): string {
  const byEnv = import.meta.env.VITE_AUTH_REDIRECT_URL?.trim()
  if (byEnv) {
    return byEnv
  }
  return window.location.origin
}

function getCooldownRemainingSeconds(): number {
  const meta = readMagicLinkMeta()
  if (!meta.lastSentAt) {
    return 0
  }
  const lastSentAtMs = Date.parse(meta.lastSentAt)
  if (Number.isNaN(lastSentAtMs)) {
    return 0
  }
  const elapsedMs = Date.now() - lastSentAtMs
  const remainMs = EMAIL_SIGNIN_COOLDOWN_SECONDS * 1000 - elapsedMs
  if (remainMs <= 0) {
    return 0
  }
  return Math.ceil(remainMs / 1000)
}

function mapSignInErrorMessage(raw: string): string {
  const lower = raw.toLowerCase()
  if (lower.includes('for security purposes') || lower.includes('rate limit')) {
    return '发送太频繁了，请稍等 90 秒再试。同一邮箱每小时最多发送 30 次。'
  }
  if (lower.includes('email rate limit exceeded')) {
    return '当前邮箱发送频率受限，请稍后再试。'
  }
  if (lower.includes('email provider is disabled')) {
    return '邮箱登录当前未启用，请在 Supabase Authentication 中开启 Email Provider。'
  }
  if (lower.includes('invalid email')) {
    return '邮箱格式不正确，请检查后再试。'
  }
  return raw
}

function setLastSync(mode: SyncMode): string {
  const syncedAt = new Date().toISOString()
  writeSyncMeta({
    lastSyncedAt: syncedAt,
    lastMode: mode,
  })
  return syncedAt
}

export function getSyncMeta(): SyncMeta {
  return readSyncMeta()
}

export function getAuthRedirectTarget(): string {
  return getRedirectTarget()
}

export function getEmailSignInCooldownSeconds(): number {
  return getCooldownRemainingSeconds()
}

function mergeByLatest(local: MoodEntry[], cloud: MoodEntry[]): MoodEntry[] {
  const merged = new Map<string, MoodEntry>()
  local.forEach((entry) => merged.set(entry.date, entry))
  cloud.forEach((entry) => {
    const existing = merged.get(entry.date)
    if (!existing) {
      merged.set(entry.date, entry)
      return
    }
    const localTime = Date.parse(existing.updatedAt)
    const cloudTime = Date.parse(entry.updatedAt)
    if (Number.isNaN(localTime) || Number.isNaN(cloudTime)) {
      merged.set(entry.date, entry)
      return
    }
    if (cloudTime >= localTime) {
      merged.set(entry.date, entry)
    }
  })
  return Array.from(merged.values())
    .map((entry) => ({ ...entry, syncStatus: 'synced' as const }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

async function fetchCloudEntries(userId: string): Promise<MoodEntry[]> {
  const client = getSupabaseClient()
  if (!client) {
    throw new Error('Supabase 客户端未初始化。')
  }
  const { data, error } = await client
    .from(MOOD_ENTRIES_TABLE)
    .select('user_id,date,face,note,created_at,updated_at')
    .eq('user_id', userId)
    .order('date', { ascending: true })
  if (error) {
    throw new Error(error.message)
  }
  return ((data ?? []) as CloudMoodRow[]).map(fromCloudRow)
}

async function upsertCloudEntries(userId: string, entries: MoodEntry[]): Promise<void> {
  if (entries.length === 0) {
    return
  }
  const client = getSupabaseClient()
  if (!client) {
    throw new Error('Supabase 客户端未初始化。')
  }
  const rows = entries.map((entry) => toCloudRow(userId, entry))
  const { error } = await client
    .from(MOOD_ENTRIES_TABLE)
    .upsert(rows, { onConflict: 'user_id,date' })
  if (error) {
    throw new Error(error.message)
  }
}

async function deleteCloudEntriesByDates(userId: string, dates: string[]): Promise<void> {
  if (dates.length === 0) {
    return
  }
  const client = getSupabaseClient()
  if (!client) {
    throw new Error('Supabase 客户端未初始化。')
  }
  const { error } = await client
    .from(MOOD_ENTRIES_TABLE)
    .delete()
    .eq('user_id', userId)
    .in('date', dates)
  if (error) {
    throw new Error(error.message)
  }
}

export async function getAuthSummary(): Promise<AuthSummary> {
  if (!isSupabaseConfigured()) {
    return { configured: false, signedIn: false }
  }
  const client = getSupabaseClient()
  if (!client) {
    return { configured: false, signedIn: false }
  }
  const { data, error } = await client.auth.getSession()
  if (error || !data.session) {
    return { configured: true, signedIn: false }
  }
  const userId = data.session.user.id
  const { data: profile } = await client
    .from(PROFILES_TABLE)
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()
  return {
    configured: true,
    signedIn: true,
    email: data.session.user.email,
    role: (profile?.role as UserRole | undefined) ?? 'user',
  }
}

export async function signInWithEmail(email: string): Promise<void> {
  ensureConfigured()
  const normalized = normalizeEmail(email)
  if (!isValidEmail(normalized)) {
    throw new Error('请输入有效的邮箱地址。')
  }
  const cooldown = getCooldownRemainingSeconds()
  if (cooldown > 0) {
    throw new Error(`刚发送过登录链接，请 ${cooldown} 秒后再试。`)
  }
  const client = getSupabaseClient()
  if (!client) {
    throw new Error('Supabase 客户端未初始化。')
  }
  const { error } = await client.auth.signInWithOtp({
    email: normalized,
    options: {
      emailRedirectTo: getRedirectTarget(),
      shouldCreateUser: true,
    },
  })
  if (error) {
    throw new Error(mapSignInErrorMessage(error.message))
  }
  writeMagicLinkMeta({
    lastSentAt: new Date().toISOString(),
  })
}

export async function updateDisplayName(displayName: string): Promise<void> {
  const session = await requireSession()
  const client = getSupabaseClient()
  if (!client) throw new Error('Supabase 客户端未初始化。')
  const trimmed = displayName.trim()
  if (trimmed && trimmed.length > 20) throw new Error('昵称不能超过 20 个字符。')
  const { error } = await client
    .from(PROFILES_TABLE)
    .upsert({ user_id: session.user.id, display_name: trimmed || null }, { onConflict: 'user_id' })
  if (error) throw new Error(error.message)
}

export async function getDisplayName(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const client = getSupabaseClient()
  if (!client) return null
  const { data } = await client.auth.getSession()
  if (!data.session) return null
  const { data: profile } = await client
    .from(PROFILES_TABLE)
    .select('display_name')
    .eq('user_id', data.session.user.id)
    .maybeSingle()
  return profile?.display_name || null
}

export async function signOutCloud(): Promise<void> {
  ensureConfigured()
  const client = getSupabaseClient()
  if (!client) {
    throw new Error('Supabase 客户端未初始化。')
  }
  const { error } = await client.auth.signOut()
  if (error) {
    throw new Error(error.message)
  }
}

export async function syncWithCloud(mode: SyncMode = 'merge'): Promise<SyncSummary> {
  const session = await requireSession()
  const userId = session.user.id

  if (mode === 'pull_cloud') {
    const cloudEntries = await fetchCloudEntries(userId)
    replaceAllEntries(cloudEntries)
    const syncedAt = setLastSync(mode)
    return {
      mode,
      pushed: 0,
      pulled: cloudEntries.length,
      merged: cloudEntries.length,
      syncedAt,
    }
  }

  if (mode === 'push_local') {
    const localEntries = listAllEntries()
    await upsertCloudEntries(userId, localEntries)
    const cloudNow = await fetchCloudEntries(userId)
    const keepDates = new Set(localEntries.map((entry) => entry.date))
    const deleteDates = cloudNow
      .filter((entry) => !keepDates.has(entry.date))
      .map((entry) => entry.date)
    await deleteCloudEntriesByDates(userId, deleteDates)
    const nextLocal = localEntries.map((entry) => ({ ...entry, syncStatus: 'synced' as const }))
    replaceAllEntries(nextLocal)
    const syncedAt = setLastSync(mode)
    return {
      mode,
      pushed: localEntries.length,
      pulled: cloudNow.length,
      merged: nextLocal.length,
      syncedAt,
    }
  }

  const localEntries = listAllEntries()
  const pending = localEntries.filter((entry) => entry.syncStatus !== 'synced')
  if (pending.length > 0) {
    await upsertCloudEntries(userId, pending)
    markEntriesSyncedByDate(pending.map((entry) => entry.date))
  }
  const cloudEntries = await fetchCloudEntries(userId)
  const latestLocal = listAllEntries()
  const merged = mergeByLatest(latestLocal, cloudEntries)
  replaceAllEntries(merged)
  const syncedAt = setLastSync(mode)

  return {
    mode,
    pushed: pending.length,
    pulled: cloudEntries.length,
    merged: merged.length,
    syncedAt,
  }
}
