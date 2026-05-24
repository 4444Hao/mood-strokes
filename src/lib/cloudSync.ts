import type { Session } from '@supabase/supabase-js'
import type { MoodEntry } from '../types/mood'
import {
  listAllEntries,
  markEntriesSyncedByDate,
  replaceAllEntries,
} from './storage'
import { getSupabaseClient, isSupabaseConfigured, MOOD_ENTRIES_TABLE } from './supabase'

const SYNC_META_KEY = 'three-line-mood.sync-meta.v1'

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
  return {
    configured: true,
    signedIn: true,
    email: data.session.user.email,
  }
}

export async function signInWithEmail(email: string): Promise<void> {
  ensureConfigured()
  const client = getSupabaseClient()
  if (!client) {
    throw new Error('Supabase 客户端未初始化。')
  }
  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin,
    },
  })
  if (error) {
    throw new Error(error.message)
  }
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
