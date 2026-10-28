import { describe,it,expect } from 'vitest';
import { GameModel,LEVELS,QUESTIONS,SHOP } from '../core/model';

function collectLevel(game:GameModel,secret=true){for(const object of game.level.objects){if(object.kind==='pickup'||secret&&object.kind==='secret')expect(game.interact(object.id).ok,object.id).toBe(true);}}
function solveLevel(game:GameModel){for(const puzzle of game.level.puzzles){const object=game.level.objects.find(o=>o.puzzle===puzzle.id)!;expect(game.interact(object.id).puzzle?.id).toBe(puzzle.id);expect(game.solve(puzzle.id,puzzle.answer).ok,puzzle.id).toBe(true);}}
function survive(game:GameModel){const duration=game.state.huntRemaining;for(let i=0;i<Math.ceil(duration);i++)game.tick(1);expect(game.state.huntRemaining).toBe(0);}
function answerLevel(game:GameModel){for(const id of game.level.questions){const circle=game.level.objects.find(o=>o.kind==='question')!;expect(game.interact(circle.id).question?.id).toBe(id);const question=QUESTIONS.find(q=>q.id===id)!;expect(game.answer(id,question.answer).ok,id).toBe(true);}}
function finishLevel(game:GameModel,secret=true){collectLevel(game,secret);solveLevel(game);survive(game);answerLevel(game);expect(game.canExit()).toBe(true);}

describe('complete gameplay paths',()=>{
 it('requires every objective, survives hunts, traverses five levels and reaches escape',()=>{
  const game=new GameModel();
  for(let level=0;level<5;level++){
   expect(game.state.level).toBe(level);expect(game.canExit()).toBe(false);expect(game.exitLevel().ok).toBe(false);
   finishLevel(game,false);
   if(level<4){expect(game.exitLevel().kind).toBe('shop');expect(game.state.unlocked).toBe(level+1);expect(game.nextLevel().ok).toBe(true);}else {expect(game.chooseEnding('truth').ok).toBe(false);expect(game.chooseEnding('escape').ok).toBe(true);}
  }
  expect(game.state.phase).toBe('ending');expect(game.state.ending).toBe('escape');expect(game.state.completedLevels).toEqual([0,1,2,3,4]);
 });
 it('collects clues across all previous floors to unlock the true ending',()=>{
  let game=new GameModel();
  for(let level=0;level<5;level++){finishLevel(game);if(level<4){game.exitLevel();game=GameModel.load(game.serialize());expect(game.state.phase).toBe('shop');game.nextLevel();}}
  expect(game.canTrueEnding()).toBe(true);expect(game.chooseEnding('truth').ok).toBe(true);
  game=GameModel.load(game.serialize());expect(game.state.endings).toEqual(['truth']);expect(game.state.coins).toBeGreaterThan(500);
 });
 it('lets an escaped player revisit missing clues and reach the second ending',()=>{
  const game=new GameModel();for(let i=0;i<5;i++){finishLevel(game,false);if(i<4){game.exitLevel();game.nextLevel();}}game.chooseEnding('escape');
  for(let i=0;i<4;i++){expect(game.selectLevel(i).ok).toBe(true);expect(game.interact(`l${i}-secret`).ok).toBe(true);}
  game.selectLevel(4);expect(game.chooseEnding('truth').ok).toBe(true);expect(game.state.endings).toEqual(['escape','truth']);
 });
});

describe('puzzles and question rules',()=>{
 it('contains 30 unique valid offline questions and the first riddle answer is a hole',()=>{
  expect(QUESTIONS).toHaveLength(30);expect(new Set(QUESTIONS.map(q=>q.id)).size).toBe(30);
  for(const q of QUESTIONS){expect(q.options).toHaveLength(4);expect(q.options[q.answer]).toBeTruthy();expect(q.hint.length).toBeGreaterThan(10);}
  expect(QUESTIONS[0].options[QUESTIONS[0].answer].toLowerCase()).toContain('hole');
 });
 it('rejects a puzzle without required items, a wrong sequence, and replayed rewards',()=>{
  const g=new GameModel();expect(g.solve('basement-fuses','blue red yellow').ok).toBe(false);collectLevel(g);
  expect(g.solve('basement-fuses','red blue yellow').ok).toBe(false);expect(g.state.sanity).toBe(95);
  expect(g.solve('basement-fuses',' BLUE, RED, YELLOW ').ok).toBe(true);const coins=g.state.coins;
  expect(g.solve('basement-fuses','blue red yellow').ok).toBe(false);expect(g.state.coins).toBe(coins);
 });
 it('rejects out of order questions and activates a recoverable penalty hunt',()=>{
  const g=new GameModel();expect(g.answer('q01',1).ok).toBe(false);collectLevel(g);solveLevel(g);
  expect(g.answer('q02',1).ok).toBe(false);expect(g.answer('q01',0).hunt).toBe(true);expect(g.state.sanity).toBe(80);
  expect(g.answer('q01',1).ok).toBe(false);survive(g);expect(g.answer('q01',1).ok).toBe(true);
  const coins=g.state.coins;expect(g.answer('q01',1).ok).toBe(false);expect(g.state.coins).toBe(coins);
 });
 it('all puzzle prerequisites and objects are valid and every required puzzle has a discoverable clue',()=>{
  for(const l of LEVELS){const ids=new Set([...l.objects.map(o=>o.id),...l.puzzles.map(p=>p.id)]);for(const p of l.puzzles){expect(p.clue.length).toBeGreaterThan(10);expect(l.objects.some(o=>o.puzzle===p.id)).toBe(true);for(const id of p.requires)expect(ids.has(id),id).toBe(true);}}
 });
});

