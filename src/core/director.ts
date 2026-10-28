export type HorrorEventType = 'whisper' | 'blackout' | 'fall' | 'apparition' | 'footsteps';
export interface HorrorEvent { type: HorrorEventType; message?: string }
export interface DirectorInput { level: number; tension: number; player: { x: number; z: number }; progress?: number }
const whispers = [
  'Every step downward brings you closer to the truth.',
  'He can hear you running.',
  'Someone was standing here before you turned around.',
  'The candles remember what the walls forget.',
  'Do not trust your reflection.',
  'A name can be a prison. A name can be a key.',
  'He was afraid of the dark, once.',
];
/** Paces scares around exploration, pressure and repeated visits. Nothing deals unavoidable damage. */
export class HorrorDirector {
  private cooldown = 13;
  private lastType: HorrorEventType | undefined;
  private lastPosition = { x: 0, z: 0 };
  private traveled = 0;
  private eventCount = 0;
  private level = -1;
  private seed = 2047;
  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  reset(level = 0): void {
    this.level = level;
    this.cooldown = 13;
    this.lastType = undefined;
    this.lastPosition = { x: 0, z: 0 };
    this.traveled = 0;
    this.eventCount = 0;
  }
  update(dt: number, input: DirectorInput): HorrorEvent | undefined {
    if (this.level !== input.level) this.reset(input.level);
    dt = Math.max(0, Math.min(0.1, dt));
    this.cooldown -= dt;
    this.traveled += Math.min(1, Math.hypot(input.player.x - this.lastPosition.x, input.player.z - this.lastPosition.z));
    this.lastPosition = { ...input.player };
    if (this.cooldown > 0 || input.tension > 0.85) return;
    // Stationary players get occasional whispers; major scares require exploration.
    const options: HorrorEventType[] = this.traveled > 5 ? ['whisper', 'blackout', 'fall', 'footsteps', ...(input.level > 0 ? ['apparition' as const] : [])] : ['whisper', 'footsteps'];
    const available = options.filter(type => type !== this.lastType);
    const type = available[Math.floor(this.random() * available.length)]!;
    this.lastType = type;
    this.eventCount++;
    this.traveled = 0;
    this.cooldown = 24 + this.random() * 19 - input.level * 1.7 - (input.progress ?? 0) * 3;
    return { type, message: type === 'whisper' ? whispers[(this.eventCount + input.level) % whispers.length] : undefined };
  }
}
