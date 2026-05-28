import { toMonthKey } from './date'
import { getDefaultPreset } from './presets'
import type { MoodEntry, MoodFace } from '../types/mood'

const STORAGE_KEY = 'three-line-mood.entries.v1'

type MoodEntryMap = Record<string, MoodEntry>

let cachedStore: MoodEntryMap | null = null

function invalidateCache(): void {
  cachedStore = null
}
export type StorageStats = {
  total: number
  parametric: number
  freehand: number
  expressive: number
  withNote: number
  localOnly: number
  dirty: number
  synced: number
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeRaw(payload: string): void {
  window.localStorage.setItem(STORAGE_KEY, payload)
}

function isMoodEntryMap(value: unknown): value is MoodEntryMap {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

const VALID_SYNC_STATUSES = new Set(['local', 'synced', 'dirty'])
const VALID_FACE_MODES = new Set(['parametric', 'freehand', 'expressive'])
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/

function validateEntry(key: string, entry: unknown): entry is MoodEntry {
  if (!entry || typeof entry !== 'object') return false
  const e = entry as Record<string, unknown>
  if (typeof e.id !== 'string' || !e.id) return false
  if (typeof e.date !== 'string' || !DATE_KEY_RE.test(e.date)) return false
  if (!e.face || typeof e.face !== 'object') return false
  const faceMode = (e.face as Record<string, unknown>).mode
  if (typeof faceMode !== 'string' || !VALID_FACE_MODES.has(faceMode)) return false
  if (typeof e.createdAt !== 'string' || Number.isNaN(Date.parse(e.createdAt))) return false
  if (typeof e.updatedAt !== 'string' || Number.isNaN(Date.parse(e.updatedAt))) return false
  if (typeof e.syncStatus !== 'string' || !VALID_SYNC_STATUSES.has(e.syncStatus)) return false
  if (e.key !== undefined && e.key !== key) return false
  return true
}

function validateStore(raw: MoodEntryMap): MoodEntryMap {
  let validCount = 0
  let invalidCount = 0
  const cleaned: MoodEntryMap = {}
  for (const [key, entry] of Object.entries(raw)) {
    if (validateEntry(key, entry)) {
      cleaned[key] = entry
      validCount += 1
    } else {
      invalidCount += 1
    }
  }
  if (invalidCount > 0) {
    console.warn(
      `[storage] 过滤了 ${invalidCount} 条无效数据（共 ${validCount + invalidCount} 条）。无效数据已从缓存中清除，原始 localStorage 数据未被修改。`,
    )
  }
  return cleaned
}

function readStore(): MoodEntryMap {
  if (cachedStore) {
    return cachedStore
  }
  const raw = readRaw()
  if (!raw) {
    cachedStore = {}
    return cachedStore
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (isMoodEntryMap(parsed)) {
      cachedStore = validateStore(parsed)
      return cachedStore
    }
    cachedStore = {}
    return cachedStore
  } catch {
    cachedStore = {}
    return cachedStore
  }
}

function writeStore(store: MoodEntryMap): void {
  cachedStore = store
  writeRaw(JSON.stringify(store))
}

function toStoreMap(entries: MoodEntry[]): MoodEntryMap {
  return entries.reduce<MoodEntryMap>((acc, entry) => {
    acc[entry.date] = entry
    return acc
  }, {})
}

export function listEntriesByMonth(monthKey: string): MoodEntry[] {
  return listAllEntries()
    .filter((entry) => toMonthKey(entry.date) === monthKey)
}

export function getEarliestDateKey(): string | undefined {
  const entries = listAllEntries()
  return entries[0]?.date
}

export function getEntryByDate(dateKey: string): MoodEntry | undefined {
  const store = readStore()
  return store[dateKey]
}

export function listAllEntries(): MoodEntry[] {
  const store = readStore()
  return Object.values(store).sort((a, b) => a.date.localeCompare(b.date))
}

export function saveEntry(entry: MoodEntry): MoodEntry {
  return saveEntryWithOptions(entry)
}

export function saveEntryWithOptions(
  entry: MoodEntry,
  options?: { preserveUpdatedAt?: boolean },
): MoodEntry {
  const store = readStore()
  const next: MoodEntry = {
    ...entry,
    updatedAt: options?.preserveUpdatedAt ? entry.updatedAt : new Date().toISOString(),
  }
  store[next.date] = next
  writeStore(store)
  return next
}

export function saveEntriesWithOptions(
  entries: MoodEntry[],
  options?: { preserveUpdatedAt?: boolean },
): void {
  const store = readStore()
  entries.forEach((entry) => {
    const next: MoodEntry = {
      ...entry,
      updatedAt: options?.preserveUpdatedAt ? entry.updatedAt : new Date().toISOString(),
    }
    store[next.date] = next
  })
  writeStore(store)
}

export function replaceAllEntries(entries: MoodEntry[]): void {
  writeStore(toStoreMap(entries))
}

export function createEntry(params: {
  date: string
  note?: string
  face?: MoodFace
}): MoodEntry {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    date: params.date,
    face: params.face ?? getDefaultPreset().face,
    note: params.note?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'local',
  }
}

export function saveOrUpdateEntry(params: {
  date: string
  note?: string
  face?: MoodFace
}): MoodEntry {
  const existing = getEntryByDate(params.date)
  if (!existing) {
    return saveEntry(createEntry(params))
  }

  return saveEntry({
    ...existing,
    face: params.face ?? existing.face,
    note: params.note?.trim() || undefined,
    syncStatus: 'dirty',
  })
}

export function clearAllEntries(): void {
  invalidateCache()
  window.localStorage.removeItem(STORAGE_KEY)
}

export function repairStore(): number {
  const raw = readRaw()
  if (!raw) return 0
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isMoodEntryMap(parsed)) return 0
    const cleaned = validateStore(parsed)
    const removed = Object.keys(parsed).length - Object.keys(cleaned).length
    if (removed > 0) {
      writeRaw(JSON.stringify(cleaned))
      cachedStore = cleaned
    }
    return removed
  } catch {
    return 0
  }
}

