import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { WordBook, LearningProgress, SM2Card } from '@/types'

// ── 词语详情缓存条目 ──
// 独立于 WordBook，按词书ID + 单词ID 索引
// 为未来按需加载详情准备，当前可为空
export interface WordDetail {
  /** 复合主键 `{bookId}:{wordId}` */
  id: string
  bookId: string
  wordId: number
  word: string
  // 词源详情（来自 etymology_data_sample.jsonl 或 AI 生成）
  prefix?: string
  root?: string
  suffix?: string
  etymology?: string
  wordFormation?: string
  cognates?: string[]
  // 扩展例句（未来可加多条）
  examples?: string[]
  // 缓存时间，用于过期检测
  cachedAt: string
}

// ── 词书加载状态缓存 ──
export interface BookLoadCache {
  bookId: string
  version: string
  loadedAt: string
}

interface KimiTyperDB extends DBSchema {
  books: {
    key: string
    value: WordBook
  }
  progress: {
    key: string
    value: LearningProgress
  }
  etymology: {
    key: string
    value: {
      word: string
      etymology_summary: string
      etymology_cognates: string[]
    }
  }
  sm2cards: {
    key: string  // `${bookId}-${wordId}`
    value: SM2Card & { id: string }
    indexes: {
      byBookId: string
      byNextReview: string
    }
  }
  // ── v4 新增：独立词语详情缓存 ──
  wordDetails: {
    key: string  // `{bookId}:{wordId}`
    value: WordDetail
    indexes: {
      byBookId: string
    }
  }
  // ── v4 新增：词书加载状态 ──
  bookLoadCache: {
    key: string  // bookId
    value: BookLoadCache
  }
}

const DB_NAME = 'KimiTyperDB'
const DB_VERSION = 4  // 升级到 v4

let db: IDBPDatabase<KimiTyperDB> | null = null

export async function initDB(): Promise<IDBPDatabase<KimiTyperDB>> {
  if (db) return db

  db = await openDB<KimiTyperDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('books', { keyPath: 'id' })
        db.createObjectStore('progress', { keyPath: 'bookId' })
      }
      if (oldVersion < 2) {
        db.createObjectStore('etymology', { keyPath: 'word' })
      }
      if (oldVersion < 3) {
        const sm2Store = db.createObjectStore('sm2cards', { keyPath: 'id' })
        sm2Store.createIndex('byBookId', 'bookId')
        sm2Store.createIndex('byNextReview', 'nextReview')
      }
      if (oldVersion < 4) {
        // 词语详情独立缓存（按需加载核心）
        const wordDetailStore = db.createObjectStore('wordDetails', { keyPath: 'id' })
        wordDetailStore.createIndex('byBookId', 'bookId')
        // 词书加载状态追踪
        db.createObjectStore('bookLoadCache', { keyPath: 'bookId' })
      }
    },
    blocked() {
      console.warn('DB upgrade blocked by another tab')
    },
  })

  return db
}

// ===== Book CRUD =====

export async function getAllBooks(): Promise<WordBook[]> {
  const database = await initDB()
  return database.getAll('books')
}

export async function getBook(id: string): Promise<WordBook | undefined> {
  const database = await initDB()
  return database.get('books', id)
}

export async function saveBook(book: WordBook): Promise<void> {
  const database = await initDB()
  await database.put('books', book)
}

export async function saveBooks(books: WordBook[]): Promise<void> {
  const database = await initDB()
  const tx = database.transaction('books', 'readwrite')
  await Promise.all(books.map((book) => tx.store.put(book)))
  await tx.done
}

export async function deleteBook(id: string): Promise<void> {
  const database = await initDB()
  await database.delete('books', id)
}

// ===== Progress =====

export async function getProgress(bookId: string): Promise<LearningProgress | undefined> {
  const database = await initDB()
  return database.get('progress', bookId)
}

export async function saveProgress(progress: LearningProgress): Promise<void> {
  const database = await initDB()
  await database.put('progress', progress)
}

export async function deleteProgress(bookId: string): Promise<void> {
  const database = await initDB()
  await database.delete('progress', bookId)
}

// ===== SM2 Cards =====

export async function getSM2Card(bookId: string, wordId: number): Promise<SM2Card | undefined> {
  const database = await initDB()
  // We need to store with a custom key field
  const all = await database.getAllFromIndex('sm2cards', 'byBookId', bookId)
  return all.find((c) => c.wordId === wordId)
}

