/**
 * wordLoader.ts
 * 词语详情按需加载工具
 *
 * 三层缓存策略（由快到慢）：
 *   1. 内存缓存（Map）      → 毫秒级，页面刷新后失效
 *   2. IndexedDB 缓存       → 毫秒级，跨会话持久化
 *   3. 远程 JSON fetch      → 网络请求，结果写入 IndexedDB
 *
 * 当前阶段（≤2000词）：books.ts 内嵌全量数据，本模块直接从 Word 对象读取
 * 未来阶段（>5000词）：在 WordBook 上设置 dataUrl，自动切换为按需加载
 *   调用方代码无需修改！
 */

import type { Word, WordBook } from '@/types'
import {
    getWordDetail,
    getWordDetailsByBook,
    saveWordDetails,
    isBookDetailsCached,
    markBookDetailsCached,
    type WordDetail,
} from '@/db'

// ── 内存缓存（热路径优化）──
// key: `{bookId}:{wordId}`
const memoryCache = new Map<string, WordDetail>()

// ── 内存缓存：单词详情 ──
function getFromMemory(bookId: string, wordId: number): WordDetail | undefined {
    return memoryCache.get(`${bookId}:${wordId}`)
}

function setToMemory(detail: WordDetail): void {
    memoryCache.set(detail.id, detail)
}

// ── 从 Word 对象提取已有详情字段 ──
function wordToDetail(word: Word, bookId: string): WordDetail {
    return {
        id: `${bookId}:${word.id}`,
        bookId,
        wordId: word.id,
        word: word.word,
        prefix: word.prefix,
        root: word.root,
        suffix: word.suffix,
        etymology: word.etymology,
        wordFormation: word.wordFormation,
        cognates: word.cognates,
        examples: word.example ? [word.example] : undefined,
        cachedAt: new Date().toISOString(),
    }
}

// ── 核心：获取单词详情（三层缓存）──
/**
 * 获取单词详情
 * @param word     当前 Word 对象（内嵌数据阶段直接用）
 * @param book     所属词书（用于判断是否需要按需加载）
 * @returns        WordDetail（带缓存）
 */
export async function getWordDetailCached(word: Word, book: WordBook): Promise<WordDetail> {
    const bookId = book.id

    // 1. 内存缓存命中
    const fromMemory = getFromMemory(bookId, word.id)
    if (fromMemory) return fromMemory

    // 2. 如果该词书没有 dataUrl（当前内嵌模式），直接从 Word 对象构造
    if (!book.dataUrl) {
        const detail = wordToDetail(word, bookId)
        setToMemory(detail)
        return detail
    }

    // 3. 有 dataUrl（按需加载模式），先查明版本并加载最新
    await loadBookDetails(book)

    // 4. 从 IndexedDB 查（此时如果版本更新，已经是新数据了）
    const fromDB = await getWordDetail(bookId, word.id)
    if (fromDB) {
        setToMemory(fromDB)
        return fromDB
    }

    // 6. 兜底：返回 Word 对象本身有的字段
    const fallback = wordToDetail(word, bookId)
    setToMemory(fallback)
    return fallback
}

// ── 整本书详情预加载（按需加载模式核心）──
/**
 * 加载词书的完整详情 JSON，写入 IndexedDB
 * 只在以下情况触发：
 *   - 首次打开某词书
 *   - 词书版本号变更
 */
export async function loadBookDetails(book: WordBook): Promise<void> {
    if (!book.dataUrl) return  // 内嵌模式，跳过

    // 检查是否已缓存（版本一致）
    const cached = await isBookDetailsCached(book.id, book.version)
    if (cached) return

    clearMemoryCache(book.id)

    try {
        console.log(`[wordLoader] 按需加载词书详情: ${book.id} from ${book.dataUrl}`)
        const fetchUrl = book.dataUrl.includes('?') ? `${book.dataUrl}&v=${book.version}` : `${book.dataUrl}?v=${book.version}`
        const response = await fetch(fetchUrl)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        // 期望格式：{ words: WordDetail[] } 或 WordDetail[]
        const data = await response.json()
        const details: Omit<WordDetail, 'id' | 'cachedAt'>[] = Array.isArray(data) ? data : data.words

        // 批量写入 IndexedDB
        await saveWordDetails(details.map((d) => ({ ...d, bookId: book.id })))
        await markBookDetailsCached(book.id, book.version)

        console.log(`[wordLoader] ✅ 已缓存 ${details.length} 条词语详情 (${book.id})`)
    } catch (err) {
        console.warn(`[wordLoader] ⚠️ 加载词书详情失败 (${book.id}):`, err)
        // 失败不报错，降级到内嵌数据
    }
}

// ── 批量预热内存缓存（进入词书学习页时调用）──
/**
 * 将某词书的所有 IndexedDB 缓存预加载到内存
 * 在进入学习页时调用，确保学习过程中零延迟
 */
export async function warmupMemoryCache(bookId: string): Promise<void> {
    const details = await getWordDetailsByBook(bookId)
    for (const detail of details) {
        setToMemory(detail)
    }
    console.log(`[wordLoader] 🔥 内存预热完成: ${details.length} 词 (${bookId})`)
}

// ── 清理内存缓存（退出词书时调用）──
export function clearMemoryCache(bookId?: string): void {
    if (!bookId) {
        memoryCache.clear()
        return
    }
    for (const key of memoryCache.keys()) {
        if (key.startsWith(`${bookId}:`)) {
            memoryCache.delete(key)
        }
    }
}

// ── 工具：检查单词是否有详情数据 ──
export function hasWordDetails(word: Word): boolean {
    return !!(word.prefix || word.root || word.suffix || word.etymology || word.wordFormation)
}