describe('economy, inventory and persistence',()=>{
 it('cannot buy outside a shop, overspend, duplicate upgrades, or overfill consumable pockets',()=>{
  const g=new GameModel();expect(g.purchase('battery').ok).toBe(false);finishLevel(g);g.exitLevel();
  g.state.coins=44;expect(g.purchase('battery').ok).toBe(false);expect(g.state.coins).toBe(44);
  g.state.coins=400;expect(g.purchase('battery').ok).toBe(true);expect(g.state.coins).toBe(355);expect(g.purchase('battery').ok).toBe(false);
  expect(g.purchase('hint').ok).toBe(true);expect(g.purchase('revival').ok).toBe(true);expect(g.purchase('hint').ok).toBe(false);
  expect(g.purchase('slot').ok).toBe(true);expect(g.purchase('hint').ok).toBe(true);expect(g.purchase('hint').ok).toBe(false);
  expect(g.purchase('fake').ok).toBe(false);expect(g.state.coins).toBeGreaterThanOrEqual(0);
 });
 it('purchases persist with exact inventory capacity, rewards cannot be replayed after load or retry',()=>{
  let g=new GameModel();finishLevel(g);g.exitLevel();g.purchase('stamina');g.purchase('hint');const before=g.state.coins;
  g=GameModel.load(g.serialize());expect(g.state.coins).toBe(before);expect(g.maxStamina).toBe(150);expect(g.state.upgrades.hint).toBe(1);
  g.selectLevel(0);expect(g.interact('flashlight').ok).toBe(false);expect(g.state.coins).toBe(before);g.damage(100);g.retry();g.interact('flashlight');expect(g.state.coins).toBe(before);
  g.exitLevel();expect(g.state.coins).toBe(before);
 });
 it('uses a hint once, consumes a revival once, and handles death/retry',()=>{
  const g=new GameModel();collectLevel(g);solveLevel(g);g.state.upgrades.hint=1;
  expect(g.useHint('q01').message.toLowerCase()).toContain('hole');expect(g.state.upgrades.hint).toBe(0);expect(g.useHint('q01').ok).toBe(false);
  g.state.upgrades.revival=1;g.damage(150);expect(g.state.phase).toBe('playing');expect(g.state.health).toBe(65);expect(g.state.upgrades.revival).toBe(0);
  g.damage(100);expect(g.state.phase).toBe('dead');expect(g.state.health).toBe(0);expect(g.state.deaths).toBe(1);
  const dead=GameModel.load(g.serialize());expect(dead.state.phase).toBe('dead');expect(dead.retry().ok).toBe(true);expect(dead.state.health).toBe(100);expect(dead.has('flashlight')).toBe(true);
 });
 it('restarts an unfinished mandatory hunt after death without losing required objects',()=>{
  const g=new GameModel();finishLevel(g);g.exitLevel();g.nextLevel();collectLevel(g);solveLevel(g);expect(g.state.huntRemaining).toBe(18);
  g.tick(1);g.damage(100);g.retry();expect(g.state.huntRemaining).toBe(18);survive(g);answerLevel(g);expect(g.canExit()).toBe(true);
 });
 it('rejects missing, corrupt, unversioned, negative, invalid and duplicate save data',()=>{
  for(const input of [null,undefined,'no json','{}','null','[]'])expect(GameModel.load(input).state).toEqual(new GameModel().state);
  for(const patch of [{coins:-1},{level:9},{health:NaN},{health:0},{solved:['basement-code']},{secrets:[0]},{unlocked:4},{phase:'shop'},{collected:['flashlight','flashlight']},{answered:['unknown']},{upgrades:{hint:200}}]){
   const state={...new GameModel().state,...patch};expect(GameModel.load(JSON.stringify(state)).state).toEqual(new GameModel().state);
  }
 });
 it('resumes an unfinished mandatory hunt after level selection',()=>{const g=new GameModel();finishLevel(g);g.exitLevel();g.nextLevel();collectLevel(g);solveLevel(g);g.selectLevel(0);g.selectLevel(1);expect(g.state.huntRemaining).toBe(18);survive(g);answerLevel(g);expect(g.canExit()).toBe(true);});
 it('level selection never unlocks inaccessible levels',()=>{const g=new GameModel();expect(g.selectLevel(1).ok).toBe(false);expect(g.selectLevel(-1).ok).toBe(false);expect(g.selectLevel(0.5).ok).toBe(false);expect(g.state.level).toBe(0);expect(SHOP.every(s=>s.price>0)).toBe(true);});
});
