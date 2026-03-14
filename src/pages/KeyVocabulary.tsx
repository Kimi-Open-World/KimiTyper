import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Star, Volume2, Trash2, BookOpen, Info, Search } from 'lucide-react'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { createT } from '@/lib/i18n'
import { playWordPronunciation } from '@/lib/audio'
import { WordDetailPanel } from '@/components/WordDetailPanel'
import { searchWordDetailByText, type WordDetail } from '@/db'
import type { Word } from '@/types'

export default function KeyVocabulary() {
  const navigate = useNavigate()
  const { keyVocabulary, removeFromKeyVocabulary, settings } = useAppStore()
  const t = createT(settings.language)
  const [search, setSearch] = useState('')
  const [expandedWordId, setExpandedWordId] = useState<number | null>(null)
  const [detailsCache, setDetailsCache] = useState<Record<number, WordDetail>>({})
  const [loadingDetailId, setLoadingDetailId] = useState<number | null>(null)

  const toggleExpand = async (word: Word) => {
    if (expandedWordId === word.id) {
      setExpandedWordId(null)
      return
    }
    setExpandedWordId(word.id)
    if (!detailsCache[word.id]) {
      setLoadingDetailId(word.id)
      try {
        const detail = await searchWordDetailByText(word.word)
        if (detail) {
          setDetailsCache(prev => ({ ...prev, [word.id]: detail }))
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoadingDetailId(null)
      }
    }
  }

  const playAudio = (word: string) => {
    if (!settings.pronunciation) return
    playWordPronunciation(word)
  }

  // 修复：搜索过滤（之前过滤器完全无效）
  const filteredWords = keyVocabulary.filter((w) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return w.word.toLowerCase().includes(q) || w.meaning.toLowerCase().includes(q)
  })

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4 pr-32">
        <button
          onClick={() => navigate('/')}
          className="rounded-lg p-2 hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-semibold text-xl flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
            {t('keyVocab.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('keyVocab.count', { count: keyVocabulary.length })}
          </p>
        </div>
        {keyVocabulary.length > 0 && (
          <button
            onClick={() => navigate('/learn/key-vocabulary')}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <BookOpen className="h-4 w-4" />
            {t('keyVocab.practice')}
          </button>
        )}
      </div>

      {/* Search */}
      {keyVocabulary.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={settings.language === 'zh' ? '搜索单词或释义...' : 'Search words or meanings...'}
            className="w-full rounded-xl border bg-card pl-10 pr-4 py-2.5 outline-none focus:border-primary transition-colors"
          />
        </div>
      )}

      {/* Empty State */}
      {keyVocabulary.length === 0 ? (
        <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-center">
          <div className="rounded-full bg-yellow-100 dark:bg-yellow-900/20 p-8">
            <Star className="h-12 w-12 text-yellow-500" />
          </div>
          <h2 className="text-xl font-semibold">{t('keyVocab.empty')}</h2>
          <p className="max-w-xs text-muted-foreground">{t('keyVocab.emptyHint')}</p>
          <button
            onClick={() => navigate('/')}
            className="rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {t('keyVocab.startLearning')}
          </button>
        </div>
      ) : filteredWords.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          {settings.language === 'zh' ? '没有找到匹配的单词' : 'No matching words found'}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filteredWords.map((word) => {
            const isExpanded = expandedWordId === word.id
            return (
              <div
                key={word.id}
                className={cn(
                  'rounded-xl border bg-card overflow-hidden transition-all',
                  isExpanded && 'col-span-full sm:col-span-2'
                )}
              >
                {/* Word Row */}
                <div className="flex items-center gap-3 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">{word.word}</span>
                      {settings.pronunciation && (
                        <button
                          onClick={() => playAudio(word.word)}
                          className="rounded-full p-1 hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                        >
                          <Volume2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {settings.showPhonetic && word.phonetic && (
                      <p className="text-sm text-muted-foreground">{word.phonetic}</p>
                    )}
                    <p className="text-sm mt-1 truncate">{word.meaning}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleExpand(word)}
                      className={cn(
                        'rounded-full p-2 transition-colors',
                        isExpanded
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          : 'text-muted-foreground hover:bg-accent'
                      )}
                      title={t('typing.viewDetail')}
                    >
                      <Info className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => removeFromKeyVocabulary(word.id)}
                      className="rounded-full p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title={settings.language === 'zh' ? '从重点词汇移除' : 'Remove from starred'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t bg-muted/10 px-4 py-3 space-y-2">
                    {/* Render Example like before */}
                    {word.example && (
                      <div className="space-y-1 mt-2">
                        <p className="text-sm italic text-muted-foreground font-serif">{word.example}</p>
                        {word.exampleTranslation && (
                          <p className="text-sm text-muted-foreground">{word.exampleTranslation}</p>
                        )}
                      </div>
                    )}

                    {/* Render exact same WordDetailPanel! */}
                    <WordDetailPanel
                      wordDetail={detailsCache[word.id] || word as unknown as WordDetail}
                      t={t}
                      isLoading={loadingDetailId === word.id}
                      className="mt-4 border-none bg-transparent p-0"
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