export async function saveSM2Card(card: SM2Card): Promise<void> {
  const database = await initDB()
  const cardWithId = { ...card, id: `${card.bookId}-${card.wordId}` }
  await database.put('sm2cards', cardWithId as SM2Card & { id: string })
}

export async function getSM2CardsByBook(bookId: string): Promise<SM2Card[]> {
  const database = await initDB()
  return database.getAllFromIndex('sm2cards', 'byBookId', bookId)
}

export async function getAllSM2Cards(): Promise<SM2Card[]> {
  const database = await initDB()
  return database.getAll('sm2cards')
}

export async function getDueSM2Cards(): Promise<SM2Card[]> {
  const database = await initDB()
  const all = await database.getAll('sm2cards')
  const now = new Date()
  now.setHours(23, 59, 59, 999)
  return all.filter((c) => new Date(c.nextReview) <= now)
}

// ===== Etymology =====

export async function importEtymologyData(
  etymologyRecords: { word: string; etymology_summary: string; etymology_cognates: string[] }[]
): Promise<void> {
  const database = await initDB()
  const tx = database.transaction('etymology', 'readwrite')
  await Promise.all(etymologyRecords.map((record) => tx.store.put(record)))
  await tx.done
}

export async function getEtymologyData(
  word: string
): Promise<{ word: string; etymology_summary: string; etymology_cognates: string[] } | undefined> {
  const database = await initDB()
  return database.get('etymology', word)
}

// ===== Word Details（按需加载详情缓存）=====

/**
 * 获取单个词语的详细信息（先查缓存）
 */
export async function getWordDetail(bookId: string, wordId: number): Promise<WordDetail | undefined> {
  const database = await initDB()
  return database.get('wordDetails', `${bookId}:${wordId}`)
}

/**
 * 批量获取某词书的所有词语详情（用于整本书预加载）
 */
export async function getWordDetailsByBook(bookId: string): Promise<WordDetail[]> {
  const database = await initDB()
  return database.getAllFromIndex('wordDetails', 'byBookId', bookId)
}

/**
 * 保存词语详情到缓存
 */
export async function saveWordDetail(detail: Omit<WordDetail, 'id' | 'cachedAt'>): Promise<void> {
  const database = await initDB()
  const record: WordDetail = {
    ...detail,
    id: `${detail.bookId}:${detail.wordId}`,
    cachedAt: new Date().toISOString(),
  }
  await database.put('wordDetails', record)
}

/**
 * 批量保存词语详情（整本书一次性写入）
 */
export async function saveWordDetails(details: Omit<WordDetail, 'id' | 'cachedAt'>[]): Promise<void> {
  const database = await initDB()
  const now = new Date().toISOString()
  const tx = database.transaction('wordDetails', 'readwrite')
  await Promise.all(
    details.map((d) =>
      tx.store.put({
        ...d,
        id: `${d.bookId}:${d.wordId}`,
        cachedAt: now,
      })
    )
  )
  await tx.done
}

/**
 * 删除某词书的所有缓存详情（用于更新词书时清理旧缓存）
 */
export async function clearWordDetailsByBook(bookId: string): Promise<void> {
  const database = await initDB()
  const all = await database.getAllFromIndex('wordDetails', 'byBookId', bookId)
  const tx = database.transaction('wordDetails', 'readwrite')
  await Promise.all(all.map((d) => tx.store.delete(d.id)))
  await tx.done
}

// ===== Book Load Cache（词书加载状态）=====

/**
 * 检查词书是否已缓存（比较版本号）
 */
export async function isBookDetailsCached(bookId: string, version?: string): Promise<boolean> {
  const database = await initDB()
  const cache = await database.get('bookLoadCache', bookId)
  if (!cache) return false
  // 如果传了版本号，检查版本是否一致
  if (version && cache.version !== version) return false
  return true
}

/**
 * 标记词书详情已缓存
 */
export async function markBookDetailsCached(bookId: string, version: string = '1.0'): Promise<void> {
  const database = await initDB()
  await database.put('bookLoadCache', {
    bookId,
    version,
    loadedAt: new Date().toISOString(),
  })
}

// ===== Clear =====

export async function clearAllData(): Promise<void> {
  const database = await initDB()
  await database.clear('books')
  await database.clear('progress')
  await database.clear('etymology')
  await database.clear('sm2cards')
  await database.clear('wordDetails')
  await database.clear('bookLoadCache')
}
