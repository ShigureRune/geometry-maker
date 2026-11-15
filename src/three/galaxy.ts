import {seededRandom} from '../scene';
import {generateGalaxyVariant} from './galaxy-generators/variants';
import {booleanField,enumField,numberField,record} from './style-settings';

export const GALAXY_PALETTES=['violet','blue','rose','gold'] as const;
export const GALAXY_TYPES=['grand_design','barred_spiral','flocculent','ring','elliptical','irregular','interacting'] as const;
export type GalaxyType=typeof GALAXY_TYPES[number];
export const GALAXY_TYPE_LABELS:Record<GalaxyType,string>={
  grand_design:'グランドデザイン渦巻銀河',
  barred_spiral:'棒渦巻銀河',
  flocculent:'フロキュレント銀河',
  ring:'リング銀河',
  elliptical:'楕円銀河',
  irregular:'不規則銀河',
  interacting:'相互作用銀河',
};
export type GalaxyPalette=typeof GALAXY_PALETTES[number];
export type GalaxySettings={
  enabled:boolean;count:number;arms:number;twist:number;radius:number;
  coreGlow:number;dust:number;rotationSpeed:number;palette:GalaxyPalette;
  seedTransition:boolean;transitionSeconds:number;
  armWidth:number;inclination:number;barred:boolean;darkBackground:boolean;
  galaxyType:GalaxyType;
  ringRadius:number;ringWidth:number;ellipticity:number;
  clumpiness:number;branchiness:number;irregularity:number;
  companionDistance:number;companionSize:number;tidalStrength:number;
};
export const galaxyDefaults:GalaxySettings={
  enabled:false,count:12000,arms:2,twist:1.5,radius:5.5,
  coreGlow:75,dust:35,rotationSpeed:.6,palette:'violet',
  seedTransition:true,transitionSeconds:3.5,
  armWidth:1.25,inclination:23,barred:false,darkBackground:true,
  galaxyType:'grand_design',ringRadius:.64,ringWidth:.12,ellipticity:.42,
  clumpiness:.68,branchiness:.55,irregularity:.7,
  companionDistance:.9,companionSize:.45,tidalStrength:.65,
};
export const GALAXY_LOW_STAR_LIMIT=3600,GALAXY_HIGH_STAR_LIMIT=30000;
export function validateGalaxySettings(value:unknown):GalaxySettings{
  const d={...galaxyDefaults,...record(value)};
  return {
    enabled:booleanField(d.enabled,'銀河モード'),
    count:numberField(d.count,1000,GALAXY_HIGH_STAR_LIMIT,'星の数',true),
    arms:numberField(d.arms,2,8,'銀河腕',true),
    twist:numberField(d.twist,.4,4,'螺旋の巻き込み'),
    radius:numberField(d.radius,3,10,'銀河の広がり'),
    coreGlow:numberField(d.coreGlow,0,200,'中心核の明るさ'),
    dust:numberField(d.dust,0,60,'ダストの割合',true),
    rotationSpeed:numberField(d.rotationSpeed,0,2,'銀河の回転'),
    palette:enumField(d.palette,GALAXY_PALETTES,'銀河の配色'),
    seedTransition:booleanField(d.seedTransition,'銀河のシード切替演出'),
    transitionSeconds:numberField(d.transitionSeconds,.5,15,'銀河の切替時間'),
    armWidth:numberField(d.armWidth,.5,2.5,'螺旋腕の太さ'),
    inclination:numberField(d.inclination,0,75,'銀河円盤の傾き'),
    barred:booleanField(d.barred,'棒状渦巻銀河'),
    darkBackground:booleanField(d.darkBackground,'暗い宇宙背景'),
    galaxyType:enumField(d.galaxyType,GALAXY_TYPES,'銀河タイプ'),
    ringRadius:numberField(d.ringRadius,.35,.90,'リング半径'),
    ringWidth:numberField(d.ringWidth,.04,.30,'リングの幅'),
    ellipticity:numberField(d.ellipticity,.05,.85,'楕円率'),
    clumpiness:numberField(d.clumpiness,0,1,'星団のまとまり'),
    branchiness:numberField(d.branchiness,0,1,'腕の枝分かれ'),
    irregularity:numberField(d.irregularity,0,1,'不規則さ'),
    companionDistance:numberField(d.companionDistance,.5,1.3,'伴銀河の距離'),
    companionSize:numberField(d.companionSize,.25,.70,'伴銀河のサイズ'),
    tidalStrength:numberField(d.tidalStrength,0,1,'潮汐の尾'),
  };
}
export type GalaxyData={
  count:number;positions:Float32Array;colors:Float32Array;
  sizes:Float32Array;spins:Float32Array;phases:Float32Array;
  cores:Float32Array;opacities:Float32Array;kinds:Float32Array;
};
type RGB=readonly [number,number,number];
type Palette={bulge:RGB;disk:RGB;arm:RGB;young:RGB;hii:RGB;cloud:RGB};
function hexColor(value:string):RGB{
  return [1,3,5].map(k=>parseInt(value.slice(k,k+2),16)/255) as unknown as RGB;
}
function palette(bulge:string,disk:string,arm:string,young:string,hii:string,cloud:string):Palette{
  return {bulge:hexColor(bulge),disk:hexColor(disk),arm:hexColor(arm),
    young:hexColor(young),hii:hexColor(hii),cloud:hexColor(cloud)};
}
/** Old yellow stars in the bulge, a diffuse stellar disk and blue/pink star-forming arms. */
const PALETTES:Record<GalaxyPalette,Palette>={
  violet:palette('#ffd9a0','#d1b9b4','#9b9bdf','#8cbbff','#f68db4','#8973b3'),
  blue:palette('#ffe6b4','#c8d4df','#8bbce9','#76d9ff','#ff9ac9','#7eacd7'),
  rose:palette('#ffe0ac','#dfb8bd','#d39cce','#b6b5ff','#ff7eac','#a984a7'),
  gold:palette('#ffe0a6','#d5b49b','#e1ba9d','#c8ddff','#ffafc0','#b79581'),
};
function blend(a:RGB,b:RGB,t:number):RGB{
  const f=Math.max(0,Math.min(1,t));
  return [a[0]*(1-f)+b[0]*f,a[1]*(1-f)+b[1]*f,a[2]*(1-f)+b[2]*f];
}
function gaussian(random:()=>number):number {
  return random()+random()+random()+random()-2;
}
function wrapAngle(a:number):number{
  return Math.atan2(Math.sin(a),Math.cos(a));
}
const TAU=Math.PI*2;

