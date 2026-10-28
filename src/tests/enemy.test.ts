import { describe, it, expect } from 'vitest';
import { CandlemanAI, findPath, hasLineOfSight } from '../enemies/candleman';
const input = { player: { x: 0, z: 0 }, noise: 0 };
function advance(ai: CandlemanAI, seconds: number, data = input) {
  let result = ai.update(0, data);
  for (let t = 0; t < seconds; t += 0.1) result = ai.update(0.1, data);
  return result;
}
describe('Candleman AI', () => {
  it('observes after a grace period and can disappear after a correct answer', () => {
    const ai = new CandlemanAI(); ai.reset();
    expect(advance(ai, 10).visible).toBe(false);
    expect(advance(ai, 13).state).toBe('Observing');
    ai.beginQuestion(); expect(ai.state).toBe('Questioning');
    ai.endQuestion(true); expect(ai.state).toBe('Disappearing');
    expect(advance(ai, 2).state).toBe('Dormant');
  });
  it('wrong answers punish then hunt, and hunts expire', () => {
    const ai = new CandlemanAI(); ai.reset(); ai.endQuestion(false);
    expect(ai.state).toBe('Punishing');
    expect(advance(ai, 2).state).toBe('Hunting');
    expect(advance(ai, 19).state).toBe('Dormant');
  });
  it('hits have a grace period and hiding breaks contact', () => {
    const ai = new CandlemanAI(); ai.reset(0, { x: 0, z: 0 }); ai.startHunt(20);
    expect(advance(ai, 1).damage).toBe(0);
    let damage = 0;
    for (let i = 0; i < 40; i++) damage += ai.update(0.1, input).damage;
    expect(damage).toBeGreaterThan(0);
    expect(advance(ai, 8, { ...input, hidden: true } as typeof input).state).toBe('Disappearing');
  });
  it('routes around walls and never sees through them', () => {
    const wall = (x: number, z: number) => Math.abs(x) < 0.4 && Math.abs(z) < 2;
    expect(hasLineOfSight({ x: -2, z: 0 }, { x: 2, z: 0 }, wall)).toBe(false);
    const path = findPath({ x: -2, z: 0 }, { x: 2, z: 0 }, wall);
    expect(path.length).toBeGreaterThan(4);
    expect(path.every(p => !wall(p.x, p.z))).toBe(true);
    const ai = new CandlemanAI(); ai.reset(1, { x: -2, z: 0 }); ai.startHunt(20);
    for (let i = 0; i < 50; i++) {
      const frame = ai.update(0.1, { player: { x: 2, z: 0 }, noise: 1, blocked: wall });
      expect(wall(frame.position.x, frame.position.z)).toBe(false);
    }
    expect(ai.position.x).toBeGreaterThan(0);
  });
});
