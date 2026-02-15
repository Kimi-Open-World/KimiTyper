import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { WordBook, LearningProgress } from '@/types'

interface KimiTyperDB extends DBSchema {
  books: {
    key: string
    value: WordBook
  }
  progress: {
    key: string
    value: LearningProgress
  }
}

const DB_NAME = 'KimiTyperDB'
const DB_VERSION = 1

let db: IDBPDatabase<KimiTyperDB> | null = null

export async function initDB(): Promise<IDBPDatabase<KimiTyperDB>> {
  if (db) return db

  db = await openDB<KimiTyperDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('books')) {
        db.createObjectStore('books', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('progress')) {
        db.createObjectStore('progress', { keyPath: 'bookId' })
      }
    },
  })

  return db
}

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

export async function getProgress(bookId: string): Promise<LearningProgress | undefined> {
  const database = await initDB()
  return database.get('progress', bookId)
}

export async function saveProgress(progress: LearningProgress): Promise<void> {
  const database = await initDB()
  await database.put('progress', progress)
}

export async function clearAllData(): Promise<void> {
  const database = await initDB()
  await database.clear('books')
  await database.clear('progress')
}
