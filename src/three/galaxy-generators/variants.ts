import {seededRandom} from '../../scene';
import type {GalaxyData,GalaxySettings,GalaxyType} from '../galaxy';

type Random=()=>number;
type Point={x:number;y:number;z:number;radius:number;core:boolean;cloud:boolean;young:boolean;pink?:boolean};
type RGB=readonly [number,number,number];
const TAU=Math.PI*2;
const COLORS:Record<GalaxySettings['palette'],{old:RGB,disk:RGB,young:RGB,hii:RGB}>={
  violet:{old:[1,.80,.54],disk:[.72,.68,.85],young:[.53,.70,1],hii:[1,.52,.72]},
  blue:{old:[1,.85,.65],disk:[.65,.77,.94],young:[.42,.86,1],hii:[1,.56,.77]},
  rose:{old:[1,.81,.59],disk:[.84,.69,.80],young:[.68,.70,1],hii:[1,.49,.68]},
  gold:{old:[1,.86,.63],disk:[.84,.72,.64],young:[.73,.85,1],hii:[1,.68,.74]},
};
const gaussian=(random:Random)=>random()+random()+random()+random()-2;
const mix=(a:number,b:number,t:number)=>a*(1-t)+b*t;
const soft=(t:number)=>Math.max(0,Math.min(1,t));
function centerPoint(random:Random,R:number,scale:number):Point{
  const radius=R*scale*Math.sqrt(random()),a=random()*TAU;
  return {x:radius*Math.cos(a),y:radius*Math.sin(a),z:gaussian(random)*R*.025,
    radius:radius/R,core:true,cloud:false,young:false};
}
function spinPoint(random:Random,R:number,arms:number,twist:number,width:number,
  orientation:number,handed:number,barred:boolean):Point{
  const radius=.16+.83*Math.sqrt(random());
  const arm=Math.floor(random()*arms),r0=barred?.25:.145;
  const angle=orientation+TAU*arm/arms+
    handed*(1.65+twist*.35)*Math.log(Math.max(radius,r0)/r0)+
    gaussian(random)*(.095+radius*.205)*width*.60;
  const r=radius*R;
  return {x:r*Math.cos(angle),y:r*Math.sin(angle),z:gaussian(random)*R*.018,
    radius,core:false,cloud:false,young:true};
}
function ellipsePoint(random:Random,options:GalaxySettings):Point{
  const R=options.radius;
  // Concentrated inner population, with an extended old-star envelope.
  const r=Math.min(1.08,Math.pow(random(),1.55))*R;
  const a=random()*TAU,phi=Math.acos(2*random()-1);
  const flat=1-options.ellipticity*.78;
  const x=r*Math.sin(phi)*Math.cos(a);
  const y=r*Math.sin(phi)*Math.sin(a)*flat;
  const z=r*Math.cos(phi)*(.34+flat*.34);
  return {x,y,z,radius:r/R,core:r/R<.21,cloud:false,young:false};
}
function ringPoint(random:Random,options:GalaxySettings,index:number,count:number):Point{
  const R=options.radius;
  if(index<count*.075)return centerPoint(random,R,.12);
  const broad=index<count*.19;
  const r=broad?R*(.15+random()*.89):
    R*Math.max(.14,Math.min(1.16,options.ringRadius+gaussian(random)*options.ringWidth*.52));
  let angle=random()*TAU;
  if(!broad&&random()<.28){
    const knot=Math.floor(random()*11);
    angle=knot*TAU/11+gaussian(random)*.08;
  }
  return {x:r*Math.cos(angle),y:r*Math.sin(angle),z:gaussian(random)*R*.013,
    radius:r/R,core:false,cloud:!broad&&random()<.035,young:!broad&&random()<.53};
}
function flocculentPoint(random:Random,options:GalaxySettings,index:number,count:number,
  knots:Point[],orientation:number,handed:number):Point{
  const R=options.radius;
  if(index<count*.10)return centerPoint(random,R,.17);
  if(index<count*.32){
    const r=R*Math.min(1.02,-Math.log(Math.max(.00001,random()*random()))*.22);
    const a=random()*TAU;
    return {x:r*Math.cos(a),y:r*Math.sin(a),z:gaussian(random)*R*.025,
      radius:r/R,core:false,cloud:false,young:false};
  }
  const knot=knots[Math.floor(random()*knots.length)];
  const spread=R*(.017+(1-options.clumpiness)*.055);
  const phase=random()*TAU,armLength=R*(.04+options.branchiness*.23);
  const t=gaussian(random)*.50;
  const dx=handed*Math.cos(phase+orientation)*armLength*t;
  const dy=handed*Math.sin(phase+orientation)*armLength*t;
  const x=knot.x+gaussian(random)*spread+dx,y=knot.y+gaussian(random)*spread+dy;
  return {x,y,z:gaussian(random)*R*.020,radius:Math.hypot(x,y)/R,
    core:false,cloud:random()<.065,young:true,pink:random()<.18};
}
function irregularPoint(random:Random,options:GalaxySettings,index:number,count:number,
  knots:Point[]):Point{
  const R=options.radius;
  const center=knots[Math.floor(random()*knots.length)];
  const t=gaussian(random),s=R*(.04+options.irregularity*.12);
  const x=center.x+t*s,y=center.y+gaussian(random)*s*.75;
  return {x,y,z:gaussian(random)*R*.047,radius:Math.hypot(x,y)/R,
    core:index<count*.08&&random()<.5,cloud:random()<.15,young:random()<.58,pink:random()<.27};
}
function interactingPoint(random:Random,options:GalaxySettings,index:number,count:number,
  orientation:number,handed:number):Point{
  const R=options.radius;
  const companionStart=Math.floor(count*.68),tailStart=Math.floor(count*.90);
  const gap=options.companionDistance;
  const mainCenter=-R*gap*.36,secondCenter=R*gap*.60;
  if(index>=tailStart){
    // A separate tidal stream, not random field stars.
    const t=random(),which=index%2;
    const a=which?1.0:-1.0;
    const center=which?secondCenter:mainCenter;
    const r=R*mix(which?options.companionSize*.15:.28,1.15,t);
    const angle=a*(.45+2.1*t)+orientation*.38;
    return {x:center+Math.cos(angle)*r+gaussian(random)*R*.032,
      y:(which?.16:-.15)*R+Math.sin(angle)*r*(.38+options.tidalStrength*.35)+gaussian(random)*R*.032,
      z:gaussian(random)*R*.014,radius:t,core:false,cloud:false,young:random()<.5};
  }
  const companion=index>=companionStart;
  const local=spinPoint(random,R,2,options.twist,options.armWidth,
    orientation+(companion?2.35:0),companion?-handed:handed,!companion&&options.barred);
  const s=companion?options.companionSize:.67;
  local.x=local.x*s+(companion?secondCenter:mainCenter);
  local.y=local.y*s+(companion?R*.10:-R*.12);
  local.z*=s;
  const inner=local.radius<.22;
  local.core=inner&&random()<.55;
  local.young=!local.core;
  local.cloud=!local.core&&random()<.035;
  // Interacting tidal pull stretches the outer stars toward the companion.
  if(!companion&&local.radius>.65){
    const tug=(local.radius-.65)*options.tidalStrength*.23*R;
    local.x+=tug;local.y+=tug*(handed>0?1:-1);
  }
  return local;
}

