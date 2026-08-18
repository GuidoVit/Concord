export function playCallSound(
  sound: 'join' | 'leave' | 'mute' | 'unmute' | 'deafen' | 'undeafen'
) {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

    if (!AudioContextClass) return

    const context = new AudioContextClass()
    const master = context.createGain()
    master.gain.value = 0.50
    master.connect(context.destination)

    const patterns: Record<typeof sound, Array<[number, number, number]>> = {
      join: [[520, 0, 0.08], [720, 0.09, 0.12]],
      leave: [[620, 0, 0.08], [420, 0.09, 0.12]],
      mute: [[520, 0, 0.07], [330, 0.08, 0.10]],
      unmute: [[330, 0, 0.07], [520, 0.08, 0.10]],
      deafen: [[600, 0, 0.06], [450, 0.07, 0.06], [300, 0.14, 0.10]],
      undeafen: [[300, 0, 0.06], [450, 0.07, 0.06], [600, 0.14, 0.10]]
    }

    const now = context.currentTime

    for (const [frequency, delay, duration] of patterns[sound]) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()

      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, now + delay)
      gain.gain.exponentialRampToValueAtTime(1, now + delay + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + duration)

      oscillator.connect(gain)
      gain.connect(master)
      oscillator.start(now + delay)
      oscillator.stop(now + delay + duration + 0.02)
    }

    const totalDuration = Math.max(...patterns[sound].map(([, delay, duration]) => delay + duration))
    window.setTimeout(() => void context.close(), (totalDuration + 0.15) * 1000)
  } catch (error) {
    console.warn('Erro ao tocar som da call:', error)
  }
}
