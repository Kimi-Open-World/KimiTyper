/**
 * 学习提醒功能 — 使用 Web Notifications API + localStorage 模拟定时
 * 由于纯前端无法精确定时，我们使用每次打开应用时检查当天提醒的方式
 */

const REMINDER_STORAGE_KEY = 'kimityper_reminder_last_shown'

export async function requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
        return 'denied'
    }
    if (Notification.permission === 'granted') return 'granted'
    if (Notification.permission === 'denied') return 'denied'
    return await Notification.requestPermission()
}

export function showReminderNotification(title: string, body: string): boolean {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
        return false
    }
    new Notification(title, {
        body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: 'kimityper-daily-reminder',
    })
    return true
}

/**
 * 检查是否需要显示今日提醒
 * 逻辑：
 * - 获取用户设置的提醒时间 (HH:MM)
 * - 当前时间已过提醒时间
 * - 今天还没有显示过提醒
 */
export function checkAndShowReminder(
    enabled: boolean,
    reminderTime: string, // "HH:MM"
    title: string,
    body: string
): void {
    if (!enabled) return
    if (!('Notification' in window) || Notification.permission !== 'granted') return

    const now = new Date()
    const [hh, mm] = reminderTime.split(':').map(Number)
    const reminderMinutes = hh * 60 + mm
    const currentMinutes = now.getHours() * 60 + now.getMinutes()

    // 当前时间已经过了今天的提醒时间
    if (currentMinutes < reminderMinutes) return

    const today = now.toDateString()
    const lastShown = localStorage.getItem(REMINDER_STORAGE_KEY)
    if (lastShown === today) return

    // 显示提醒
    showReminderNotification(title, body)
    localStorage.setItem(REMINDER_STORAGE_KEY, today)
}

/** 格式化提醒时间显示 */
export function formatReminderTime(time: string): string {
    const [hh, mm] = time.split(':')
    return `${hh.padStart(2, '0')}:${mm.padStart(2, '0')}`
}
