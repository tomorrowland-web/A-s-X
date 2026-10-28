/** Candleman behavior is simulated independently from rendering and UI. */
export type EnemyState = 'Dormant' | 'Observing' | 'Approaching' | 'Questioning' | 'Hunting' | 'Disappearing' | 'Punishing';
export interface Point { x: number; z: number }
export interface EnemyInput {
  player: Point;
  noise?: number;
  hidden?: boolean;
  sanity?: number;
  blocked?: (x: number, z: number) => boolean;
}
export interface EnemyFrame {
  state: EnemyState;
  position: Point;
  visible: boolean;
  damage: number;
  tension: number;
}
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
const cellKey = (p: Point) => `${p.x},${p.z}`;

/** Finite grid search around the origin; diagonals cannot cut through corners. */
export function findPath(start: Point, goal: Point, blocked: (x: number, z: number) => boolean): Point[] {
  let s = { x: Math.round(start.x), z: Math.round(start.z) };
  const candidates: Point[] = [];
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) candidates.push({ x: s.x + dx, z: s.z + dz });
  candidates.sort((a, b) => dist(start, a) - dist(start, b));
  const safeStart = candidates.find(p => !blocked(p.x, p.z) && hasLineOfSight(start, p, blocked));
  if (!safeStart) return [];
  s = safeStart;
  const g = { x: Math.round(goal.x), z: Math.round(goal.z) };
  const queue = [s];
  const parent = new Map<string, Point | null>([[cellKey(s), null]]);
  let end: Point | undefined;
  for (let i = 0; i < queue.length && i < 4096; i++) {
    const p = queue[i]!;
    if (dist(p, g) < 1.1) { end = p; break; }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = { x: p.x + dx!, z: p.z + dz! };
      const key = cellKey(n);
      if (parent.has(key) || Math.abs(n.x - s.x) > 40 || Math.abs(n.z - s.z) > 40 || blocked(n.x, n.z)) continue;
      // Check half steps as well, so thin walls cannot be crossed.
      if (blocked((p.x + n.x) / 2, (p.z + n.z) / 2)) continue;
      parent.set(key, p);
      queue.push(n);
    }
  }
  if (!end) return [];
  const path: Point[] = [];
  for (let p: Point | null = end; p; p = parent.get(cellKey(p)) ?? null) path.unshift(p);
  return dist(start, s) > 0.1 ? path : path.slice(1);
}

