import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { PhysicsController } from '../physics/controller';

export interface WorldObject { id:string; label:string; x:number; z:number; kind:string; }
export interface Wall { x:number; z:number; w:number; d:number; }
export interface WorldInput { forward:number; strafe:number; sprint:boolean; crouch:boolean; flashlight:boolean; active:boolean; }
export type Graphics = 'low'|'medium'|'high';
type Candle = { light:THREE.PointLight; flame:THREE.Mesh; phase:number; };
const palettes = [
  { wall:0x414c48, floor:0x272d2a, fog:0x101c1b, accent:0xd8a55b, fill:0x416d6e },
  { wall:0x65847a, floor:0x36494b, fog:0x111e20, accent:0xbed5bc, fill:0x3a6873 },
  { wall:0x302e3d, floor:0x242c35, fog:0x101320, accent:0x9daddb, fill:0x44457b },
  { wall:0x635543, floor:0x3d332b, fog:0x25120e, accent:0xf6a34c, fill:0x70543a },
  { wall:0x393e40, floor:0x19242a, fog:0x0b1721, accent:0x73b6cb, fill:0x414881 },
];
export class World {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(72,1,.06,90);
  readonly renderer:THREE.WebGLRenderer;
  readonly spawn = { x:0, z:12 };
  readonly bounds = { minX:-14.5,maxX:14.5,minZ:-18.5,maxZ:14.5 };
  walls:Wall[]=[];
  target:string|null=null;
  level=0;
  private physics!:PhysicsController;
  private group = new THREE.Group();
  private enemy = new THREE.Group();
  private enemyWax!:THREE.Mesh;
  private enemyFlames:THREE.Mesh[]=[];
  private enemyState='dormant';
  private interactables = new Map<string,THREE.Object3D>();
  private objectData:WorldObject[]=[];
  private candles:Candle[]=[];
  private fixtures:THREE.PointLight[]=[];
  private dust!:THREE.Points;
  private flash!:THREE.SpotLight;
  private flashTarget=new THREE.Object3D();
  private arms=new THREE.Group();
  private torch=new THREE.Group();
  private yaw=0;
  private pitch=0;
  private time=0;
  private bob=0;
  private tension=0;
  private graphics:Graphics='high';
  private ray=new THREE.Raycaster();
  private white=new THREE.MeshBasicMaterial({color:0xffedc5});
  private mirrors:Reflector[]=[];
  private cinematic=false;
  private mapTextures:THREE.Texture[]=[];
  private flickerUntil=0;
  private hallucination = new THREE.Group();
  private door?:THREE.Mesh;
  private apparitionUntil=0;
  private fallingProps:{mesh:THREE.Mesh;velocity:number}[]=[];

