import { LEVELS, type LevelData, type Puzzle, type WorldObject } from '../data/levels';
import { QUESTIONS, type Question } from '../data/questions';
export { LEVELS, QUESTIONS };
export type { LevelData, Puzzle, WorldObject, Question };
export type Upgrade = 'battery'|'stamina'|'protection'|'slot'|'revival'|'hint';
export interface ShopItem { id: Upgrade; name: string; price: number; description: string; max: number }
export const SHOP:ShopItem[]=[
 {id:'battery',name:'Long-life battery',price:45,description:'Double flashlight endurance.',max:1},
 {id:'stamina',name:'Runner’s breath',price:40,description:'50% more sprint stamina.',max:1},
 {id:'protection',name:'Silver ward',price:55,description:'Halve all sanity damage.',max:1},
 {id:'slot',name:'Reliquary pocket',price:20,description:'Carry one more consumable. Quest objects use a separate satchel.',max:1},
 {id:'revival',name:'Borrowed life',price:70,description:'Automatically survive one fatal blow.',max:1},
 {id:'hint',name:'Keeper’s whisper',price:15,description:'Reveal the current question’s answer once.',max:3},
];
export interface GameState {
 version:2; level:number; unlocked:number; coins:number; health:number; sanity:number; stamina:number; battery:number;
 inventory:string[]; collected:string[]; solved:string[]; answered:string[]; secrets:number[];
 upgrades:Record<Upgrade,number>; rewarded:string[]; completedLevels:number[]; huntedLevels:number[];
 huntRemaining:number; phase:'playing'|'shop'|'dead'|'ending'; ending:'escape'|'truth'|null;
 endings:('escape'|'truth')[]; deaths:number; playTime:number;
}
export interface ActionResult {ok:boolean;message:string;kind?:'inspect'|'pickup'|'puzzle'|'question'|'exit'|'hide'|'secret'|'shop'|'ending'|'death';puzzle?:Puzzle;question?:Question;hunt?:boolean}
const fail=(message:string):ActionResult=>({ok:false,message});
const normalize=(s:string)=>s.toLowerCase().trim().replace(/[^a-z0-9]+/g,' ').trim();
const fresh=():GameState=>({version:2,level:0,unlocked:0,coins:0,health:100,sanity:100,stamina:100,battery:100,inventory:[],collected:[],solved:[],answered:[],secrets:[],upgrades:{battery:0,stamina:0,protection:0,slot:0,revival:0,hint:0},rewarded:[],completedLevels:[],huntedLevels:[],huntRemaining:0,phase:'playing',ending:null,endings:[],deaths:0,playTime:0});
export class GameModel {
 state:GameState;
 constructor(state?:GameState){this.state=state?structuredClone(state):fresh();}
 get level():LevelData{return LEVELS[this.state.level];}
 get maxStamina(){return this.state.upgrades.stamina?150:100;}
 get hasFlashlight(){return this.state.collected.includes('flashlight');}
 get currentQuestion():Question|undefined {return this.level.questions.map(id=>QUESTIONS.find(q=>q.id===id)!).find(q=>!this.state.answered.includes(q.id));}
 get puzzlesComplete(){return this.level.puzzles.every(p=>this.state.solved.includes(p.id));}
 get inventoryCapacity(){return 2+this.state.upgrades.slot;}
 get consumables(){return this.state.upgrades.revival+this.state.upgrades.hint;}
 has(id:string){return this.state.collected.includes(id)||this.state.solved.includes(id);}
 reward(id:string,amount:number){if(this.state.rewarded.includes(id))return 0;this.state.rewarded.push(id);this.state.coins+=Math.max(0,Math.floor(amount));return amount;}
 objective():string {
  if(this.state.phase==='dead')return 'The dark has taken you. Retry your checkpoint.';
  if(this.state.huntRemaining>0)return `Survive the hunt · ${Math.ceil(this.state.huntRemaining)} seconds. Hide, stay quiet, or keep moving.`;
  for(const puzzle of this.level.puzzles){if(!this.state.solved.includes(puzzle.id)){
   const missing=puzzle.requires.filter(id=>!this.has(id));
   if(missing.length)return `Find ${missing.map(id=>this.level.objects.find(o=>o.id===id)?.label??this.level.puzzles.find(p=>p.id===id)?.title??id).join(', ')}.`;
   return puzzle.title+' · '+puzzle.description;
  }}
  if(this.currentQuestion)return `Enter the questioning circle · ${this.level.questions.filter(id=>this.state.answered.includes(id)).length}/${this.level.questions.length} answers accepted.`;
  return this.level.id===4?'The final seal is open. Choose what becomes of the flame.':'The stairway seal is open. Descend to the next level.';
 }
 availableObjects(){return this.level.objects.filter(o=>!['pickup','secret'].includes(o.kind)||!this.state.collected.includes(o.id));}
 interact(id:string):ActionResult {
  if(this.state.phase!=='playing')return fail('Return to the descent first.');
  const object=this.level.objects.find(o=>o.id===id);if(!object)return fail('Nothing to interact with.');
  if(object.kind==='note'){if(!this.state.collected.includes(id))this.state.collected.push(id);if(!this.state.inventory.includes(object.label))this.state.inventory.push(object.label);return {ok:true,kind:'inspect',message:object.text??''};}
  if(object.kind==='hide')return {ok:true,kind:'hide',message:object.text??'You hold your breath in the dark.'};
  if(object.kind==='pickup'||object.kind==='secret'){
   if(this.state.collected.includes(id))return fail('Already collected.');
   this.state.collected.push(id);
   if(object.kind==='secret') {if(!this.state.secrets.includes(this.state.level))this.state.secrets.push(this.state.level);this.reward(id,15);return {ok:true,kind:'secret',message:(object.text??'A lost memory.')+' · +15 coins'};}
   if(object.item!=='Offering'&&object.item&&!this.state.inventory.includes(object.item))this.state.inventory.push(object.item);
   const coins=object.item==='Offering'?15:5;this.reward(id,coins);
   return {ok:true,kind:'pickup',message:`${object.label} acquired · +${coins} coins${object.text?'\n'+object.text:''}`};
  }
  if(object.kind==='puzzle'){
   const puzzle=this.level.puzzles.find(p=>p.id===object.puzzle)!;
   if(this.state.solved.includes(puzzle.id))return {ok:true,kind:'inspect',message:'The mechanism is already complete.'};
   const missing=puzzle.requires.filter(r=>!this.has(r));
   if(missing.length)return fail('Still needed: '+missing.map(r=>this.level.objects.find(o=>o.id===r)?.label??this.level.puzzles.find(p=>p.id===r)?.title??r).join(', '));
   return {ok:true,kind:'puzzle',puzzle,message:puzzle.description};
  }
  if(object.kind==='question'){
   if(!this.puzzlesComplete)return fail('“Finish what the room asks of you. Then speak.”');
   if(this.state.huntRemaining>0)return fail('Survive his hunt before you speak.');
   const question=this.currentQuestion;
   return question?{ok:true,kind:'question',question,message:question.text}:{ok:true,kind:'inspect',message:'“Your answers have been accepted. The stairs await.”'};
  }
  return this.exitLevel();
 }
 solve(id:string,input:string):ActionResult {
  if(this.state.phase!=='playing')return fail('Return to the descent first.');
  const puzzle=this.level.puzzles.find(p=>p.id===id);
  if(!puzzle)return fail('Unknown mechanism.');
  if(this.state.solved.includes(id))return fail('Already solved.');
  if(!puzzle.requires.every(r=>this.has(r)))return fail('You have not found everything this mechanism needs.');
  if(normalize(input)!==normalize(puzzle.answer)) {this.hurtSanity(5);return fail('The mechanism rejects the sequence. Read the clue and try again.');}
  this.state.solved.push(id);this.reward('puzzle:'+id,puzzle.reward);
  const hunt=!!puzzle.hunt&&!this.state.huntedLevels.includes(this.state.level);
  if(hunt)this.state.huntRemaining=this.level.hunt;
  return {ok:true,message:`${puzzle.title} complete · +${puzzle.reward} coins${hunt?'\nHe heard you. Survive the hunt.':''}`,hunt};
 }
 answer(id:string,index:number):ActionResult {
  if(this.state.phase!=='playing'||!this.puzzlesComplete||this.state.huntRemaining>0)return fail('The room is not ready for your answer.');
  const question=this.currentQuestion;if(!question||question.id!==id)return fail('That question is not awaiting an answer.');
  if(!Number.isInteger(index)||index<0||index>=question.options.length)return fail('Choose an answer.');
  if(index!==question.answer){this.hurtSanity(20);this.state.huntRemaining=12+this.state.level*2;return {ok:false,message:'“A careless answer has a cost. Run.”',hunt:true};}
  this.state.answered.push(id);this.reward('question:'+id,20);this.state.sanity=Math.min(100,this.state.sanity+10);
  return {ok:true,message:'“You remember more than you should.” · +20 coins'};
 }
 completeHunt(){this.state.huntRemaining=0;if(!this.state.huntedLevels.includes(this.state.level))this.state.huntedLevels.push(this.state.level);}
 tick(seconds:number){if(this.state.phase!=='playing')return;const dt=Math.max(0,Math.min(seconds,1));this.state.playTime+=dt;if(this.state.huntRemaining>0){this.state.huntRemaining=Math.max(0,this.state.huntRemaining-dt);if(this.state.huntRemaining===0)this.completeHunt();}}
 canExit(){return this.state.phase==='playing'&&this.puzzlesComplete&&!this.currentQuestion&&this.state.huntRemaining===0&&(this.level.hunt===0||this.state.huntedLevels.includes(this.state.level));}
 exitLevel():ActionResult {
  if(!this.canExit())return fail('The stairway is sealed. '+this.objective());
  if(this.state.level===4)return {ok:true,kind:'ending',message:'Extinguish the flame and escape, or return it to the dawn.'};
  this.reward('level:'+this.state.level,40);if(!this.state.completedLevels.includes(this.state.level))this.state.completedLevels.push(this.state.level);
  this.state.unlocked=Math.max(this.state.unlocked,this.state.level+1);this.state.phase='shop';
  return {ok:true,kind:'shop',message:'Level complete · +40 coins. Spend your offerings before descending.'};
 }
 nextLevel():ActionResult {if(this.state.phase!=='shop'||this.state.level>=4)return fail('The next level is still sealed.');this.state.level++;this.state.phase='playing';this.state.health=100;this.state.sanity=Math.max(70,this.state.sanity);this.state.stamina=this.maxStamina;this.state.battery=100;this.state.huntRemaining=this.level.hunt>0&&!this.state.huntedLevels.includes(this.state.level)&&this.puzzlesComplete?this.level.hunt:0;return {ok:true,message:this.level.description};}
 selectLevel(index:number):ActionResult {if(!Number.isInteger(index)||index<0||index>this.state.unlocked||index>4)return fail('That level is locked.');this.state.level=index;this.state.phase='playing';this.state.health=100;this.state.sanity=100;this.state.stamina=this.maxStamina;this.state.battery=100;this.state.huntRemaining=this.level.hunt>0&&!this.state.huntedLevels.includes(this.state.level)&&this.puzzlesComplete?this.level.hunt:0;this.state.ending=null;return {ok:true,message:this.level.description};}
 purchase(id:Upgrade|string):ActionResult {
  if(this.state.phase!=='shop')return fail('The keeper trades only between levels.');
  const item=SHOP.find(i=>i.id===id);if(!item)return fail('Unknown item.');
  if(this.state.upgrades[item.id]>=item.max)return fail('You already carry the maximum.');
  if((id==='revival'||id==='hint')&&this.consumables>=this.inventoryCapacity)return fail('Your consumable pockets are full.');
  if(this.state.coins<item.price)return fail('Not enough coins.');
  this.state.coins-=item.price;this.state.upgrades[item.id]++;if(id==='stamina')this.state.stamina=this.maxStamina;
  return {ok:true,message:item.name+' acquired.'};
 }
 useHint(questionId?:string):ActionResult {if(this.state.upgrades.hint<=0)return fail('No keeper’s whispers remain.');const question=this.currentQuestion;if(!question||questionId&&questionId!==question.id)return fail('No question is waiting.');if(!this.puzzlesComplete)return fail('Complete the room’s mechanisms first.');this.state.upgrades.hint--;return {ok:true,message:`The whisper says: ${question.options[question.answer]}. ${question.hint}`};}
 hurtSanity(amount:number){this.state.sanity=Math.max(0,this.state.sanity-Math.max(0,amount)*(this.state.upgrades.protection?0.5:1));if(this.state.sanity===0)this.damage(10);}
 damage(amount:number):ActionResult {if(this.state.phase!=='playing')return fail('The descent is paused.');this.state.health=Math.max(0,this.state.health-Math.max(0,amount));if(this.state.health>0)return {ok:true,message:'The darkness leaves its mark.'};if(this.state.upgrades.revival>0){this.state.upgrades.revival--;this.state.health=65;this.state.sanity=Math.max(50,this.state.sanity);this.completeHunt();return {ok:true,message:'Your borrowed life burns away. You live.'};}this.state.phase='dead';this.state.deaths++;return {ok:true,kind:'death',message:'Your flame goes out.'};}
 retry():ActionResult {if(this.state.phase!=='dead')return fail('Your flame still burns.');this.state.phase='playing';this.state.health=100;this.state.sanity=75;this.state.stamina=this.maxStamina;this.state.battery=100;
 // Retry keeps earned objects but never rewards them twice. Unfinished mandatory hunts restart.
 this.state.huntRemaining=this.level.hunt>0&&!this.state.huntedLevels.includes(this.state.level)&&this.puzzlesComplete?this.level.hunt:0;
 return {ok:true,message:'You awaken at the stairway. Your collected objects remain.'};}
 canTrueEnding(){return [0,1,2,3].every(n=>this.state.secrets.includes(n))&&this.state.collected.includes('origin');}
 chooseEnding(ending:'escape'|'truth'):ActionResult {if(this.state.level!==4||!this.canExit())return fail('The final seal is not open.');if(ending==='truth'&&!this.canTrueEnding())return fail('Four photographs are missing from his story. Find them on the previous floors using Level Select.');if(ending!=='escape'&&ending!=='truth')return fail('Choose the fate of the flame.');this.reward('level:4',75);if(!this.state.completedLevels.includes(4))this.state.completedLevels.push(4);this.state.ending=ending;this.state.phase='ending';if(!this.state.endings.includes(ending))this.state.endings.push(ending);return {ok:true,kind:'ending',message:ending==='truth'?'You speak his name. Elias lets the last ember rise. Somewhere above, morning finds two empty graves.':'You extinguish the flame and climb into the rain. Behind you, a match is struck.'};}
 inspect(item:string){return LEVELS.flatMap(l=>l.objects).find(o=>o.item===item||o.label===item)?.text??`${item} · Kept in your quest satchel. Quest objects never consume pocket space.`;}
 journal(){return {notes:LEVELS.flatMap(l=>l.objects).filter(o=>o.kind==='note'&&this.state.collected.includes(o.id)),questions:QUESTIONS.filter(q=>this.state.answered.includes(q.id))};}
 serialize(){return JSON.stringify(this.state);}
 static load(raw:string|null|undefined):GameModel {
  if(!raw)return new GameModel();
  try{
   const s:unknown=JSON.parse(raw);if(!validState(s))return new GameModel();
   const rewardIds=[...s.collected,...s.solved.map(id=>'puzzle:'+id),...s.answered.map(id=>'question:'+id),...s.completedLevels.map(id=>'level:'+id)];
   s.rewarded=[...new Set([...s.rewarded,...rewardIds])];
   return new GameModel(s);
  }catch{return new GameModel();}
 }
}
function validState(value:unknown):value is GameState {
 if(!value||typeof value!=='object')return false;const s=value as GameState;
 if(s.version!==2||!Number.isInteger(s.level)||s.level<0||s.level>4||!Number.isInteger(s.unlocked)||s.unlocked<s.level||s.unlocked>4)return false;
 const inRange=(v:unknown,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max;
 if(!inRange(s.coins,100000)||!Number.isInteger(s.coins)||!inRange(s.health,100)||!inRange(s.sanity,100)||!inRange(s.stamina,150)||!inRange(s.battery,100)||!inRange(s.huntRemaining,120)||!inRange(s.deaths,100000)||!inRange(s.playTime,1e9))return false;
 if(!['playing','shop','dead','ending'].includes(s.phase)||!['escape','truth',null].includes(s.ending))return false;
 const ids=new Set(LEVELS.flatMap(l=>l.objects.map(o=>o.id))),puzzles=new Set(LEVELS.flatMap(l=>l.puzzles.map(p=>p.id))),questions=new Set(QUESTIONS.map(q=>q.id));
 const unique=(a:unknown):a is string[]=>Array.isArray(a)&&a.length<=300&&a.every(v=>typeof v==='string'&&v.length<=120)&&new Set(a).size===a.length;
 if(!unique(s.inventory)||!unique(s.collected)||!unique(s.solved)||!unique(s.answered)||!unique(s.rewarded))return false;
 if(!s.collected.every(x=>ids.has(x))||!s.solved.every(x=>puzzles.has(x))||!s.answered.every(x=>questions.has(x)))return false;
 const levels=(a:unknown)=>Array.isArray(a)&&a.length<=5&&new Set(a).size===a.length&&a.every(v=>Number.isInteger(v)&&v>=0&&v<=4);
 if(!levels(s.secrets)||!levels(s.completedLevels)||!levels(s.huntedLevels)||!Array.isArray(s.endings)||s.endings.length>2||!s.endings.every(v=>v==='escape'||v==='truth'))return false;
 if(!s.upgrades||SHOP.some(i=>!Number.isInteger(s.upgrades[i.id])||s.upgrades[i.id]<0||s.upgrades[i.id]>i.max))return false;
 if(s.upgrades.hint+s.upgrades.revival>2+s.upgrades.slot)return false;
 if(s.phase==='shop'&&(s.level===4||!s.completedLevels.includes(s.level)))return false;
 if(s.phase==='ending'&&(!s.ending||!s.completedLevels.includes(4)))return false;
 if(s.phase==='dead'&&s.health!==0||s.phase!=='dead'&&s.health===0)return false;
 const has=(id:string)=>s.collected.includes(id)||s.solved.includes(id);
 if(LEVELS.flatMap(l=>l.puzzles).some(p=>s.solved.includes(p.id)&&!p.requires.every(has)))return false;
 if(LEVELS.some(l=>l.questions.some(id=>s.answered.includes(id))&&!l.puzzles.every(p=>s.solved.includes(p.id))))return false;
 if(s.secrets.some(n=>!s.collected.includes(`l${n}-secret`)))return false;
 if(s.completedLevels.some(n=>!LEVELS[n].puzzles.every(p=>s.solved.includes(p.id))||!LEVELS[n].questions.every(q=>s.answered.includes(q))||LEVELS[n].hunt>0&&!s.huntedLevels.includes(n)))return false;
 for(let n=0;n<s.unlocked;n++)if(!s.completedLevels.includes(n))return false;
 return true;
}
