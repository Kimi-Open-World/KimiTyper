import type { WordDetail } from '@/db'
import { cn } from '@/lib/utils'

interface WordDetailPanelProps {
    wordDetail: WordDetail
    t: (key: string) => string
    isLoading?: boolean
    className?: string
}

export function WordDetailPanel({ wordDetail, t, isLoading, className }: WordDetailPanelProps) {
    if (isLoading) {
        return (
            <div className={cn("mt-6 rounded-xl border bg-muted/50 p-4 text-left", className)}>
                <h3 className="mb-3 text-sm font-semibold text-muted-foreground">{t('typing.etymologyPanel') || 'Detailed Info'}</h3>
                <p className="text-sm text-muted-foreground animate-pulse">{t('common.loading') || 'Loading...'}</p>
            </div>
        )
    }

    if (!wordDetail) return null

    return (
        <div className={cn("mt-6 rounded-xl border bg-muted/50 p-4 text-left", className)}>
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground">{t('typing.etymologyPanel') || 'Detailed Info'}</h3>
            <div className="space-y-2 text-sm">
                {wordDetail.wordFormation && (
                    <div className="flex items-start gap-2">
                        <span className="shrink-0 text-muted-foreground">{t('typing.wordFormation') || 'Formation'}:</span>
                        <span className="font-medium">{wordDetail.wordFormation}</span>
                    </div>
                )}
                <div className="flex flex-wrap gap-2">
                    {wordDetail.prefix && (
                        <div className="flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs dark:bg-blue-900/30">
                            <span className="text-muted-foreground">{t('typing.prefix') || 'Prefix'}</span>
                            <span className="font-medium text-blue-600 dark:text-blue-400">{wordDetail.prefix}</span>
                        </div>
                    )}
                    {wordDetail.root && (
                        <div className="flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs dark:bg-green-900/30">
                            <span className="text-muted-foreground">{t('typing.root') || 'Root'}</span>
                            <span className="font-medium text-green-600 dark:text-green-400">{wordDetail.root}</span>
                        </div>
                    )}
                    {wordDetail.suffix && (
                        <div className="flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-xs dark:bg-purple-900/30">
                            <span className="text-muted-foreground">{t('typing.suffix') || 'Suffix'}</span>
                            <span className="font-medium text-purple-600 dark:text-purple-400">{wordDetail.suffix}</span>
                        </div>
                    )}
                </div>
                {wordDetail.etymology && (
                    <div className="pt-2 border-t mt-2 text-muted-foreground leading-relaxed">
                        <span className="font-medium text-foreground">{t('typing.etymology') || 'Etymology'}: </span>
                        {wordDetail.etymology}
                    </div>
                )}
                {wordDetail.cognates && wordDetail.cognates.length > 0 && (
                    <div className="pt-2 border-t mt-2 flex flex-wrap gap-1">
                        <span className="text-muted-foreground text-xs mr-1">同源词:</span>
                        {wordDetail.cognates.map((c) => (
                            <span key={c} className="rounded bg-muted px-2 py-0.5 text-xs font-mono">{c}</span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