  private constructor(public readonly canvas:HTMLCanvasElement) {
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.4;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.scene.add(this.group,this.camera,this.enemy,this.hallucination);
    this.camera.rotation.order='YXZ';
    this.makeHands();
    this.makeEnemy();
    this.flash=new THREE.SpotLight(0xe2eddc,35,26,.43,.6,1.4);
    this.flash.castShadow=true;this.flash.shadow.mapSize.set(1024,1024);
    this.flash.shadow.bias=-.0006;this.flash.shadow.normalBias=.03;
    this.camera.add(this.flash,this.flashTarget);this.flash.position.set(.25,-.22,.05);
    this.flashTarget.position.set(0,0,-7);this.flash.target=this.flashTarget;
    this.resize();
    window.addEventListener('resize',()=>this.resize());
  }
  static async create(canvas:HTMLCanvasElement):Promise<World> {
    const world=new World(canvas);world.physics=await PhysicsController.create();return world;
  }
  get position(){return this.physics.position;}
  get direction(){return {x:-Math.sin(this.yaw),z:-Math.cos(this.yaw)};}
  get isMoving(){return this.bob>0;}
  resize(){const w=this.canvas.clientWidth||innerWidth,h=this.canvas.clientHeight||innerHeight;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  look(dx:number,dy:number,sensitivity=.002){if(this.cinematic)return;const scale=sensitivity>.05?sensitivity*.002:sensitivity;this.yaw-=dx*scale;this.pitch=THREE.MathUtils.clamp(this.pitch-dy*scale,-1.35,1.35);}
  setPosition(x:number,z:number){this.physics.teleport(x,z);this.camera.position.set(x,1.64,z);this.cinematic=false;}
  setMenuCamera(){this.cinematic=true;this.camera.position.set(6,2.05,10);this.camera.lookAt(-.5,1.65,-9);this.arms.visible=false;this.flash.visible=false;}
  resumeCamera(){this.cinematic=false;this.arms.visible=true;}
  blocked(x:number,z:number){if(x<this.bounds.minX||x>this.bounds.maxX||z<this.bounds.minZ||z>this.bounds.maxZ)return true;return this.walls.some(w=>Math.abs(x-w.x)<w.w/2+.34&&Math.abs(z-w.z)<w.d/2+.34);}
  isBlocked(x:number,z:number){return this.blocked(x,z);}
  setTension(value:number){this.tension=Math.max(0,Math.min(1,value));}
  flicker(duration=2){this.flickerUntil=this.time+duration;}
  triggerEvent(kind:'fall'|'apparition'|'door'|'darkness'){
    this.flicker(kind==='darkness'?4:1.5);
    if(kind==='apparition')this.apparitionUntil=this.time+2;
    if(kind==='fall'){const p=this.position;const x=THREE.MathUtils.clamp(p.x+3,-13,13),z=THREE.MathUtils.clamp(p.z-4,-17,13);const mesh=this.box(x,3.2,z,.45,.55,.45,this.material(0x5b4c37,.3));this.fallingProps.push({mesh,velocity:0});}
    if(kind==='door'&&this.door)this.door.rotation.y=.18;
  }
  setGraphics(value:Graphics){this.graphics=value;this.renderer.setPixelRatio(Math.min(devicePixelRatio,value==='high'?1.5:value==='medium'?1.15:1));this.renderer.shadowMap.enabled=value!=='low';this.flash.castShadow=value==='high';this.mirrors.forEach(m=>m.visible=false);this.resize();}
  setObjectVisible(id:string,visible:boolean){const obj=this.interactables.get(id);if(obj)obj.visible=visible;}
  setExitUnlocked(unlocked:boolean){if(this.door){const material=this.door.material as THREE.MeshStandardMaterial;material.emissive.set(unlocked?0x446533:0x35120d);material.emissiveIntensity=unlocked?.3:.15;}}
  setEnemy(options:{x?:number;z?:number;position?:{x:number;z:number};visible:boolean;state:string}){const x=options.x??options.position?.x??0,z=options.z??options.position?.z??0;this.enemy.position.set(x,0,z);this.enemy.visible=options.visible;this.enemyState=options.state.toLowerCase();if(options.visible)this.enemy.rotation.y=Math.atan2(this.position.x-x,this.position.z-z);}
  loadLevel(index:number,objects:WorldObject[]){
    this.level=index;this.cinematic=false;this.fallingProps=[];this.apparitionUntil=0;this.objectData=objects;this.target=null;
    this.group.traverse(obj=>{if(obj instanceof THREE.Mesh){obj.geometry.dispose();const mats=Array.isArray(obj.material)?obj.material:[obj.material];mats.forEach(m=>m.dispose());}});
    for(const mirror of this.mirrors)mirror.getRenderTarget().dispose();
    this.mapTextures.forEach(t=>t.dispose());this.mapTextures=[];
    this.scene.remove(this.group);this.group=new THREE.Group();this.scene.add(this.group);this.interactables.clear();this.candles=[];this.fixtures=[];this.mirrors=[];this.walls=[];
    const p=palettes[index%5];this.scene.background=new THREE.Color(p.fog);this.scene.fog=new THREE.FogExp2(p.fog,index===4?.035:.028);
    this.group.add(new THREE.HemisphereLight(p.fill,0x100d0a,1.4));
    const wallMat=this.surface(p.wall,'wall');const floorMat=this.surface(p.floor,index===1?'tile':'floor');const ceilingMat=this.surface(0x252a28,'wall');
    const floor=this.box(0,-.16,-2,30,.3,34,floorMat);floor.receiveShadow=true;
    this.box(0,4.15,-2,30,.3,34,ceilingMat);
    this.wall(-15, -2,.4,34,wallMat);this.wall(15,-2,.4,34,wallMat);this.wall(0,15,30,.4,wallMat);this.wall(0,-19,30,.4,wallMat);
    // Partition walls leave central and cross passages connected on every floor.
    const segments=index===2?[-5,4]:index===3?[-5]:index===4?[4]:[-5,4];
    for(const x of [-5,5])for(const z of segments){this.wall(x,z,.38,3,wallMat);this.box(x,3.65,z,.6,.55,3.2,this.material(0x222925));}
    if(index===2){for(const x of [-10,10])this.wall(x,4,3,.3,wallMat);}
    // Colonnade, weathered beams, and ceiling pipes frame the descent.
    for(const z of [-15,-8,0,8]){
      for(const x of [-3.8,3.8]){this.box(x,1.9,z,.38,3.8,.48,this.surface(p.wall,'wall'));this.walls.push({x,z,w:.38,d:.48});this.box(x,3.7,z,.7,.35,.8,this.material(0x333a34));}
      this.box(0,3.72,z,8,.42,.48,this.material(index===3?0x352b25:0x303a37));
      if(index!==3)for(const x of [-1.5,1.7])this.pipe(x,3.42,z,7.5,0x5a4535,true);
      this.ceilingLamp(z,p.accent,index);
    }
    for(const x of [-14.3,14.3]){this.pipe(x,2.8,-2,31,0x665541,false);this.pipe(x,2.48,-2,31,0x453a30,false);}
    // Door remains physically sealed; level transition is model-gated interaction.
    this.box(0,1.65,-18.65,3.1,3.3,.2,this.material(0x181e1b));
    this.door=this.box(0,1.55,-18.48,2.4,3.05,.18,this.material(0x39443b,.55));
    for(let y=.45;y<2.9;y+=.35)this.box(0,y,-18.35,2.16,.04,.04,this.material(0x1a211d));
    this.box(.8,1.25,-18.22,.08,.3,.12,this.material(0xb99a55,.7));
    this.sign(`SECTOR 0${index+1}  /  DESCENT`,0,3.55,-18.65,3.2,.32);
    this.sign(['MAINTENANCE / LOWER LEVEL','ST. AGNES / WARD C','THE LOOKING GLASS','CHAPEL OF THE FIRST FLAME','NO FURTHER THAN THIS'][index],0,3.1,14.72,5,.4,Math.PI);
    this.stairs();
    if(index===0)this.basement();if(index===1)this.hospital();if(index===2)this.mirrorHall();if(index===3)this.cathedral();if(index===4)this.finalChamber();
    // Generic interaction plinths make every required object visible and reachable.
    objects.forEach(obj=>this.makeObject(obj,index));
    for(const [x,z] of [[-13,-17],[13,-17],[-13,12],[13,12],[-7,-11],[7,-11]])this.candle(x,.8,z,p.accent);
    this.makeDust();this.physics.reset(this.walls,this.spawn);this.yaw=0;this.pitch=0;this.arms.visible=true;this.enemy.visible=false;this.camera.position.set(0,1.64,12);
  }
  update(dt:number,input:WorldInput){
    dt=Math.min(.05,dt);this.time+=dt;
    if(input.active&&!this.cinematic){
      const length=Math.hypot(input.forward,input.strafe)||1;
      const speed=input.crouch?1.6:input.sprint?5.3:3;
      const dx=(-Math.sin(this.yaw)*input.forward+Math.cos(this.yaw)*input.strafe)/length*speed;
      const dz=(-Math.cos(this.yaw)*input.forward-Math.sin(this.yaw)*input.strafe)/length*speed;
      this.physics.move(dx,dz,dt);
      const moving=Math.abs(dx)+Math.abs(dz)>.1;this.bob=moving?this.bob+dt*(input.sprint?12:8):0;
      const p=this.physics.position;const height=input.crouch?1.03:1.64;
      this.camera.position.x=p.x;this.camera.position.z=p.z;
      this.camera.position.y=THREE.MathUtils.lerp(this.camera.position.y,height+(moving?Math.sin(this.bob)*.035:0),Math.min(1,dt*14));
      this.camera.rotation.set(this.pitch,this.yaw,Math.sin(this.bob*.5)*.003);
      this.arms.position.set(Math.cos(this.bob*.5)*.008,Math.sin(this.bob)*.008,0);
      this.flash.visible=input.flashlight;
    }
    this.torch.visible=input.flashlight;this.arms.visible=!this.cinematic;
    this.candles.forEach(c=>{c.light.intensity=(1.5+Math.sin(this.time*9+c.phase)*.25+Math.sin(this.time*17+c.phase)*.12)*(this.graphics==='low'?.6:1);c.flame.scale.set(.8+Math.sin(this.time*11+c.phase)*.16,1+Math.cos(this.time*15+c.phase)*.15,1);});
    this.fixtures.forEach((light,i)=>{const flickering=this.time<this.flickerUntil||Math.sin(this.time*.8+i*7)> .985;light.intensity=flickering?(Math.sin(this.time*31)>0?2:.05):(6+Math.sin(this.time*1.7+i)*.25);});
    if(this.enemy.visible){this.enemyWax.rotation.z=Math.sin(this.time*1.3)*.07;this.enemy.position.y=Math.sin(this.time*2)*.025;this.enemyFlames.forEach((f,i)=>{f.scale.y=1+Math.sin(this.time*17+i)*.25;});if(this.enemyState==='disappearing')this.enemy.visible=Math.sin(this.time*43)>0;}
    if(this.dust){this.dust.rotation.y=this.time*.006;this.dust.position.y=Math.sin(this.time*.07)*.15;}
    this.hallucination.visible=this.time<this.apparitionUntil||(this.tension>.72&&Math.sin(this.time*.3)>.94);
    this.fallingProps.forEach(prop=>{if(prop.mesh.position.y>.28){prop.velocity+=dt*9.8;prop.mesh.position.y=Math.max(.28,prop.mesh.position.y-prop.velocity*dt);prop.mesh.rotation.z+=dt*1.7;}else prop.mesh.rotation.z=THREE.MathUtils.lerp(prop.mesh.rotation.z,0,dt*5);});
    if(this.door)this.door.rotation.y=THREE.MathUtils.lerp(this.door.rotation.y,0,dt*.3);
    const closestMirror=this.graphics==='high'?this.mirrors.reduce<Reflector|null>((best,m)=>!best||m.position.distanceToSquared(this.camera.position)<best.position.distanceToSquared(this.camera.position)?m:best,null):null;this.mirrors.forEach(m=>m.visible=m===closestMirror);
    this.findTarget();this.renderer.render(this.scene,this.camera);
  }
  private findTarget(){
    this.target=null;if(this.cinematic)return;
    this.ray.setFromCamera(new THREE.Vector2(0,0),this.camera);this.ray.far=3.6;
    const hits=this.ray.intersectObjects([...this.interactables.values()],true);
    for(const hit of hits){let obj:THREE.Object3D|null=hit.object;while(obj&&!obj.userData.interactId)obj=obj.parent;if(!obj||!obj.visible)continue;const id=obj.userData.interactId as string;if(!this.interactables.get(id)?.visible)continue;const data=this.objectData.find(d=>d.id===id);if(!data)continue;const player=this.position;if(Math.hypot(player.x-data.x,player.z-data.z)>3.2)continue;
      let obstructed=false;for(let t=.1;t<.95;t+=.1){if(this.blocked(player.x+(data.x-player.x)*t,player.z+(data.z-player.z)*t)){obstructed=true;break;}}if(!obstructed){this.target=id;break;}}
  }
  private material(color:number,metalness=0){return new THREE.MeshStandardMaterial({color,roughness:metalness?.38:.87,metalness});}
  private box(x:number,y:number,z:number,w:number,h:number,d:number,material:THREE.Material){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;this.group.add(m);return m;}
  private wall(x:number,z:number,w:number,d:number,mat:THREE.Material){this.walls.push({x,z,w,d});return this.box(x,2,z,w,4,d,mat);}
  private surface(color:number,type:string){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d')!;
    const c=new THREE.Color(color);ctx.fillStyle=`#${c.getHexString()}`;ctx.fillRect(0,0,256,256);
    let seed=color;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296;};
    for(let i=0;i<6500;i++){const l=Math.floor(rand()*70);ctx.fillStyle=`rgba(${l+40},${l+38},${l+30},${rand()*.18})`;const s=rand()*6;ctx.fillRect(rand()*256,rand()*256,s,s);}
    ctx.strokeStyle='rgba(0,0,0,.3)';ctx.lineWidth=2;
    if(type==='tile'){for(let i=0;i<256;i+=64){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,256);ctx.moveTo(0,i);ctx.lineTo(256,i);ctx.stroke();}}
    else{for(let i=0;i<7;i++){ctx.beginPath();let x=rand()*256,y=rand()*256;ctx.moveTo(x,y);for(let j=0;j<5;j++){x+=rand()*18-9;y+=rand()*30;ctx.lineTo(x,y);}ctx.stroke();}}
    if(type==='wall'){for(let i=0;i<25;i++){const x=rand()*256;const gradient=ctx.createLinearGradient(x,0,x,256);gradient.addColorStop(0,'rgba(13,18,9,.35)');gradient.addColorStop(1,'rgba(13,18,9,0)');ctx.fillStyle=gradient;ctx.fillRect(x,0,rand()*5+1,rand()*256);}}
    const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(type==='wall'?2:8,type==='wall'?1:8);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;this.mapTextures.push(texture);
    return new THREE.MeshStandardMaterial({map:texture,roughness:type==='floor'?.4:.83,metalness:type==='floor'?.15:0});
  }
  private sign(text:string,x:number,y:number,z:number,w=2,h=.4,rot=0){const c=document.createElement('canvas');c.width=1024;c.height=128;const ctx=c.getContext('2d')!;ctx.fillStyle='#192721';ctx.fillRect(0,0,1024,128);ctx.strokeStyle='#7e8e77';ctx.lineWidth=4;ctx.strokeRect(8,8,1008,112);ctx.fillStyle='#d6d4ae';ctx.font='36px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,512,64,970);const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;this.mapTextures.push(texture);const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:texture,emissive:0x62715c,emissiveIntensity:.2,side:THREE.DoubleSide}));m.position.set(x,y,z);m.rotation.y=rot;this.group.add(m);return m;}
  private pipe(x:number,y:number,z:number,length:number,color:number,horizontal:boolean){const m=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,length,8),this.material(color,.7));m.rotation.x=Math.PI/2;if(horizontal)m.rotation.z=Math.PI/2;m.position.set(x,y,z);this.group.add(m);for(let i=-length/2+1;i<length/2;i+=2){const ring=new THREE.Mesh(new THREE.TorusGeometry(.083,.025,5,8),this.material(0x222b27,.6));ring.position.set(x+(horizontal?i:0),y,z+(horizontal?0:i));if(horizontal)ring.rotation.y=Math.PI/2;this.group.add(ring);}}
  private ceilingLamp(z:number,color:number,index:number){this.box(0,3.52,z,1.3,.16,.5,this.material(0x1b2420,.6));this.box(0,3.42,z,1,.04,.32,new THREE.MeshBasicMaterial({color}));const light=new THREE.PointLight(color,6,13,1.6);light.position.set(0,3.2,z);this.group.add(light);this.fixtures.push(light);
    const beam=new THREE.Mesh(new THREE.ConeGeometry(2.3,3.25,20,1,true),new THREE.MeshBasicMaterial({color,transparent:true,opacity:index===3?.012:.007,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));beam.position.set(0,1.75,z);this.group.add(beam);
  }
  private candle(x:number,y:number,z:number,color=0xffae5d){const base=new THREE.Mesh(new THREE.CylinderGeometry(.075,.09,.45,8),this.material(0xc3b58a));base.position.set(x,y,z);this.group.add(base);const flame=new THREE.Mesh(new THREE.SphereGeometry(.045,6,8),new THREE.MeshBasicMaterial({color:0xffd396}));flame.scale.y=2.4;flame.position.set(x,y+.29,z);this.group.add(flame);const light=new THREE.PointLight(color,1.6,5,1.7);light.position.copy(flame.position);this.group.add(light);this.candles.push({light,flame,phase:x*5+z});}
  private stairs(){for(let i=0;i<6;i++)this.box(0,-.02+i*.035,14-i*.27,3,.07+i*.07,.3,this.material(0x45483f));for(const x of [-1.8,1.8]){this.box(x,.65,13.3,.08,1.3,.08,this.material(0x212821,.7));this.box(x,1.25,13.4,.06,.06,2,this.material(0x43483a,.7));}}
  private basement(){
    for(const x of [-11,11])for(const z of [-5,4]){this.box(x,.48,z,2.4,.96,.9,this.material(0x3b3024));this.walls.push({x,z,w:2.4,d:.9});this.box(x,1,z,2.55,.1,1.05,this.material(0x514534));for(const dx of [-.9,.9])this.box(x+dx,.6,z+.46,.05,.8,.03,this.material(0x806443,.3));}
    for(const x of [-13,13]){this.box(x,.75,-10,1.1,1.5,1.1,this.material(0x293b35,.55));for(const y of [.2,1.1])this.box(x,y,-10,1.14,.07,1.14,this.material(0x111c18,.65));}
    const water=new THREE.Mesh(new THREE.PlaneGeometry(5,6),new THREE.MeshStandardMaterial({color:0x243d3d,metalness:.65,roughness:.12,transparent:true,opacity:.7}));water.rotation.x=-Math.PI/2;water.position.set(-9,.006,-5);this.group.add(water);this.sign('DANGER  /  HIGH VOLTAGE',-10,2,-18.7,3,.4);
  }
  private hospital(){
    for(const x of [-11,11])for(const z of [-5,4]){const mat=this.material(0x899b86,.3);this.walls.push({x,z,w:2.4,d:1.1});this.box(x,.72,z,2.4,.12,1.1,mat);this.box(x,.9,z,2.3,.25,.95,this.material(0x6d7c69));this.box(x-.8,1.06,z,.5,.12,.8,this.material(0x939c80));for(const dx of [-1,1])for(const dz of [-.4,.4])this.box(x+dx,.36,z+dz,.05,.7,.05,mat);this.box(x+1.2,1,z,.05,.9,1.15,mat);}
    this.sign('WARD C / THE NAMES MUST BE RETURNED',0,2.8,-18.4,5,.35);
    for(const z of [-12,-2,9])for(const x of [-14.75,14.75]){const plane=new THREE.Mesh(new THREE.PlaneGeometry(.8,2),new THREE.MeshStandardMaterial({color:0x512b27,roughness:.8,transparent:true,opacity:.5,side:THREE.DoubleSide}));plane.position.set(x,1.2,z);plane.rotation.y=Math.PI/2;this.group.add(plane);}
    const chair=this.box(12,.65,10,.8,.15,.8,this.material(0x25332f));this.box(12,1.1,10.35,.8,.85,.1,this.material(0x314036));for(const x of [11.5,12.5]){const wheel=new THREE.Mesh(new THREE.TorusGeometry(.45,.04,8,20),this.material(0x212724,.7));wheel.position.set(x,.48,10);wheel.rotation.y=Math.PI/2;this.group.add(wheel);}chair.rotation.y=.15;
  }
  private mirrorHall(){for(const x of [-14.65,14.65])for(const z of [-12,-4,5]){this.box(x,1.9,z,.2,3,2.5,this.material(0x7a6e4c,.65));const mirror=new Reflector(new THREE.PlaneGeometry(2.2,2.7),{clipBias:.003,textureWidth:512,textureHeight:512,color:0x777f8d});mirror.position.set(x+(x<0?.13:-.13),1.9,z);mirror.rotation.y=x<0?Math.PI/2:-Math.PI/2;this.group.add(mirror);this.mirrors.push(mirror);}
    const symbols=['SUN','EYE','MOON'];symbols.forEach((s,i)=>{this.sign(s,-10+i*10,2,-18.6,1,1);});
  }
  private cathedral(){for(const x of [-10,10])for(const z of [-5,4]){this.box(x,.55,z,3,.12,.8,this.material(0x3e2d20));this.walls.push({x,z,w:3,d:.8});this.box(x,.85,z+.35,3,.7,.1,this.material(0x342419));for(const dx of [-1.25,1.25])this.box(x+dx,.25,z,.12,.5,.6,this.material(0x39291c));}
    for(const x of [-12,12]){this.box(x,1,-13,1.6,2,1.6,this.material(0x5a5445));const figure=new THREE.Mesh(new THREE.ConeGeometry(.7,1.7,7),this.material(0x827b68));figure.position.set(x,2.8,-13);this.group.add(figure);const head=new THREE.Mesh(new THREE.SphereGeometry(.24,8,8),this.material(0x827b68));head.position.set(x,3.8,-13);this.group.add(head);}
    for(let i=0;i<16;i++){const a=i/16*Math.PI*2;this.candle(Math.cos(a)*6,.3,Math.sin(a)*5-8);}
    const ring=new THREE.Mesh(new THREE.RingGeometry(2.9,2.96,64),new THREE.MeshBasicMaterial({color:0xaa6a39,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.set(0,.01,-8);this.group.add(ring);
  }
  private finalChamber(){for(let i=0;i<10;i++){const a=i/10*Math.PI*2,x=Math.sin(a)*12,z=Math.cos(a)*12-2;const block=this.box(x,2.6,z,.6,1.8,.6,this.material(0x667173,.7));block.rotation.set(.3*i,.5*i,.2*i);this.candle(x,.4,z,0x79c2df);}
    const ring=new THREE.Mesh(new THREE.TorusGeometry(3,.04,6,80),new THREE.MeshBasicMaterial({color:0x5b9da7}));ring.position.set(0,2,-18.7);this.group.add(ring);this.sign('ELIAS VALE — KEEPER OF THE LIGHT',0,3.4,-18.5,4,.3);
  }
  private makeObject(obj:WorldObject,index:number){
    const g=new THREE.Group();g.position.set(obj.x,0,obj.z);g.userData.interactId=obj.id;this.group.add(g);this.interactables.set(obj.id,g);
    const add=(geometry:THREE.BufferGeometry,material:THREE.Material,x:number,y:number,z:number)=>{const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;};
    const kind=obj.kind.toLowerCase(),label=obj.label.toLowerCase();
    if(kind.includes('exit')){add(new THREE.BoxGeometry(.65,.85,.12),this.material(0x435447,.4),0,1.45,0);this.sign('DESCEND',obj.x,2.1,obj.z+.1,1,.25);}
    else if(kind.includes('hid')){add(new THREE.BoxGeometry(1.4,2.2,.8),this.material(0x30453d,.5),0,1.1,0);for(let y=1.6;y<2;y+=.1)add(new THREE.BoxGeometry(.75,.03,.04),this.material(0x0c1611),0,y,.42);}
    else if(kind.includes('note')||kind.includes('clue')||label.includes('record')||kind.includes('secret')){add(new THREE.BoxGeometry(.95,.08,.65),this.material(0x3e3529),0,.85,0);const paper=add(new THREE.BoxGeometry(.48,.02,.35),this.material(kind.includes('secret')?0xb39b68:0xb9b99d),0,.91,0);paper.rotation.y=.15;for(let i=0;i<5;i++)add(new THREE.BoxGeometry(.3,.005,.012),this.material(0x4c4a38),0,.925,-.1+i*.045);}
    else if(kind.includes('puzzle')||kind.includes('panel')||kind.includes('question')){add(new THREE.BoxGeometry(.95,1.05,.55),this.material(index===3?0x63513a:0x334c45,.45),0,1,0);for(let i=0;i<3;i++){add(new THREE.CylinderGeometry(.07,.07,.08,12),this.material(0xadaa78,.6),-.26+i*.26,1.4,.3).rotation.x=Math.PI/2;}add(new THREE.BoxGeometry(.6,.25,.06),new THREE.MeshStandardMaterial({color:0x739f79,emissive:0x325b39,emissiveIntensity:.5}),0,1.08,.31);}
    else {add(new THREE.BoxGeometry(.65,.65,.65),this.material(0x3e3c2e),0,.325,0);if(label.includes('flashlight')){const torch=add(new THREE.CylinderGeometry(.08,.12,.45,12),this.material(0x363d33,.65),0,.76,0);torch.rotation.z=Math.PI/2;}else if(kind.includes('coin')||label.includes('coin')){const coin=add(new THREE.CylinderGeometry(.17,.17,.05,16),this.material(0xcda85c,.75),0,.72,0);coin.rotation.x=.3;}else{add(new THREE.BoxGeometry(.18,.28,.16),this.material(0xbaa875,.55),0,.82,0);}}
    // Amber glint and small readable label provide fair discoverability in darkness.
    const glow=new THREE.PointLight(kind.includes('secret')?0x829eaa:0xe6c98a,.6,2.2,2);glow.position.set(0,1.4,0);g.add(glow);
    const target=add(new THREE.BoxGeometry(.95,1.8,.8),new THREE.MeshBasicMaterial({visible:false}),0,.9,0);target.userData.interactId=obj.id;
    const labelY=(kind==='pickup'||kind==='secret'||kind==='note')?.73:1.8;const labelMesh=this.sign(obj.label.toUpperCase(),0,labelY,.42,Math.min(.85,.45+obj.label.length*.015),.1);g.add(labelMesh);
  }
  private makeDust(){const positions=new Float32Array(750*3);for(let i=0;i<750;i++){positions[i*3]=(Math.random()-.5)*28;positions[i*3+1]=Math.random()*4;positions[i*3+2]=(Math.random()-.5)*32-2;}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));const sprite=document.createElement('canvas');sprite.width=sprite.height=32;const ctx=sprite.getContext('2d')!;const gradient=ctx.createRadialGradient(16,16,0,16,16,16);gradient.addColorStop(0,'rgba(255,255,255,.8)');gradient.addColorStop(.3,'rgba(255,255,255,.3)');gradient.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,32,32);const texture=new THREE.CanvasTexture(sprite);this.mapTextures.push(texture);this.dust=new THREE.Points(geo,new THREE.PointsMaterial({color:0xc3c9ab,map:texture,size:.013,transparent:true,opacity:.22,depthWrite:false}));this.group.add(this.dust);}
  private makeHands(){
    const skin=new THREE.MeshStandardMaterial({color:0x977e69,roughness:.78,emissive:0x3b2820,emissiveIntensity:.08});
    const sleeve=this.material(0x252d2a);const cuff=this.material(0x181e1b);
    for(const side of [-1,1]){
      const y=side===1?-.33:-.43;
      const forearm=new THREE.Mesh(new THREE.CylinderGeometry(.055,.075,.42,14),sleeve);forearm.rotation.set(-.7,0,side*.14);forearm.position.set(side*.28,y-.15,-.4);this.arms.add(forearm);
      const wrist=new THREE.Mesh(new THREE.SphereGeometry(.058,12,10),cuff);wrist.scale.set(1,.7,1.1);wrist.position.set(side*.29,y+.005,-.52);this.arms.add(wrist);
      const palm=new THREE.Mesh(new THREE.SphereGeometry(.06,14,12),skin);palm.scale.set(.8,.58,1.12);palm.rotation.z=side*.2;palm.position.set(side*.29,y+.035,-.57);this.arms.add(palm);
      for(let i=0;i<4;i++){
        const knuckle=new THREE.Mesh(new THREE.SphereGeometry(.0135,8,8),skin);knuckle.position.set(side*.29-.033+i*.022,y+.065,-.6);this.arms.add(knuckle);
        const finger=new THREE.Mesh(new THREE.CapsuleGeometry(.011,.035,4,8),skin);finger.rotation.x=side===1?-.8:-.3;finger.position.set(side*.29-.033+i*.022,y+.043,-.625);this.arms.add(finger);
      }
      const thumb=new THREE.Mesh(new THREE.CapsuleGeometry(.017,.04,4,8),skin);thumb.rotation.set(.3,0,side*.6);thumb.position.set(side*.245,y+.06,-.57);this.arms.add(thumb);
    }
    const torchBody=new THREE.Mesh(new THREE.CylinderGeometry(.045,.04,.24,14),this.material(0x1c2621,.6));torchBody.rotation.x=Math.PI/2;this.torch.add(torchBody);
    const rim=new THREE.Mesh(new THREE.TorusGeometry(.046,.006,6,16),this.material(0x7c8070,.7));rim.position.z=-.123;this.torch.add(rim);
    const lens=new THREE.Mesh(new THREE.CircleGeometry(.041,16),new THREE.MeshBasicMaterial({color:0xe8f2cb}));lens.rotation.y=Math.PI;lens.position.z=-.13;this.torch.add(lens);this.torch.position.set(.29,-.255,-.61);this.arms.add(this.torch);this.camera.add(this.arms);
  }
  private makeEnemy(){const cloth=this.material(0x080b0b);const wax=this.material(0xaa9e76);const body=new THREE.Mesh(new THREE.ConeGeometry(.37,1.75,9),cloth);body.position.y=1.55;this.enemy.add(body);for(const side of [-1,1]){const leg=new THREE.Mesh(new THREE.CylinderGeometry(.07,.045,1.1,7),cloth);leg.position.set(side*.15,.55,0);this.enemy.add(leg);const arm=new THREE.Mesh(new THREE.CylinderGeometry(.06,.035,1.5,7),cloth);arm.position.set(side*.4,1.55,0);arm.rotation.z=side*.09;this.enemy.add(arm);const hand=new THREE.Mesh(new THREE.SphereGeometry(.07,6,7),wax);hand.scale.y=2;hand.position.set(side*.47,.8,0);this.enemy.add(hand);}
    this.enemyWax=new THREE.Mesh(new THREE.SphereGeometry(.23,12,14),wax);this.enemyWax.scale.set(.72,1.38,.8);this.enemyWax.position.set(0,2.68,0);this.enemy.add(this.enemyWax);
    for(const x of [-.073,.073]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.025,8,8),new THREE.MeshBasicMaterial({color:0xffe6ac}));eye.position.set(x,2.72,.165);this.enemy.add(eye);}
    for(let i=0;i<7;i++){const x=(i-3)*.13,y=2.15+Math.sin(i*3)*.25,z=i%2?.13:-.1;const candle=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,.35,7),wax);candle.position.set(x,y,z);this.enemy.add(candle);const flame=new THREE.Mesh(new THREE.SphereGeometry(.034,6,6),this.white);flame.position.set(x,y+.22,z);flame.scale.y=2;this.enemy.add(flame);this.enemyFlames.push(flame);const drip=new THREE.Mesh(new THREE.CylinderGeometry(.015,.007,.3+(i%3)*.1,5),wax);drip.position.set(x,y-.32,z);this.enemy.add(drip);}
    const glow=new THREE.PointLight(0xf58f42,3,7,1.6);glow.position.set(0,2.5,.4);glow.castShadow=true;glow.shadow.mapSize.set(512,512);this.enemy.add(glow);
    this.enemy.traverse(obj=>{if(obj instanceof THREE.Mesh){obj.castShadow=true;obj.receiveShadow=true;}});
    const apparition=this.enemy.clone();apparition.position.set(-10,0,-16);apparition.scale.setScalar(.85);this.hallucination.add(apparition);this.hallucination.visible=false;this.enemy.visible=false;
  }
}
