import type { SM2Card } from '@/types'

/**
 * SM2 间隔重复算法实现
 * 参考：SuperMemo 2 算法
 * 评分 q (0-5):
 *   0 - 完全忘记 / complete blackout
 *   1 - 有点印象但想不起来 / incorrect; easy to recall
 *   2 - 回忆正确但很费力 / incorrect; serious mistake
 *   3 - 正确，但有些困难 / correct with serious difficulty
 *   4 - 正确，基本没什么困难 / correct after hesitation
 *   5 - 完全正确，迅速回忆 / perfect response
 */

export function sm2Update(card: SM2Card, q: number): SM2Card {
    const now = new Date().toISOString()
    let { interval, repetition, efFactor } = card

    // 更新 E-Factor (难度因子)
    efFactor = Math.max(1.3, efFactor + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))

    if (q < 3) {
        // 答错了，回到重新学习阶段
        repetition = 0
        interval = 1
    } else {
        // 答对了
        if (repetition === 0) {
            interval = 1
        } else if (repetition === 1) {
            interval = 6
        } else {
            interval = Math.round(interval * efFactor)
        }
        repetition++
    }

    const nextReview = new Date()
    nextReview.setDate(nextReview.getDate() + interval)

    return {
        ...card,
        interval,
        repetition,
        efFactor,
        grade: q,
        lastReview: now,
        nextReview: nextReview.toISOString(),
    }
}

export function createSM2Card(wordId: number, bookId: string): SM2Card {
    return {
        wordId,
        bookId,
        interval: 0,
        repetition: 0,
        efFactor: 2.5,
        grade: -1,
        lastReview: '',
        nextReview: new Date().toISOString(), // 立即复习
    }
}

/** 判断今日是否需要复习该卡片 */
export function isDueToday(card: SM2Card): boolean {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const nextReview = new Date(card.nextReview)
    nextReview.setHours(0, 0, 0, 0)
    return nextReview <= today
}

/** 计算下次复习的相对描述 */
export function formatNextReview(card: SM2Card, lang: 'zh' | 'en' = 'zh'): string {
    const now = new Date()
    const next = new Date(card.nextReview)
    const diffDays = Math.ceil((next.getTime() - now.getTime()) / (1000 * 3600 * 24))

    if (lang === 'en') {
        if (diffDays <= 0) return 'Today'
        if (diffDays === 1) return 'Tomorrow'
        return `In ${diffDays} days`
    }

    if (diffDays <= 0) return '今天'
    if (diffDays === 1) return '明天'
    return `${diffDays} 天后`
}
