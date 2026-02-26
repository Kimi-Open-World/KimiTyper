import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, ChevronRight, Layers, Plus, Upload, FileJson, Trash2, X, Check, Book } from 'lucide-react'
import { useAppStore } from '@/store'
import { saveBooks, getAllBooks, deleteBook } from '@/db'
import { initializeBooks } from '@/data/books'
import { cn } from '@/lib/utils'
import type { WordBook } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createT } from '@/lib/i18n'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

// JSON 格式样例模板
const TEMPLATE_BOOK: WordBook = {
  id: 'my-book-001',
  name: '我的词书示例',
  description: '词书描述',
  wordCount: 2,
  language: 'en',
  category: '自定义',
  chapters: [
    {
      id: 'ch-1',
      name: 'Chapter 1',
      description: '第一章',
      words: [
        {
          id: 1,
          word: 'example',
          phonetic: '/ɪɡˈzɑːmpl/',
          meaning: 'n. 例子；示例',
          example: 'This is an example sentence.',
        },
        {
          id: 2,
          word: 'template',
          phonetic: '/ˈtemplɪt/',
          meaning: 'n. 模板；样本',
          example: 'Use this template to create your word book.',
        },
      ],
    },
  ],
}

function downloadTemplate() {
  const content = JSON.stringify(TEMPLATE_BOOK, null, 2)
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'wordbook-template.json'
  a.click()
  URL.revokeObjectURL(url)
}

