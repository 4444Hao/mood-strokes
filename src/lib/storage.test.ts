import { getDefaultPreset } from './presets'
import {
  createEntry,
  getEntryByDate,
  getStorageStats,
  listAllEntries,
  markEntriesSyncedByDate,
  replaceAllEntries,
  saveEntryWithOptions,
  saveOrUpdateEntry,
} from './storage'

describe('storage', () => {
  it('creates and updates an entry by date', () => {
    const date = '2026-05-24'
    const first = saveOrUpdateEntry({
      date,
      note: '今天有点累',
    })
    expect(first.syncStatus).toBe('local')
    expect(first.face.mode).toBe('parametric')

    const updated = saveOrUpdateEntry({
      date,
      note: '更新后的备注',
    })
    expect(updated.syncStatus).toBe('dirty')
    expect(getEntryByDate(date)?.note).toBe('更新后的备注')
  })

  it('marks selected entries as synced', () => {
    const a = createEntry({ date: '2026-05-20', note: 'a' })
    const b = createEntry({ date: '2026-05-21', note: 'b' })
    saveEntryWithOptions({ ...a, syncStatus: 'dirty' }, { preserveUpdatedAt: true })
    saveEntryWithOptions({ ...b, syncStatus: 'local' }, { preserveUpdatedAt: true })

    markEntriesSyncedByDate(['2026-05-20'])
    expect(getEntryByDate('2026-05-20')?.syncStatus).toBe('synced')
    expect(getEntryByDate('2026-05-21')?.syncStatus).toBe('local')
  })

  it('computes sync-aware stats', () => {
    const baseFace = getDefaultPreset().face
    replaceAllEntries([
      {
        id: '1',
        date: '2026-05-01',
        face: baseFace,
        note: 'n1',
        createdAt: '2026-05-01T10:00:00.000Z',
        updatedAt: '2026-05-01T10:00:00.000Z',
        syncStatus: 'synced',
      },
      {
        id: '2',
        date: '2026-05-02',
        face: { mode: 'freehand', strokes: [] },
        note: undefined,
        createdAt: '2026-05-02T10:00:00.000Z',
        updatedAt: '2026-05-02T10:00:00.000Z',
        syncStatus: 'dirty',
      },
      {
        id: '3',
        date: '2026-05-03',
        face: baseFace,
        note: 'n3',
        createdAt: '2026-05-03T10:00:00.000Z',
        updatedAt: '2026-05-03T10:00:00.000Z',
        syncStatus: 'local',
      },
    ])

    const stats = getStorageStats()
    expect(stats.total).toBe(3)
    expect(stats.parametric).toBe(2)
    expect(stats.freehand).toBe(1)
    expect(stats.withNote).toBe(2)
    expect(stats.synced).toBe(1)
    expect(stats.dirty).toBe(1)
    expect(stats.localOnly).toBe(1)
    expect(listAllEntries()).toHaveLength(3)
  })
})