/** Distinct deterministic spatial distributions, with the same output arrays
 * as the original spiral renderer. All types share the same star budget. */
export function generateGalaxyVariant(seed:string,options:GalaxySettings,low:boolean):GalaxyData{
  const count=Math.min(options.count,low?3600:30000),R=options.radius;
  const positions=new Float32Array(count*3),colors=new Float32Array(count*3);
  const sizes=new Float32Array(count),spins=new Float32Array(count);
  const phases=new Float32Array(count),cores=new Float32Array(count);
  const opacities=new Float32Array(count),kinds=new Float32Array(count);
  const type=options.galaxyType as GalaxyType;
  const original=seededRandom('galaxy-realism-v2:'+seed);
  const orientation=original()*TAU,handed=original()<.5?-1:1;
  const random=seededRandom('galaxy-variants-v4:'+seed+':'+type);
  const shades=COLORS[options.palette];
  const clusters=type==='irregular'?Array.from({length:Math.max(7,Math.round(7+options.irregularity*15))},()=>{
    const x=(random()-.5)*R*1.55,y=(random()-.5)*R*1.10;
    return {x,y,z:0,radius:Math.hypot(x,y)/R,core:false,cloud:false,young:true};
  }):type==='flocculent'?Array.from({length:Math.max(10,Math.round(12+options.branchiness*30))},()=>{
    const p=spinPoint(random,R,options.arms,options.twist,1.6,orientation,handed,false);
    return p;
  }):[];
  for(let i=0;i<count;i++){
    let p:Point;
    if(type==='ring')p=ringPoint(random,options,i,count);
    else if(type==='elliptical')p=ellipsePoint(random,options);
    else if(type==='flocculent')p=flocculentPoint(random,options,i,count,clusters,orientation,handed);
    else if(type==='irregular')p=irregularPoint(random,options,i,count,clusters);
    else if(type==='interacting')p=interactingPoint(random,options,i,count,orientation,handed);
    else p=spinPoint(random,R,options.arms,options.twist,options.armWidth,orientation,handed,true);
    const j=i*3;
    positions[j]=p.x;positions[j+1]=p.y;positions[j+2]=p.z;
    const color=p.core?shades.old:p.pink?shades.hii:
      p.young?shades.young:shades.disk;
    const luminosity=p.core ? .70+random()*.40 : p.cloud ? .27+random()*.22 : .46+random()*.75;
    colors[j]=Math.min(1.35,color[0]*luminosity);
    colors[j+1]=Math.min(1.35,color[1]*luminosity);
    colors[j+2]=Math.min(1.35,color[2]*luminosity);
    sizes[i]=p.cloud?7+random()*12:.6+random()*(p.core?1.1:1.8);
    opacities[i]=p.cloud?.12+random()*.17:.35+random()*.57;
    kinds[i]=p.cloud?1:0;
    cores[i]=p.core?Math.max(.12,Math.pow(Math.max(0,1-p.radius/.25),2)):0;
    spins[i]=handed*(.022+.055/(.5+p.radius*1.2))*(type==='elliptical'?.22:1);
    phases[i]=random()*TAU;
  }
  return {count,positions,colors,sizes,spins,phases,cores,opacities,kinds};
}
