import type { WordBook } from '@/types'

export const cet4Book: WordBook = {
  id: 'cet4',
  name: 'CET-4 核心词汇',
  description: '大学英语四级核心词汇，共 1097 词',
  wordCount: 1097,
  language: 'en',
  category: '大学英语',
  dataUrl: '/words/cet4.json',  // 词语详情按需加载 JSON
  version: "1.7",               // 更新此版本号可触发缓存刷新
  chapters: [] /* LOADED DYNAMICALLY */,
}

export const allBooks: WordBook[] = [cet4Book]

export async function initializeBooks(): Promise<WordBook[]> {
  const loadedBooks = [...allBooks];
  for (const book of loadedBooks) {
    if (book.id === 'cet4' && (!book.chapters || book.chapters.length === 0)) {
      const module = await import('./cet4-chapters');
      book.chapters = module.cet4Chapters;
    }
  }
  // 动态自动注入拓展词库：包括高中必修、选修以及大学拓展（六级、考研）
  const dynamicIds = [
    'yilin_1', 'yilin_2', 'yilin_3',
    'yilin_elective_1', 'yilin_elective_2', 'yilin_elective_3',
    'cet6', 'kaoyan', 'biomedical', 'toefl', 'ielts'
  ];
  for (const id of dynamicIds) {
    try {
      const res = await fetch(`/books/${id}_book.json?v=${Date.now()}`);
      if (res.ok) {
        const bookData = await res.json();
        const b = Array.isArray(bookData) ? bookData[0] : bookData;
        if (b) {
          const index = loadedBooks.findIndex(existing => existing.id === b.id);
          if (index >= 0) {
            loadedBooks[index] = b;
          } else {
            loadedBooks.push(b);
          }
        }
      }
    } catch (e) {
      console.warn(`Failed to load compulsory book ${id}`, e);
    }
  }

  return loadedBooks;
}
export const sampleCET4Book = cet4Book
export const allSampleBooks = allBooks
