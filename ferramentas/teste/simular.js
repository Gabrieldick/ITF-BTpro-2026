const fs=require('fs'), vm=require('vm');
const [,,file,diff,bot]=process.argv;
let src=fs.readFileSync(file,'utf8');
// state exposed via window.__pdo
// dummy proxy
const dummy=new Proxy(function(){}, {get:(t,k)=>k===Symbol.toPrimitive?()=>0:(k==='getMaxAnisotropy'?()=>1:dummy), set:()=>true, apply:()=>dummy, construct:()=>dummy});
class V3{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}set(x,y,z){this.x=x;this.y=y;this.z=z;return this}copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this}clone(){return new V3(this.x,this.y,this.z)}add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this}sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this}multiplyScalar(s){this.x*=s;this.y*=s;this.z*=s;return this}addScaledVector(v,s){this.x+=v.x*s;this.y+=v.y*s;this.z+=v.z*s;return this}length(){return Math.hypot(this.x,this.y,this.z)}normalize(){const l=this.length()||1;return this.multiplyScalar(1/l)}distanceTo(v){return Math.hypot(this.x-v.x,this.y-v.y,this.z-v.z)}lerp(v,a){this.x+=(v.x-this.x)*a;this.y+=(v.y-this.y)*a;this.z+=(v.z-this.z)*a;return this}subVectors(a,b){return this.set(a.x-b.x,a.y-b.y,a.z-b.z)}crossVectors(a,b){return this.set(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x)}dot(v){return this.x*v.x+this.y*v.y+this.z*v.z}lengthSq(){return this.dot(this)}fromArray(a){return this.set(a[0],a[1],a[2])}negate(){return this.multiplyScalar(-1)}project(){return this}applyQuaternion(){return this}}
const THREE=new Proxy({Vector3:V3},{get:(t,k)=>k in t?t[k]:dummy});
function mkEl(id){const e={id,hidden:false,textContent:'',innerHTML:'',style:{setProperty(){}},dataset:{},checked:true,value:'',classList:{s:new Set(),add(c){this.s.add(c)},remove(c){this.s.delete(c)},toggle(c,v){if(v===undefined)v=!this.s.has(c);v?this.s.add(c):this.s.delete(c)},contains(c){return this.s.has(c)}},addEventListener(){},append(){},appendChild(){},querySelector(){return mkEl("q")},querySelectorAll(){return []},focus(){},blur(){},setPointerCapture(){},getBoundingClientRect(){return{left:0,top:0,width:100,height:100}},firstChild:{textContent:''}};return e}
const els={};const getEl=id=>els[id]||(els[id]=mkEl(id));
const shots=['smash','lob','curta','defesa'].map(s=>{const e=mkEl('shot-'+s);e.dataset.shot=s;return e});
const listeners={};let now=0;let raf=null;
const document={getElementById:getEl,querySelectorAll:()=>shots,querySelector:(q)=>{if(!q.startsWith("input"))return getEl(q);const m=q.match(/name=(\w+)/);const v={pick:undefined,players:'3d',racket:'proteo',mode:process.argv[5]||'simples',cam:'3p',diff:diff||'medio',len:'4',gfx:'alto'}[m&&m[1]];return {value:v,checked:true}},createElement:()=>({getContext:()=>dummy,width:0,height:0,append(){},style:{}}),body:mkEl('body'),addEventListener(){},hidden:false};
const sb={THREE,document,window:null,performance:{now:()=>now},requestAnimationFrame:f=>{raf=f},setTimeout:(f)=>0,clearTimeout(){},innerWidth:1280,innerHeight:800,devicePixelRatio:1,matchMedia:()=>({matches:false}),localStorage:{getItem:()=>null,setItem(){}},addEventListener:(t,f)=>{(listeners[t]=listeners[t]||[]).push(f)},KeyboardEvent:function(){},console,Math,JSON,Object,Array,Set,Float32Array,Symbol,Number};
sb.window=sb;vm.createContext(sb);
sb.THREE_GLTF={GLTFLoader:dummy}; sb.THREE_SKEL=dummy; vm.runInContext(src,sb);
const key=k=>{(listeners.keydown||[]).forEach(f=>f({key:k,repeat:false,preventDefault(){}}));(listeners.keyup||[]).forEach(f=>f({key:k}))};
setTimeout(()=>{getEl('menu').hidden=false;
// start match: call btnPlay handler -> we can't (stub addEventListener). emulate Enter key on menu
key('Enter');
const S=sb.__pdo.S,ball=sb.__pdo.ball,H=sb.__pdo.human;
const meterSeen={};const serverLog=[];const reasons={};let lastHit=0;const hits={};let lastMode='',rallies=[];let pts=0;let lastBanner='';
const kd=k=>(listeners.keydown||[]).forEach(f=>f({key:k,repeat:false,preventDefault(){}}));const ku=k=>(listeners.keyup||[]).forEach(f=>f({key:k}));
let pend=[];const res={perfeito:0,cedo:0,tarde:0};let lastRes='';
for(let f=0;f<60*60*20 && S.mode!=='over';f++){
  now+=1000/60; raf(now);
  pend=pend.filter(x=>{if(--x.n<=0){ku(x.k);return false}return true});
  if(S.mode==='serve'&&S.serverPlayer===H&&!pend.length&&Math.random()<0.03){const k=['j','k','l',' '][Math.floor(Math.random()*4)];kd(k);pend.push({k,n:Math.round(36+ (Math.random()-.5)*14)});}
  if(bot!=='idle'&&S.mode==='rally'&&ball.state==='live'&&S.lastTeam===1&&H.swing.t<0&&!H.charging&&!pend.length){
    const d=Math.hypot(ball.pos.x-H.pos.x,ball.pos.z-H.pos.z);
    if(ball.pos.y>=2.3&&d<3.2&&ball.pos.z>0.05){kd('j');pend.push({k:'j',n:Math.round(30+Math.random()*16)});}
    else if(d<1.5 && ball.pos.z>0.05 && ball.pos.y<2.9){ key(['k','l',' '][Math.floor(Math.random()*3)]); }
  }
  const mr=getEl('meter');
  if(S.mode==='dead'&&lastMode!=='dead'){ const t=getEl('bTitle').textContent+' / '+getEl('bSub').textContent; reasons[t.replace(/ · games.*/,'')]=(reasons[t.replace(/ · games.*/,'')]||0)+1; rallies.push(S.rally); pts++; {const P=sb.__pdo;const cp=[P.cpuA,P.cpuB].map(p=>({wm:p.ai.willMiss,sw:p.ai.swung,lg:p.ai.letGo,z:+p.pos.z.toFixed(1),x:+p.pos.x.toFixed(1)}));serverLog.push({srv:S.server, r:S.rally, lt:S.lastTeam, why:t, cp, bx:+ball.pos.x.toFixed(1), bz:+ball.pos.z.toFixed(1)});} }
  if(S.hitId!==lastHit){lastHit=S.hitId;const P=sb.__pdo;let b=null,bd=9;for(const p of [P.human,P.partner,P.cpuA,P.cpuB]){if(p.team!==S.lastTeam)continue;const d=Math.hypot(p.pos.x-ball.pos.x,p.pos.z-ball.pos.z);if(d<bd){bd=d;b=p}}if(b)hits[b.name]=(hits[b.name]||0)+1;}
  lastMode=S.mode;
}
console.log(JSON.stringify({serverLog,meterClasses:meterSeen,hits,mode:S.mode,score:S.score,stats:S.stats,pts,avgRally:(rallies.reduce((a,b)=>a+b,0)/rallies.length).toFixed(2),rallyHist:rallies.slice(0,40).join(','),reasons},null,1));

},0);
