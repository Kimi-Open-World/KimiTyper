import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Save, ChevronDown, ChevronRight, GripVertical } from 'lucide-react'
import { useAppStore } from '@/store'
import { saveBook } from '@/db'
import type { Chapter, Word, WordBook } from '@/types'
import { cn } from '@/lib/utils'
import { createT } from '@/lib/i18n'

interface EditableWord {
    id: number
    word: string
    phonetic: string
    meaning: string
    example: string
}

interface EditableChapter {
    id: string
    name: string
    words: EditableWord[]
    expanded: boolean
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export default function CustomBookEditor() {
    const navigate = useNavigate()
    const { settings } = useAppStore()
    const t = createT(settings.language)

    const [bookName, setBookName] = useState('')
    const [category, setCategory] = useState('')
    const [description, setDescription] = useState('')
    const [chapters, setChapters] = useState<EditableChapter[]>([
        {
            id: generateId(),
            name: settings.language === 'zh' ? '第一章' : 'Chapter 1',
            words: [{ id: 1, word: '', phonetic: '', meaning: '', example: '' }],
            expanded: true,
        },
    ])
    const [saving, setSaving] = useState(false)
    const [errors, setErrors] = useState<Record<string, string>>({})

    const addChapter = () => {
        setChapters((prev) => [
            ...prev,
            {
                id: generateId(),
                name: settings.language === 'zh' ? `第 ${prev.length + 1} 章` : `Chapter ${prev.length + 1}`,
                words: [{ id: Date.now(), word: '', phonetic: '', meaning: '', example: '' }],
                expanded: true,
            },
        ])
    }

    const removeChapter = (chapterId: string) => {
        if (chapters.length <= 1) return
        setChapters((prev) => prev.filter((c) => c.id !== chapterId))
    }

    const toggleChapter = (chapterId: string) => {
        setChapters((prev) =>
            prev.map((c) => (c.id === chapterId ? { ...c, expanded: !c.expanded } : c))
        )
    }

    const updateChapterName = (chapterId: string, name: string) => {
        setChapters((prev) => prev.map((c) => (c.id === chapterId ? { ...c, name } : c)))
    }

    const addWord = (chapterId: string) => {
        setChapters((prev) =>
            prev.map((c) => {
                if (c.id !== chapterId) return c
                const maxId = c.words.reduce((m, w) => Math.max(m, w.id), 0)
                return {
                    ...c,
                    words: [...c.words, { id: maxId + 1, word: '', phonetic: '', meaning: '', example: '' }],
                }
            })
        )
    }

    const removeWord = (chapterId: string, wordId: number) => {
        setChapters((prev) =>
            prev.map((c) => {
                if (c.id !== chapterId) return c
                if (c.words.length <= 1) return c
                return { ...c, words: c.words.filter((w) => w.id !== wordId) }
            })
        )
    }

    const updateWord = (
        chapterId: string,
        wordId: number,
        field: keyof EditableWord,
        value: string
    ) => {
        setChapters((prev) =>
            prev.map((c) => {
                if (c.id !== chapterId) return c
                return {
                    ...c,
                    words: c.words.map((w) => (w.id === wordId ? { ...w, [field]: value } : w)),
                }
            })
        )
    }

    const validate = (): boolean => {
        const errs: Record<string, string> = {}
        if (!bookName.trim()) {
            errs.bookName = settings.language === 'zh' ? '请输入词书名称' : 'Book name is required'
        }
        let wordCount = 0
        for (const ch of chapters) {
            if (!ch.name.trim()) {
                errs[`chapter-${ch.id}`] = settings.language === 'zh' ? '章节名不能为空' : 'Chapter name required'
            }
            for (const w of ch.words) {
                if (w.word.trim() || w.meaning.trim()) {
                    wordCount++
                    if (!w.word.trim()) {
                        errs[`word-${ch.id}-${w.id}-word`] = settings.language === 'zh' ? '请输入英文单词' : 'English word required'
                    }
                    if (!w.meaning.trim()) {
                        errs[`word-${ch.id}-${w.id}-meaning`] = settings.language === 'zh' ? '请输入释义' : 'Meaning required'
                    }
                }
            }
        }
        if (wordCount === 0) {
            errs.words = settings.language === 'zh' ? '至少添加一个单词' : 'Add at least one word'
        }
        setErrors(errs)
        return Object.keys(errs).length === 0
    }

    const handleSave = async () => {
        if (!validate()) return
        setSaving(true)

        try {
            let globalWordId = 1
            const bookChapters: Chapter[] = chapters.map((ch) => {
                const validWords: Word[] = ch.words
                    .filter((w) => w.word.trim() && w.meaning.trim())
                    .map((w) => ({
                        id: globalWordId++,
                        word: w.word.trim(),
                        phonetic: w.phonetic.trim() || `/${w.word.trim()}/`,
                        meaning: w.meaning.trim(),
                        example: w.example.trim() || undefined,
                    }))
                return {
                    id: ch.id,
                    name: ch.name.trim(),
                    words: validWords,
                }
            })

            const totalWords = bookChapters.reduce((s, c) => s + c.words.length, 0)
            const book: WordBook = {
                id: generateId(),
                name: bookName.trim(),
                description: description.trim() || bookName.trim(),
                wordCount: totalWords,
                language: 'en',
                category: category.trim() || (settings.language === 'zh' ? '自定义' : 'Custom'),
                chapters: bookChapters,
                isCustom: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            }

            await saveBook(book)
            navigate('/')
        } catch (e) {
            console.error(e)
        } finally {
            setSaving(false)
        }
    }

    const totalWords = chapters.reduce(
        (s, c) => s + c.words.filter((w) => w.word.trim()).length,
        0
    )

    return (
        <div className="mx-auto max-w-3xl space-y-6 pb-24">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/')} className="rounded-lg p-2 hover:bg-accent transition-colors">
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold">{t('custom.title')}</h1>
                    <p className="text-sm text-muted-foreground">
                        {settings.language === 'zh'
                            ? `已添加 ${totalWords} 个单词`
                            : `${totalWords} words added`}
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                    <Save className="h-4 w-4" />
                    {saving ? t('common.loading') : t('custom.saveBook')}
                </button>
            </div>

            {/* Book Info */}
            <div className="rounded-xl border bg-card p-6 space-y-4">
                <h2 className="font-semibold text-muted-foreground text-sm uppercase tracking-wide">
                    {settings.language === 'zh' ? '词书信息' : 'Book Info'}
                </h2>
                <div className="space-y-3">
                    <div>
                        <label className="text-sm font-medium mb-1 block">{t('custom.bookName')} *</label>
                        <input
                            type="text"
                            value={bookName}
                            onChange={(e) => setBookName(e.target.value)}
                            placeholder={t('custom.bookNamePlaceholder')}
                            className={cn(
                                'w-full rounded-lg border bg-background px-4 py-2.5 outline-none transition-colors focus:border-primary',
                                errors.bookName && 'border-destructive'
                            )}
                        />
                        {errors.bookName && <p className="mt-1 text-xs text-destructive">{errors.bookName}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-sm font-medium mb-1 block">{t('custom.category')}</label>
                            <input
                                type="text"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                placeholder={t('custom.categoryPlaceholder')}
                                className="w-full rounded-lg border bg-background px-4 py-2.5 outline-none transition-colors focus:border-primary"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">{t('custom.description')}</label>
                            <input
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder={t('custom.descriptionPlaceholder')}
                                className="w-full rounded-lg border bg-background px-4 py-2.5 outline-none transition-colors focus:border-primary"
                            />
                        </div>
                    </div>
                    {errors.words && (
                        <p className="text-sm text-destructive">{errors.words}</p>
                    )}
                </div>
            </div>

            {/* Chapters */}
            <div className="space-y-4">
                {chapters.map((chapter) => (
                    <div key={chapter.id} className="rounded-xl border bg-card overflow-hidden">
                        {/* Chapter Header */}
                        <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-3">
                            <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                            <button
                                onClick={() => toggleChapter(chapter.id)}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {chapter.expanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                ) : (
                                    <ChevronRight className="h-4 w-4" />
                                )}
                            </button>
                            <input
                                type="text"
                                value={chapter.name}
                                onChange={(e) => updateChapterName(chapter.id, e.target.value)}
                                className={cn(
                                    'flex-1 bg-transparent font-semibold outline-none focus:underline',
                                    errors[`chapter-${chapter.id}`] && 'text-destructive'
                                )}
                            />
                            <span className="text-xs text-muted-foreground">
                                {chapter.words.filter((w) => w.word.trim()).length}{' '}
                                {settings.language === 'zh' ? '词' : 'words'}
                            </span>
                            {chapters.length > 1 && (
                                <button
                                    onClick={() => removeChapter(chapter.id)}
                                    className="rounded-lg p-1 text-muted-foreground hover:text-destructive transition-colors"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        {/* Words */}
                        {chapter.expanded && (
                            <div className="p-4 space-y-3">
                                {/* Word Table Header */}
                                <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 text-xs font-medium text-muted-foreground px-1">
                                    <span>{t('custom.wordEnglish')} *</span>
                                    <span>{t('custom.wordPhonetic')}</span>
                                    <span>{t('custom.wordMeaning')} *</span>
                                    <span>{t('custom.wordExample')}</span>
                                    <span />
                                </div>

                                {chapter.words.map((word) => (
                                    <div key={word.id} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-center">
                                        <input
                                            type="text"
                                            value={word.word}
                                            onChange={(e) => updateWord(chapter.id, word.id, 'word', e.target.value)}
                                            placeholder="abandon"
                                            className={cn(
                                                'rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary font-mono',
                                                errors[`word-${chapter.id}-${word.id}-word`] && 'border-destructive'
                                            )}
                                        />
                                        <input
                                            type="text"
                                            value={word.phonetic}
                                            onChange={(e) => updateWord(chapter.id, word.id, 'phonetic', e.target.value)}
                                            placeholder="/əˈbændən/"
                                            className="rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
                                        />
                                        <input
                                            type="text"
                                            value={word.meaning}
                                            onChange={(e) => updateWord(chapter.id, word.id, 'meaning', e.target.value)}
                                            placeholder={settings.language === 'zh' ? 'v. 放弃' : 'v. to abandon'}
                                            className={cn(
                                                'rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary',
                                                errors[`word-${chapter.id}-${word.id}-meaning`] && 'border-destructive'
                                            )}
                                        />
                                        <input
                                            type="text"
                                            value={word.example}
                                            onChange={(e) => updateWord(chapter.id, word.id, 'example', e.target.value)}
                                            placeholder={settings.language === 'zh' ? '填写例句...' : 'Example sentence...'}
                                            className="rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
                                        />
                                        <button
                                            onClick={() => removeWord(chapter.id, word.id)}
                                            disabled={chapter.words.length <= 1}
                                            className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}

                                <button
                                    onClick={() => addWord(chapter.id)}
                                    className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors w-full justify-center"
                                >
                                    <Plus className="h-4 w-4" />
                                    {t('custom.addWord')}
                                </button>
                            </div>
                        )}
                    </div>
                ))}

                {/* Add Chapter */}
                <button
                    onClick={addChapter}
                    className="flex items-center gap-2 rounded-xl border border-dashed px-6 py-4 text-muted-foreground hover:border-primary hover:text-primary transition-colors w-full justify-center"
                >
                    <Plus className="h-5 w-5" />
                    {t('custom.addChapter')}
                </button>
            </div>
        </div>
    )
}
