import {test,expect,type Page} from '@playwright/test';
import {LEVELS, type WorldObject} from '../src/data/levels';
import {QUESTIONS} from '../src/data/questions';

declare global {interface Window {__game:any}}

async function boot(page:Page) {
 await page.addInitScript(()=>{if(!localStorage.getItem('candleman.settings'))localStorage.setItem('candleman.settings',JSON.stringify({graphics:'low',master:0}));});
 await page.goto('/');
 await expect(page.locator('[data-action="new"]')).toBeVisible({timeout:60000});
 await page.waitForFunction(()=>!!window.__game);
}
async function start(page:Page) {await boot(page);await page.click('[data-action="new"]');await expect(page.locator('.hud')).toBeVisible();}
async function play(page:Page) {await page.evaluate(()=>{window.__game.world.resumeCamera();window.__game.setScreen('game');});}
async function approach(page:Page,o:WorldObject) {
 await play(page);
 await page.evaluate(({x,z})=>{const w=window.__game.world;w.setPosition(x,z+2);const d=w.direction;const yaw=Math.atan2(-d.x,-d.z);w.look(yaw/.002,w.camera.rotation.x/.002,1);},o);
 await expect.poll(()=>page.evaluate(()=>window.__game.world.target),{timeout:10000}).toBe(o.id);
 await page.keyboard.press('KeyE');
}
async function closeNote(page:Page) {if(await page.locator('[data-action="resume"]').isVisible())await page.click('[data-action="resume"]');}
async function solveFloor(page:Page,level:number) {
 const l=LEVELS[level];
 for(const o of l.objects.filter(o=>o.kind==='pickup'||o.kind==='secret'||o.kind==='note')) {await approach(page,o);await closeNote(page);}
 for(const p of l.puzzles) {
  const obj=l.objects.find(o=>o.puzzle===p.id)!;await approach(page,obj);
  await expect(page.locator('h2')).toHaveText(p.title);
  if(p.options) {for(const s of p.answer.split(' '))await page.locator(`[data-piece="${s}"]`).click();await page.click('[data-action="solve"]');}
  else {await page.fill('#puzzle-answer',p.answer);await page.locator('#puzzle-form button[type="submit"]').click();}
  await expect.poll(()=>page.evaluate(id=>window.__game.model.state.solved.includes(id),p.id)).toBe(true);
  if(p.hunt) {
   // Fast-forward elapsed simulation time only. Enemy behavior is covered separately by unit tests.
   await page.evaluate(()=>{const g=window.__game;g.setScreen('pause');for(let i=0;i<120;i++)g.model.tick(1);g.enemy.reset(g.model.state.level);});
  }
 }
 for(const id of l.questions) {
  await approach(page,l.objects.find(o=>o.kind==='question')!);
  const q=QUESTIONS.find(q=>q.id===id)!;await expect(page.locator('.quote')).toContainText(q.text);
  await page.locator(`[data-answer="${q.answer}"]`).click();
  await expect.poll(()=>page.evaluate(id=>window.__game.model.state.answered.includes(id),id)).toBe(true);
 }
 await approach(page,l.objects.find(o=>o.kind==='exit')!);
}