/** Match the first two random draws used by generateGalaxy.
 * The diffuse light follows the SAME spiral orientation as the star particles. */
export function galaxyAppearance(seed:string,theme:GalaxyPalette){
  const random=seededRandom('galaxy-realism-v2:'+seed);
  return {orientation:random()*TAU,handed:random()<.5?-1:1,
    colors:PALETTES[theme]};
}

/** Logarithmic arms inspired by Hubble's grand-design spirals, with
 * an exponential old-star disk, compact bulge, blue knots and dusty lanes.
 * This is an artistic structural model, not a physical N-body simulation. */
export function generateGalaxy(seed:string,options:GalaxySettings,low:boolean):GalaxyData{
  if(options.galaxyType!=='grand_design'&&options.galaxyType!=='barred_spiral')
    return generateGalaxyVariant(seed,options,low);
  // Existing grand-design generation remains unchanged for saved v3 scenes.
  // The barred type forces a bar even if the old manual checkbox was disabled.
  if(options.galaxyType==='barred_spiral'&&!options.barred)
    options={...options,barred:true};
  const count=Math.min(options.count,low?GALAXY_LOW_STAR_LIMIT:GALAXY_HIGH_STAR_LIMIT);
  const positions=new Float32Array(count*3),colors=new Float32Array(count*3);
  const sizes=new Float32Array(count),spins=new Float32Array(count);
  const phases=new Float32Array(count),cores=new Float32Array(count);
  const opacities=new Float32Array(count),kinds=new Float32Array(count);
  const random=seededRandom('galaxy-realism-v2:'+seed);
  const colorset=PALETTES[options.palette],R=options.radius;
  const orientation=random()*TAU,handed=random()<.5?-1:1;
  const barStart=options.barred?.25:.145;
  // About half-to-one turn from the inner disk to the outskirts: avoids
  // the tightly wound near-concentric rings of the v1 model.
  function armAngle(normalizedRadius:number,arm:number):number{
    const radius=Math.max(barStart,normalizedRadius);
    const winding=handed*(1.65+options.twist*.35)*Math.log(radius/barStart);
    const feather=.065*Math.sin(radius*19+arm*3.4+orientation)+
      .027*Math.sin(radius*44+arm*2.7);
    return orientation+TAU*arm/options.arms+winding+feather;
  }
  type Knot={x:number;y:number;r:number;arm:number;pink:boolean};
  const knots:Knot[]=Array.from({length:Math.max(16,options.arms*18)},(_,k)=>{
    const arm=k%options.arms,r=.19+random()*.75;
    const angle=armAngle(r,arm);
    return {x:Math.cos(angle)*r*R,y:Math.sin(angle)*r*R,r,
      arm,pink:random()<.46};
  });
  // A broad disk remains visible BETWEEN the arms. Real spirals are not
  // thin strings of stars separated by completely empty black space.
  const bulgeEnd=Math.floor(count*.105);
  const diskEnd=bulgeEnd+Math.floor(count*.305);
  const knotEnd=diskEnd+Math.floor(count*.12);
  const cloudCount=Math.floor(count*(.025+options.dust/60*.055));
  const armEnd=count-cloudCount;
  for(let i=0;i<count;i++){
    const bulge=i<bulgeEnd,disk=i>=bulgeEnd&&i<diskEnd;
    const knotStar=i>=diskEnd&&i<knotEnd;
    const nebula=i>=armEnd;
    const armStar=!bulge&&!disk&&!knotStar&&!nebula;
    let x=0,y=0,z=0,radial=0;
    let pigment:RGB=colorset.disk,lum=.5,opacity=.65,size=1.0;
    let kind=0,coreStrength=0;
    if(bulge){
      const r=Math.sqrt(random())*R*.215,angle=random()*TAU;
      x=r*Math.cos(angle);y=r*Math.sin(angle);
      if(options.barred){
        const bx=x*(options.galaxyType==='barred_spiral'?2.5:1.65),by=y*.48;
        x=bx*Math.cos(orientation)-by*Math.sin(orientation);
        y=bx*Math.sin(orientation)+by*Math.cos(orientation);
      }
      radial=Math.hypot(x,y)/R;
      z=gaussian(random)*R*.055;
      pigment=blend(colorset.bulge,colorset.disk,Math.min(1,radial/.28));
      lum=.37+random()*.42;
      opacity=.30+random()*.35;
      size=.65+random()*.9;
      coreStrength=Math.pow(Math.max(0,1-radial/.29),2);
    }else if(disk){
      // Gamma radial profile approximates an exponential stellar disk.
      const rr=R*.25*(-Math.log(Math.max(1e-6,random()*random())));
      const r=Math.min(R*1.07,rr);
      const angle=random()*TAU;
      x=r*Math.cos(angle);y=r*Math.sin(angle);
      radial=Math.min(1.15,r/R);
      z=gaussian(random)*R*.018;
      pigment=blend(colorset.disk,colorset.arm,Math.min(1,radial*.60));
      lum=.20+random()*.52;
      opacity=.18+random()*.36;
      size=.52+random()*.85;
    }else if(knotStar||nebula){
      // Coherent clumps: a cluster is many local points around ONE
      // selected arm location, not a uniform confetti of bright pink dots.
      const center=knots[Math.floor(random()*knots.length)];
      const scale=R*(nebula?.045:.017)*(0.65+center.r*.65);
      x=center.x+gaussian(random)*scale;
      y=center.y+gaussian(random)*scale;
      radial=Math.min(1.2,Math.hypot(x,y)/R);
      z=gaussian(random)*R*.014;
      const pink=center.pink;
      pigment=blend(pink?colorset.hii:colorset.young,colorset.arm,nebula?.35:random()*.24);
      lum=nebula?.15+random()*.24:.58+random()*.60;
      opacity=nebula?.09+random()*.15:.45+random()*.43;
      size=nebula?8+random()*12:.8+random()*1.9;
      kind=nebula?1:0;
    }else if(armStar){
      const arm=i%options.arms;
      const radialFraction=.15+.84*Math.sqrt(random());
      radial=radialFraction;
      const center=armAngle(radialFraction,arm);
      const width=(.095+radialFraction*.205)*options.armWidth;
      let angle=center+gaussian(random)*width*.72;
      // Feathery secondary arm segments and spurs, not regular rings.
      if(random()<.29)angle+=handed*(.17+.19*radialFraction);
      const r=R*radialFraction+(random()-.5)*R*.012;
      x=Math.cos(angle)*r;
      y=Math.sin(angle)*r;
      z=gaussian(random)*R*(.010+.012*radialFraction);
      pigment=blend(colorset.arm,colorset.young,.24+random()*.65);
      if(random()<.19)pigment=blend(pigment,colorset.disk,.24+random()*.32);
      lum=.40+random()*.68;
      opacity=.37+random()*.43;
      size=.55+random()*1.2;
    }
    // Dust lanes: attenuate stellar light in narrow, curved strips along
    // the leading side of each arm. Additive particle rendering cannot
    // paint true dark occlusion, so this models the *density/brightness*
    // contrast of the obscuring lane without fake black particles.
    if(!nebula&&!bulge&&radial>.17&&options.dust>0){
      const angle=Math.atan2(y,x);
      let distance=Infinity;
      for(let arm=0;arm<options.arms;arm++){
        const lane=armAngle(radial,arm)+handed*(.095+.025*radial);
        distance=Math.min(distance,Math.abs(wrapAngle(angle-lane)));
      }
      const width=(.030+.028*radial)*options.armWidth;
      const shade=Math.exp(-Math.pow(distance/width,2))*
        (.25+.65*options.dust/60);
      opacity*=1-shade;
      lum*=1-shade*.28;
    }
    // A few brighter blue-white foreground stars, but avoid a giant
    // saturated white central sphere.
    if(!bulge&&!nebula&&random()<.012){
      size*=1.8;lum*=1.22;
    }
    const p=i*3;
    positions[p]=x;positions[p+1]=y;positions[p+2]=z;
    const brightness=Math.min(1.4,lum);
    colors[p]=pigment[0]*brightness;
    colors[p+1]=pigment[1]*brightness;
    colors[p+2]=pigment[2]*brightness;
    sizes[i]=size;
    opacities[i]=opacity;
    kinds[i]=kind;
    cores[i]=coreStrength;
    spins[i]=handed*(.025+.08/(.40+radial*1.5));
    phases[i]=random()*TAU;
  }
  return {count,positions,colors,sizes,spins,phases,cores,opacities,kinds};
}
export function galaxyMorphEasing(value:number):number{
  const t=Math.max(0,Math.min(1,value));
  return t*t*(3-2*t);
}
