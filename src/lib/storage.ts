import { toMonthKey } from './date'
import { getDefaultPreset } from './presets'
import type { MoodEntry, MoodFace } from '../types/mood'

const STORAGE_KEY = 'three-line-mood.entries.v1'

type MoodEntryMap = Record<string, MoodEntry>
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

function readStore(): MoodEntryMap {
  const raw = readRaw()
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (isMoodEntryMap(parsed)) {
      return parsed
    }
    return {}
  } catch {
    return {}
  }
}

function writeStore(store: MoodEntryMap): void {
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
  window.localStorage.removeItem(STORAGE_KEY)
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
