/**
 * เสียงแจ้งเตือนเบา ๆ เมื่อเสร็จ (สังเคราะห์ด้วย Web Audio ไม่ต้องโหลดไฟล์)
 * เบราว์เซอร์ยอมให้เล่นเสียงหลังผู้ใช้กดปุ่มเท่านั้น จึงต้องเรียก unlockAudio() ตอนกด Start/Resume
 */
let ctx: AudioContext | null = null;

export function unlockAudio(): void {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  } catch {
    ctx = null;
  }
}

/** ระฆังสองโน้ต นุ่ม ๆ ราว 2 วินาที เล่นครั้งเดียว */
export function playChime(): void {
  try {
    unlockAudio();
    if (!ctx) return;
    const ac = ctx;
    const t0 = ac.currentTime + 0.03;
    const master = ac.createGain();
    master.gain.value = 0.14;
    master.connect(ac.destination);
    const notes: [number, number][] = [
      [659.25, 0],
      [987.77, 0.22],
    ];
    for (const [freq, delay] of notes) {
      const osc = ac.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = ac.createGain();
      const start = t0 + delay;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.6, start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.8);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + 1.9);
    }
  } catch {
    // ไม่มีเสียงก็ไม่เป็นไร
  }
}