export function hasLineOfSight(a: Point, b: Point, blocked?: (x: number, z: number) => boolean): boolean {
  if (!blocked) return true;
  const steps = Math.max(1, Math.ceil(dist(a, b) * 4));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (blocked(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
  }
  return true;
}

export class CandlemanAI {
  state: EnemyState = 'Dormant';
  position: Point = { x: 0, z: -10 };
  level = 0;
  private age = 0;
  private cooldown = 17;
  private huntRemaining = 0;
  private damageCooldown = 0;
  private lostTime = 0;
  private path: Point[] = [];
  private pathAge = 0;
  private lastKnown: Point = { x: 0, z: 0 };
  private encounters = 0;

  reset(level = 0, spawn: Point = { x: 0, z: -10 }): void {
    this.level = level;
    this.position = { ...spawn };
    this.state = 'Dormant';
    this.age = 0;
    this.cooldown = Math.max(9, 23 - level * 2);
    this.huntRemaining = 0;
    this.damageCooldown = 0;
    this.lostTime = 0;
    this.path = [];
    this.pathAge = 0;
    this.encounters = 0;
  }

  private enter(state: EnemyState): void {
    this.state = state;
    this.age = 0;
    this.path = [];
    this.pathAge = 0;
  }

  beginQuestion(): void { this.enter('Questioning'); }
  endQuestion(correct: boolean): void {
    if (correct) this.enter('Disappearing');
    else this.punish();
  }
  startHunt(seconds = 18): void {
    this.huntRemaining = Math.max(1, seconds);
    this.lostTime = 0;
    this.damageCooldown = 2.5;
    this.enter('Hunting');
  }
  punish(): void { this.enter('Punishing'); }

  private relocate(input: EnemyInput): void {
    // Rotating spawn choices keep repeat sightings varied, but never spawn on the player.
    const phase = this.encounters++ * 2.399;
    for (let i = 0; i < 16; i++) {
      const a = phase + i * Math.PI / 8;
      const r = 9 + (i % 3) * 1.5;
      const p = { x: input.player.x + Math.cos(a) * r, z: input.player.z + Math.sin(a) * r };
      if (!input.blocked?.(p.x, p.z)) { this.position = p; return; }
    }
    // Retain last known safe position if the player's room has no suitable spawn.
  }

  private moveToward(target: Point, speed: number, dt: number, blocked?: EnemyInput['blocked']): void {
    this.pathAge -= dt;
    let next = target;
    if (!hasLineOfSight(this.position, target, blocked) && blocked) {
      if (this.pathAge <= 0) {
        this.path = findPath(this.position, target, blocked);
        this.pathAge = 0.8;
      }
      while (this.path.length && dist(this.position, this.path[0]!) < 0.25) this.path.shift();
      if (!this.path.length) return;
      next = this.path[0]!;
    }
    const distance = dist(this.position, next);
    if (distance < 0.05) return;
    const step = Math.min(speed * dt, distance);
    const x = this.position.x + (next.x - this.position.x) / distance * step;
    const z = this.position.z + (next.z - this.position.z) / distance * step;
    if (!blocked?.(x, z)) this.position = { x, z };
  }

  update(dt: number, input: EnemyInput): EnemyFrame {
    dt = Math.max(0, Math.min(dt, 0.1));
    this.age += dt;
    this.damageCooldown -= dt;
    let damage = 0;
    const distance = dist(this.position, input.player);
    const sees = !input.hidden && distance < 16 && hasLineOfSight(this.position, input.player, input.blocked);
    const hears = (input.noise ?? 0) > 0.35 && distance < 5 + (input.noise ?? 0) * 12;
    if (sees || hears) this.lastKnown = { ...input.player };
    switch (this.state) {
      case 'Dormant':
        if (this.age >= this.cooldown) { this.relocate(input); this.enter('Observing'); }
        break;
      case 'Observing':
        if (this.age > 3.5 && (sees || hears)) this.enter('Approaching');
        else if (this.age > 9) this.enter('Disappearing');
        break;
      case 'Approaching':
        this.moveToward(this.lastKnown, 0.65 + this.level * 0.13, dt, input.blocked);
        if (distance < 3.8 && !input.hidden || this.level > 0 && hears && this.age > 3) this.startHunt(13 + this.level * 2);
        else if (this.age > 15 || input.hidden && this.age > 5) this.enter('Disappearing');
        break;
      case 'Questioning':
        // The game pauses simulation while the cinematic answer UI is open.
        break;
      case 'Punishing':
        if (this.age > 1.4) this.startHunt(16 + this.level * 2);
        break;
      case 'Hunting':
        this.huntRemaining -= dt;
        this.lostTime = sees || hears ? 0 : this.lostTime + dt;
        this.moveToward(sees || hears ? input.player : this.lastKnown, 2.65 + this.level * 0.18, dt, input.blocked);
        if (distance < 1.15 && !input.hidden && this.damageCooldown <= 0 && hasLineOfSight(this.position, input.player, input.blocked)) {
          damage = 25;
          this.damageCooldown = 1.8;
        }
        if (this.huntRemaining <= 0 || this.lostTime > 7) this.enter('Disappearing');
        break;
      case 'Disappearing':
        if (this.age > 1.2) {
          this.cooldown = Math.max(9, 24 - this.level * 2) + (this.encounters % 3) * 3;
          this.enter('Dormant');
        }
        break;
    }
    const visible = this.state !== 'Dormant' && !(this.state === 'Disappearing' && Math.floor(this.age * 15) % 3 === 0);
    const tension = this.state === 'Hunting' || this.state === 'Punishing' ? 1 : this.state === 'Dormant' ? 0.12 : Math.min(0.85, 0.25 + 5 / Math.max(distance, 1) * 0.35);
    return { state: this.state, position: { ...this.position }, visible, damage, tension };
  }
}
