import { describe, it, expect } from 'vitest';
import { HorrorDirector, type HorrorEventType } from '../core/director';
describe('horror director', () => {
  it('gives opening grace and avoids consecutive repeated scares', () => {
    const director = new HorrorDirector();
    const types: HorrorEventType[] = [];
    for (let i = 0; i < 1500; i++) {
      const event = director.update(0.1, { level: 2, tension: 0.3, player: { x: Math.sin(i / 10) * 8, z: i % 12 } });
      if (i < 120) expect(event).toBeUndefined();
      if (event) types.push(event.type);
    }
    expect(types.length).toBeGreaterThan(3);
    for (let i = 1; i < types.length; i++) expect(types[i]).not.toBe(types[i - 1]);
  });
  it('does not pile environmental scares onto a hunt', () => {
    const director = new HorrorDirector();
    for (let i = 0; i < 1000; i++) expect(director.update(0.1, { level: 4, tension: 1, player: { x: i % 12, z: 0 } })).toBeUndefined();
  });
});
