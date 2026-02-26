/**
 * 全局共享的音频播放器，避免在每次点击或自动播放时创建大量的 HTMLAudioElement。
 * 此优化极大降低了内存开销并消除了频繁创建 DOM 节点可能导致的性能抖动。
 */

let globalAudio: HTMLAudioElement | null = null;

export function playWordPronunciation(word: string) {
    // 如果当前没创建过 audio 实例，则单例初始化
    if (!globalAudio) {
        globalAudio = new Audio();
    }

    // 安全处理，避免空字符串等传入
    if (!word || typeof word !== 'string') return;

    const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=2`;
    globalAudio.src = url;

    globalAudio.play().catch((err) => {
        console.warn('Audio play failed (maybe autoplay policy or network):', err);
    });
}