export function markEntriesSyncedByDate(dates: string[]): void {
  const set = new Set(dates)
  const entries = listAllEntries().map((entry) => {
    if (!set.has(entry.date)) {
      return entry
    }
    return {
      ...entry,
      syncStatus: 'synced' as const,
    }
  })
  replaceAllEntries(entries)
}

export function getStorageStats(): StorageStats {
  const entries = listAllEntries()
  return entries.reduce<StorageStats>(
    (acc, entry) => {
      acc.total += 1
      if (entry.face.mode === 'parametric') {
        acc.parametric += 1
      } else if (entry.face.mode === 'expressive') {
        acc.expressive += 1
      } else {
        acc.freehand += 1
      }
      if (entry.note) {
        acc.withNote += 1
      }
      if (entry.syncStatus === 'local') {
        acc.localOnly += 1
      } else if (entry.syncStatus === 'dirty') {
        acc.dirty += 1
      } else if (entry.syncStatus === 'synced') {
        acc.synced += 1
      }
      return acc
    },
    {
      total: 0,
      parametric: 0,
      freehand: 0,
      expressive: 0,
      withNote: 0,
      localOnly: 0,
      dirty: 0,
      synced: 0,
    },
  )
}

export function exportEntriesPayload(): string {
  const entries = listAllEntries()
  const payload = {
    product: '三笔心情',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    count: entries.length,
    entries,
  }
  return JSON.stringify(payload, null, 2)
}

type ImportResult = {
  added: number
  skipped: number
  errors: number
}

export function importEntriesPayload(jsonString: string): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonString)
  } catch {
    throw new Error('文件格式不正确，无法解析 JSON。')
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('文件格式不正确，缺少必要字段。')
  }

  const payload = parsed as Record<string, unknown>
  if (typeof payload.product !== 'string' || payload.product !== '三笔心情') {
    throw new Error('该文件不是三笔心情的导出数据。')
  }

  const entries = payload.entries
  if (!Array.isArray(entries)) {
    throw new Error('文件中没有找到有效的记录列表。')
  }

  const store = readStore()
  let added = 0
  let skipped = 0
  let errors = 0

  for (const entry of entries) {
    if (!validateEntry('_import_', entry)) {
      errors += 1
      continue
    }
    const existing = store[entry.date]
    if (existing) {
      const existingTime = Date.parse(existing.updatedAt)
      const importTime = Date.parse(entry.updatedAt)
      if (!Number.isNaN(existingTime) && !Number.isNaN(importTime) && existingTime >= importTime) {
        skipped += 1
        continue
      }
    }
    store[entry.date] = { ...entry, syncStatus: entry.syncStatus === 'synced' ? 'dirty' : entry.syncStatus }
    added += 1
  }

  writeStore(store)
  return { added, skipped, errors }
}