export default function BookSelection() {
  const navigate = useNavigate()
  const { progress, currentBook, setCurrentBook, settings } = useAppStore()
  const t = createT(settings.language)

  const [selectedBook, setSelectedBook] = useState<WordBook | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [books, setBooks] = useState<WordBook[]>([])
  const [importOpen, setImportOpen] = useState(false)
  const [importError, setImportError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const loadBooks = useCallback(async () => {
    const loadedBooks = await getAllBooks()

    // 获取最新的全量内置书籍 (包含动态载入的 electives)
    const builtins = await initializeBooks()
    const builtinIds = new Set(builtins.map((b) => b.id))

    // 保留用户自定义书（非内置 id 的书），并且把历史遗留的 yilin 书籍剔除掉
    const customBooks = loadedBooks.filter((b) => !builtinIds.has(b.id) && !b.id.startsWith('yilin'))

    // 始终用最新的 builtins 覆盖内置书（确保词汇更新立即生效）
    const merged = [...builtins, ...customBooks]
    await saveBooks(merged)
    setBooks(merged)
  }, [])

  useEffect(() => {
    loadBooks()
  }, [loadBooks])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setImportError('')
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0])
    }
  }

  const handleImport = async () => {
    if (!selectedFile) {
      setImportError(settings.language === 'zh' ? '请选择文件' : 'Please select a file')
      return
    }

    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string
          const importedBook = JSON.parse(content) as WordBook

          // 严格验证
          if (!importedBook.id || typeof importedBook.id !== 'string') {
            throw new Error(settings.language === 'zh' ? '缺少词书 id 字段' : 'Missing book id field')
          }
          if (!importedBook.name || typeof importedBook.name !== 'string') {
            throw new Error(settings.language === 'zh' ? '缺少词书 name 字段' : 'Missing book name field')
          }
          if (!Array.isArray(importedBook.chapters) || importedBook.chapters.length === 0) {
            throw new Error(settings.language === 'zh' ? 'chapters 字段必须是非空数组' : 'chapters must be a non-empty array')
          }
          for (const ch of importedBook.chapters) {
            if (!ch.id || !ch.name || !Array.isArray(ch.words)) {
              throw new Error(settings.language === 'zh' ? `章节 "${ch.name || '?'}" 格式不正确` : `Chapter "${ch.name || '?'}" has invalid format`)
            }
            for (const w of ch.words) {
              if (!w.id || !w.word || !w.meaning) {
                throw new Error(settings.language === 'zh'
                  ? `单词 "${w.word || '?'}" 缺少必要字段 (id, word, meaning)`
                  : `Word "${w.word || '?'}" missing required fields`)
              }
            }
          }

          // 自动计算 wordCount
          importedBook.wordCount = importedBook.chapters.reduce(
            (s, c) => s + (c.words?.length || 0),
            0
          )

          await saveBooks([importedBook])
          await loadBooks()
          setImportOpen(false)
          setSelectedFile(null)
          setImportError('')
        } catch (parseError) {
          setImportError((parseError as Error).message)
        }
      }
      reader.readAsText(selectedFile)
    } catch (error) {
      setImportError((error as Error).message)
    }
  }

  const handleDeleteBook = async (bookId: string) => {
    await deleteBook(bookId)
    await loadBooks()
    setDeleteConfirm(null)
  }

  const categories = [...new Set(books.map((book) => book.category))]

  const handleBookClick = (book: WordBook) => {
    if (book.chapters && book.chapters.length > 0) {
      setSelectedBook(book)
    } else {
      setCurrentBook(book)
      navigate(`/learn/${book.id}`)
    }
  }

  const handleChapterClick = (book: WordBook, chapterId: string) => {
    setCurrentBook(book)
    navigate(`/learn/${book.id}/${chapterId}`)
  }

  // 计算词书总进度（汇总所有章节）
  const getBookProgress = (book: WordBook) => {
    if (book.chapters && book.chapters.length > 0) {
      let totalCompleted = 0
      for (const ch of book.chapters) {
        const key = `${book.id}-${ch.id}`
        totalCompleted += progress[key]?.completedWords?.length || 0
      }
      const pct = book.wordCount > 0 ? Math.min(Math.round((totalCompleted / book.wordCount) * 100), 100) : 0
      return { completed: totalCompleted, percent: pct }
    } else {
      const bp = progress[book.id]
      const completed = bp?.completedWords?.length || 0
      return {
        completed,
        percent: book.wordCount > 0 ? Math.min(Math.round((completed / book.wordCount) * 100), 100) : 0,
      }
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{t('books.title')}</h1>
        <p className="text-muted-foreground">{t('books.subtitle')}</p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        {/* 新建词书 */}
        <button
          onClick={() => navigate('/custom-book')}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t('books.createCustom')}
        </button>

        {/* 导入词书 */}
        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              {t('books.import')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>{t('import.title')}</DialogTitle>
              <DialogDescription>{t('import.desc')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* 格式说明 */}
              <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
                <div className="flex items-center gap-2 font-medium mb-2">
                  <FileJson className="h-4 w-4 text-primary" />
                  <span>{settings.language === 'zh' ? 'JSON 格式要求：' : 'JSON Format Requirements:'}</span>
                </div>
                <p className="text-muted-foreground">
                  {settings.language === 'zh'
                    ? '必填字段：id (唯一), name, chapters (数组)。'
                    : 'Required: id (unique), name, chapters (array).'}
                </p>
                <p className="text-muted-foreground">
                  {settings.language === 'zh'
                    ? '每章节需要：id, name, words (数组)。'
                    : 'Each chapter needs: id, name, words (array).'}
                </p>
                <p className="text-muted-foreground">
                  {settings.language === 'zh'
                    ? '每个单词需要：id (数字), word, meaning。'
                    : 'Each word needs: id (number), word, meaning.'}
                </p>
              </div>
              <Input
                id="wordbook-file"
                type="file"
                accept=".json"
                onChange={handleFileChange}
              />
              {importError && (
                <p className="text-sm text-destructive rounded-lg bg-destructive/10 p-2">{importError}</p>
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={downloadTemplate} className="flex items-center gap-2">
                <FileJson className="h-4 w-4" />
                {t('import.template')}
              </Button>
              <Button onClick={handleImport}>{t('import.doImport')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Book List by Category */}
      {categories.map((category) => (
        <div key={category} className="space-y-4">
          <h2 className="text-lg font-semibold text-muted-foreground">{category}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {books
              .filter((book) => book.category === category)
              .map((book) => {
                const { percent } = getBookProgress(book)
                const chapterCount = book.chapters?.length || 0
                const isCustom = book.isCustom

                return (
                  <div
                    key={book.id}
                    className={cn(
                      'relative overflow-hidden rounded-xl border bg-card transition-all',
                      currentBook?.id === book.id && 'border-primary ring-1 ring-primary'
                    )}
                  >
                    {/* Book Header */}
                    <button
                      onClick={() => handleBookClick(book)}
                      className="group w-full p-6 text-left hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'rounded-lg p-3',
                            isCustom ? 'bg-purple-500/10' : 'bg-primary/10'
                          )}>
                            <BookOpen className={cn(
                              'h-6 w-6',
                              isCustom ? 'text-purple-500' : 'text-primary'
                            )} />
                          </div>
                          <div>
                            <h3 className="font-semibold flex items-center gap-2">
                              {book.name}
                              {isCustom && (
                                <span className="text-[10px] rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5">
                                  {settings.language === 'zh' ? '自定义' : 'Custom'}
                                </span>
                              )}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {chapterCount > 0
                                ? `${chapterCount} ${t('books.chapters')}`
                                : `${book.wordCount} ${t('books.words')}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {chapterCount > 0 && (
                            <Layers className="h-4 w-4 text-muted-foreground" />
                          )}
                          <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                        </div>
                      </div>

                      <p className="mt-3 text-sm text-muted-foreground">{book.description}</p>

                      {/* Progress */}
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{t('books.totalProgress')}</span>
                          <span className="font-medium">{percent}%</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              isCustom ? 'bg-purple-500' : 'bg-primary'
                            )}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </button>

                    {/* Custom book actions */}
                    {isCustom && (
                      <div className="absolute top-3 right-3 flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteConfirm(book.id)
                          }}
                          className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title={t('custom.deleteBook')}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Delete Confirm */}
                    {deleteConfirm === book.id && (
                      <div className="border-t bg-destructive/5 p-3 flex items-center gap-3">
                        <p className="flex-1 text-sm text-destructive">{t('custom.deleteConfirm')}</p>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="rounded-lg px-3 py-1 text-sm hover:bg-accent transition-colors"
                        >
                          {t('common.cancel')}
                        </button>
                        <button
                          onClick={() => handleDeleteBook(book.id)}
                          className="rounded-lg bg-destructive px-3 py-1 text-sm text-white hover:bg-destructive/90 transition-colors"
                        >
                          {t('common.delete')}
                        </button>
                      </div>
                    )}

                  </div>
                )
              })}
          </div>
        </div>
      ))}

      {/* Chapters Overlay Modal */}
      {selectedBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6 overflow-hidden">
          {/* Modal Container */}
          <div className="relative w-full max-w-5xl bg-background text-foreground rounded-3xl shadow-2xl flex flex-col max-h-[90vh] border border-border/50 overflow-hidden transform transition-all">

            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between px-8 py-8 md:py-10 bg-muted/30 border-b border-border gap-6 sticky top-0 z-20">

              {/* Close Button */}
              <button
                onClick={() => setSelectedBook(null)}
                className="absolute top-4 right-4 sm:top-6 sm:right-6 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors p-2 rounded-full active:scale-95"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="mt-2">
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
                  {selectedBook.name}
                </h1>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm sm:text-[15px] font-medium text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    {selectedBook.chapters?.length || 0} 章节
                  </div>
                  <div>共 {selectedBook.wordCount} 词</div>
                  {selectedBook.description && (
                    <div className="w-full md:w-auto mt-1 md:mt-0 text-muted-foreground/80 break-all max-w-2xl text-sm">
                      {selectedBook.description}
                    </div>
                  )}
                </div>
              </div>

              <button
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm active:scale-95 transition-all self-start md:self-auto text-[15px] font-medium whitespace-nowrap"
                onClick={() => {
                  const firstIncompletePath = selectedBook.chapters?.[0]?.id;
                  if (firstIncompletePath) {
                    handleChapterClick(selectedBook, firstIncompletePath);
                  }
                }}
              >
                <Book className="w-4 h-4" />
                顺序学习
              </button>
            </div>

            {/* Chapter Grid (Scrollable Body) */}
            <div className="overflow-y-auto custom-scrollbar p-6 sm:p-8">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {selectedBook.chapters?.map((chapter) => {
                  const key = `${selectedBook.id}-${chapter.id}`
                  const chapterCompleted = progress[key]?.completedWords?.length || 0
                  const isCompleted = chapterCompleted >= (chapter.words.length || 1)
                  const percent = Math.min(Math.round((chapterCompleted / (chapter.words.length || 1)) * 100), 100)

                  return (
                    <button
                      key={chapter.id}
                      onClick={() => handleChapterClick(selectedBook, chapter.id)}
                      className={cn(
                        "group relative flex flex-col items-start p-4 md:p-5 rounded-2xl transition-all duration-200 overflow-hidden min-h-[105px] border",
                        isCompleted
                          ? "bg-primary/5 hover:bg-primary/10 border-primary/20 shadow-sm"
                          : "bg-card hover:bg-muted/60 border-border hover:border-primary/30 shadow-sm"
                      )}
                    >
                      <div className="flex justify-between items-start w-full relative z-10">
                        <span className="text-base sm:text-[17px] font-semibold tracking-wide text-foreground">
                          {chapter.name}
                        </span>
                        {isCompleted && (
                          <div className="rounded-full bg-green-500/20 dark:bg-green-500/10 p-1 flex items-center justify-center shrink-0 ml-2">
                            <Check className="w-4 h-4 text-green-600 dark:text-green-500" strokeWidth={3} />
                          </div>
                        )}
                      </div>

                      <span className="mt-auto pt-3 text-[13px] text-muted-foreground font-medium relative z-10">
                        {isCompleted ? "已完成" : (percent > 0 ? `已练习 ${percent}%` : "未练习")}
                      </span>

                      {/* Progress Bar Background for partial completion */}
                      {!isCompleted && percent > 0 && (
                        <div
                          className="absolute bottom-0 left-0 h-1 bg-primary/40 transition-all z-0"
                          style={{ width: `${percent}%` }}
                        />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
