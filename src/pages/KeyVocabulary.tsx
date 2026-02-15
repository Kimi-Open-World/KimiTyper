import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Star, Volume2, Trash2, BookOpen } from 'lucide-react'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'

export default function KeyVocabulary() {
  const navigate = useNavigate()
  const { keyVocabulary, removeFromKeyVocabulary, settings } = useAppStore()
  const [filter, setFilter] = useState<'all' | 'learning'>('all')

  const playAudio = (word: string) => {
    if (!settings.pronunciation) return
    const utterance = new SpeechSynthesisUtterance(word)
    utterance.lang = 'en-US'
    utterance.rate = 0.8
    window.speechSynthesis.speak(utterance)
  }

  const filteredWords = keyVocabulary.filter(() => {
    if (filter === 'all') return true
    return true
  })

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/')
          }
          className="rounded-lg p-2 hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-semibold text-xl flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
            重点词汇
          </h1>
          <p className="text-sm text-muted-foreground">
            共 {keyVocabulary.length} 个单词
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            filter === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted hover:bg-muted/80'
          )}
        >
          全部
        </button>
      </div>

      {/* Empty State */}
      {filteredWords.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Star className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">
            还没有重点词汇
          </h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-xs">
            在学习过程中点击单词旁的星标按钮，将单词加入重点词汇列表
          </p>
          <button
            onClick={() => navigate('/')
            }
            className="mt-6 flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <BookOpen className="h-4 w-4" />
            开始学习
          </button>
        </div>
      )}

      {/* Word List */}
      {filteredWords.length > 0 && (
        <div className="space-y-3">
          {filteredWords.map((word) => (
            <div
              key={word.id}
              className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:shadow-md transition-all"
            >
              {/* Word Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-lg">{word.word}</h3>
                  {settings.showPhonetic && (
                    <span className="text-sm text-muted-foreground">{word.phonetic}</span>
                  )}
                </div>
                <p className="text-foreground">{word.meaning}</p>
                {settings.showExample && word.example && (
                  <p className="text-sm text-muted-foreground italic mt-2">
                    {word.example}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                {settings.pronunciation && (
                  <button
                    onClick={() => playAudio(word.word)}
                    className="p-2 rounded-lg hover:bg-accent transition-colors"
                    title="播放发音"
                  >
                    <Volume2 className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => removeFromKeyVocabulary(word.id)}
                  className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  title="从重点词汇移除"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Practice Button */}
      {filteredWords.length > 0 && (
        <div className="flex justify-center pt-4">
          <button
            onClick={() => navigate('/practice/key-vocabulary')
            }
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
          >
            <BookOpen className="h-5 w-5" />
            开始练习重点词汇
          </button>
        </div>
      )}
    </div>
  )
}