test('five floors: physical interactions, all puzzles, shop, saves, and both endings',async({page})=>{
 test.setTimeout(300000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await start(page);
 for(let floor=0;floor<5;floor++) {
  await expect.poll(()=>page.evaluate(()=>window.__game.model.state.level)).toBe(floor);
  await solveFloor(page,floor);
  if(floor<4) {
   await expect(page.locator('h2')).toHaveText('The keeper’s exchange');
   if(floor===0) {
    const before=await page.evaluate(()=>window.__game.model.state.coins);
    await page.click('[data-buy="battery"]');
    await expect.poll(()=>page.evaluate(()=>window.__game.model.state.upgrades.battery)).toBe(1);
    expect(await page.evaluate(()=>window.__game.model.state.coins)).toBe(before-45);
    await page.click('[data-buy="battery"]');
    expect(await page.evaluate(()=>window.__game.model.state.coins)).toBe(before-45);
   }
   await page.click('[data-action="next"]');
  }
 }
 await expect(page.locator('[data-ending="truth"]')).toBeEnabled();
 await page.click('[data-ending="escape"]');await expect(page.locator('h2')).toHaveText('The world above.');
 await page.reload();await expect(page.locator('[data-action="continue"]')).toBeEnabled();await page.click('[data-action="continue"]');await expect(page.locator('h2')).toHaveText('The world above.');
 await page.click('[data-action="levels"]');await page.click('[data-level="4"]');await approach(page,LEVELS[4].objects.find(o=>o.kind==='exit')!);
 await page.click('[data-ending="truth"]');await expect(page.locator('h2')).toHaveText('A light returned.');
 expect(await page.evaluate(()=>window.__game.model.state.endings)).toEqual(['escape','truth']);
 expect(errors).toEqual([]);
});

test('keyboard movement, wall collisions, locked exits, death, retry and inventory',async({page})=>{
 await start(page);await play(page);
 const startZ=await page.evaluate(()=>window.__game.world.position.z);
 await page.keyboard.down('KeyW');await expect.poll(()=>page.evaluate(()=>window.__game.world.position.z),{timeout:15000}).toBeLessThan(startZ-.2);await page.keyboard.up('KeyW');
 expect(await page.evaluate(()=>window.__game.world.position.z)).toBeLessThan(startZ-.2);
 await page.evaluate(()=>window.__game.world.setPosition(0,-18));
 await page.keyboard.down('KeyW');await page.waitForTimeout(1000);await page.keyboard.up('KeyW');
 const z=await page.evaluate(()=>window.__game.world.position.z);expect(z).toBeGreaterThan(-18.6);
 await approach(page,LEVELS[0].objects.find(o=>o.kind==='exit')!);
 expect(await page.evaluate(()=>window.__game.model.state.level)).toBe(0);
 await expect(page.locator('#toast')).toContainText('sealed');
 await approach(page,LEVELS[0].objects.find(o=>o.id==='flashlight')!);await closeNote(page);await play(page);
 await page.keyboard.press('Tab');await expect(page.locator('h2')).toHaveText('Inventory');await expect(page.locator('.list')).toContainText('Flashlight');
 await page.click('[data-action="resume"]');
 await page.evaluate(()=>window.__game.model.damage(1000));
 await expect(page.locator('h2')).toHaveText('Not every light is kind.');
 await page.click('[data-action="retry"]');
 expect(await page.evaluate(()=>window.__game.model.state.health)).toBe(100);
 expect(await page.evaluate(()=>window.__game.model.state.inventory)).toContain('Flashlight');
});

test('settings bindings persist, chapter locks hold, corrupt saves recover',async({page})=>{
 await boot(page);await page.click('[data-action="settings"]');await page.click('[data-bind="forward"]');await page.keyboard.press('KeyZ');
 await expect(page.locator('[data-bind="forward"]')).toHaveText('Z');await page.click('[data-action="settings-back"]');
 await page.reload();await expect(page.locator('[data-action="settings"]')).toBeVisible();await page.click('[data-action="settings"]');await expect(page.locator('[data-bind="forward"]')).toHaveText('Z');await page.click('[data-action="settings-back"]');
 await page.click('[data-action="levels"]');await expect(page.locator('[data-level="1"]')).toBeDisabled();await page.click('[data-action="title"]');
 await page.evaluate(()=>localStorage.setItem('candleman.descent.v1','{broken'));await page.reload();await expect(page.locator('[data-action="continue"]')).toBeEnabled();await page.click('[data-action="continue"]');await expect(page.locator('.hud')).toBeVisible();
 expect(await page.evaluate(()=>window.__game.model.state.level)).toBe(0);
 expect(await page.evaluate(()=>window.__game.model.state.coins)).toBe(0);
});
