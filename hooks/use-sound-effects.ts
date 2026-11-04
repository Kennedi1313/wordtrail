"use client";

export function useSoundEffects() {
  function playTone(
    frequencies: number[],
    duration: number,
    type: OscillatorType = "sine",
  ) {
    if (typeof window === "undefined") return;
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      context.currentTime + duration,
    );
    gain.connect(context.destination);
    frequencies.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      oscillator.start(context.currentTime + index * 0.08);
      oscillator.stop(context.currentTime + duration + index * 0.08);
    });
    window.setTimeout(() => void context.close(), (duration + 0.3) * 1000);
  }

  const playCorrect = () => playTone([523.25, 659.25], 0.28);
  const playIncorrect = () => playTone([220, 174.61], 0.32, "triangle");
  const playComplete = () => playTone([261.63, 329.63, 392, 329.63], 0.82);

  return {
    playCorrect,
    playIncorrect,
    playComplete,
  };
}
