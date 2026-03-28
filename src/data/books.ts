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

// 预生成的所有拓展词库元数据，避免初始启动拉取 10MB+ 的数据
const dynamicBooksMetadata: WordBook[] = [
  {
    "id": "biomedical",
    "name": "生物医学专业英语词汇",
    "description": "生物医学专业英语词汇，共 504 词",
    "wordCount": 504,
    "language": "en",
    "category": "理科专业",
    "chapters": []
  },
  {
    "id": "cet6",
    "name": "CET-6 核心词汇",
    "description": "大学英语六级核心词汇，共 2345 词",
    "wordCount": 2345,
    "language": "en",
    "category": "大学英语",
    "chapters": []
  },
  {
    "id": "chemistry",
    "name": "化学专业英语词汇",
    "description": "化学核心必背词汇，共 225 词",
    "wordCount": 225,
    "language": "en",
    "category": "理科专业",
    "chapters": []
  },
  {
    "id": "kaoyan",
    "name": "考研英语核心词汇",
    "description": "2024 考研英语必背词汇，共 3731 词",
    "wordCount": 3731,
    "language": "en",
    "category": "大学英语",
    "chapters": []
  },
  {
    "id": "math",
    "name": "数学专业英语词汇",
    "description": "数学专业核心必备词汇，共 231 词",
    "wordCount": 231,
    "language": "en",
    "category": "理科专业",
    "chapters": []
  },
  {
    "id": "physics",
    "name": "物理专业英语词汇",
    "description": "物理学核心必备词汇，共 240 词",
    "wordCount": 240,
    "language": "en",
    "category": "理科专业",
    "chapters": []
  },
  {
    "id": "toefl",
    "name": "TOEFL 核心词汇",
    "description": "托福考试核心高频词汇，共 4264 词",
    "wordCount": 4264,
    "language": "en",
    "category": "大学英语",
    "chapters": []
  },
  {
    "id": "ielts",
    "name": "IELTS 雅思词汇",
    "description": "雅思考试核心高频词汇，共 3555 词",
    "wordCount": 3555,
    "language": "en",
    "category": "大学英语",
    "chapters": []
  },
  {
    "id": "yilin_1",
    "name": "高中必修1",
    "description": "译林版高中必修1",
    "wordCount": 276,
    "language": "en",
    "category": "高中英语",
    "chapters": []
  },
  {
    "id": "yilin_2",
    "name": "高中必修2",
    "description": "译林版高中必修2",
    "wordCount": 297,
    "language": "en",
    "category": "高中英语",
    "chapters": []
  },
  {
    "id": "yilin_3",
    "name": "高中必修3",
    "description": "译林版高中必修3",
    "wordCount": 295,
    "language": "en",
    "category": "高中英语",
    "chapters": []
  },
  {
    "id": "yilin_elective_1",
    "name": "高中选择性必修1",
    "description": "译林版高中选择性必修1",
    "wordCount": 150,
    "language": "en",
    "category": "高中英语",
    "chapters": []
  },
  {
    "id": "yilin_elective_2",
    "name": "高中选择性必修2",
    "description": "译林版高中选择性必修2",
    "wordCount": 150,
    "language": "en",
    "category": "高中英语",
    "chapters": []
  },
  {
    "id": "yilin_elective_3",
    "name": "高中选择性必修3",
    "description": "译林版高中选择性必修3",
    "wordCount": 150,
    "language": "en",
    "category": "高中英语",
    "chapters": []
  }
];

export async function initializeBooks(): Promise<WordBook[]> {
  const loadedBooks = [...allBooks, ...dynamicBooksMetadata];
  for (const book of loadedBooks) {
    if (book.id === 'cet4' && (!book.chapters || book.chapters.length === 0)) {
      const module = await import('./cet4-chapters');
      book.chapters = module.cet4Chapters;
    }
  }
  return loadedBooks;
}
export const sampleCET4Book = cet4Book
export const allSampleBooks = allBooks
