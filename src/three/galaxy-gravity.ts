import type {GalaxySettings} from './galaxy';

/**
 * Interactive massless tracers in a softened stellar-bulge + dark-matter-halo
 * potential. This is a genuine numerical leapfrog gravity integration, NOT a
 * full N-body solver: stars do not attract one another. Interacting galaxies
 * use two fixed mass centers and each tracer feels both potentials.
 */
export type GravityTracers={
  positions:Float32Array;
  spins:Float32Array;
  orbitCenters?:Float32Array;
};
export type GravityAttractor={
  x:number;y:number;mass:number;halo:number;
};
export type GalaxyGravitySimulation={
  positions:Float32Array;
  velocities:Float32Array;
  attractors:readonly GravityAttractor[];
  time:number;
  steps:number;
  advance:(clock:number,strength:number,halo:number,rotationSpeed:number)=>boolean;
  reset:()=>void;
  meanDrift:()=>number;
};

export function galaxyGravityAttractors(
  tracers:GravityTracers,options:GalaxySettings,
):GravityAttractor[]{
  const centers=new Map<string,{x:number;y:number;count:number}>();
  const pivots=tracers.orbitCenters;
  if(pivots){
    for(let i=0;i<pivots.length;i+=2){
      const x=pivots[i],y=pivots[i+1];
      const key=x.toFixed(4)+','+y.toFixed(4);
      const found=centers.get(key);
      if(found)found.count++;
      else centers.set(key,{x,y,count:1});
    }
  }
  if(!centers.size)centers.set('0,0',{x:0,y:0,count:1});
  const sorted=[...centers.values()].sort((a,b)=>b.count-a.count)
    .slice(0,options.galaxyType==='interacting'?2:1);
  const radius=options.radius;
  const baseSpeed=radius*.085;
  const defaultMass=baseSpeed*baseSpeed*radius*.36;
  const defaultHalo=baseSpeed*baseSpeed*.76;
  return sorted.map((center,index)=>{
    const companion=options.galaxyType==='interacting'&&index===1;
    const share=companion?Math.max(.12,options.companionSize**2):1;
    return {x:center.x,y:center.y,mass:defaultMass*share,
      halo:defaultHalo*share};
  });
}

export function createGalaxyGravitySimulation(
  tracers:GravityTracers,options:GalaxySettings,
):GalaxyGravitySimulation{
  const initial=new Float32Array(tracers.positions);
  const positions=new Float32Array(initial);
  const velocities=new Float32Array(initial.length);
  const acceleration=new Float32Array(initial.length);
  const count=Math.floor(initial.length/3);
  const centers=galaxyGravityAttractors(tracers,options);
  const eps2=(options.radius*.14)**2;
  const haloCore2=(options.radius*.30)**2;
  const orbitCenters=tracers.orbitCenters;
  // Initialize a physically supported near-circular orbital velocity in the
  // *same trailing direction* as the existing analytic galaxy animation.
  // Slight deterministic epicycles make the gravity effect visible over time.
  for(let i=0;i<count;i++){
    const j=i*3,k=i*2;
    const x=initial[j],y=initial[j+1],z=initial[j+2];
    const cx=orbitCenters?.[k]??0,cy=orbitCenters?.[k+1]??0;
    const dx=x-cx,dy=y-cy,r=Math.max(options.radius*.035,Math.hypot(dx,dy));
    const own=centers.reduce((best,center)=>
      Math.hypot(cx-center.x,cy-center.y)<
        Math.hypot(cx-best.x,cy-best.y)?center:best,centers[0]);
    const r2=r*r;
    const v2=own.mass*r2/Math.pow(r2+eps2,1.5)+
      own.halo*r2/(r2+haloCore2);
    const speed=Math.sqrt(Math.max(0,v2))*
      (1+.07*Math.sin(i*1.733+z*3.17));
    const sign=Math.sign(tracers.spins[i]||1);
    const radial=.026*Math.cos(i*2.11+z);
    velocities[j]=-sign*dy/r*speed+radial*dx/r*speed;
    velocities[j+1]=sign*dx/r*speed+radial*dy/r*speed;
    velocities[j+2]=-.02*z;
  }
  function accelerationAt(strength:number,haloWeight:number){
    for(let i=0;i<count;i++){
      const p=i*3,x=positions[p],y=positions[p+1],z=positions[p+2];
      let ax=0,ay=0,az=0;
      for(const center of centers){
        const dx=x-center.x,dy=y-center.y;
        const dist2=dx*dx+dy*dy+z*z;
        const stellar=center.mass/Math.pow(dist2+eps2,1.5);
        const halo=center.halo*haloWeight/(dist2+haloCore2);
        const factor=-(stellar+halo)*strength;
        ax+=dx*factor;ay+=dy*factor;
        // Halo confines the Z thickness but does not flatten stars to a 2D plane.
        az+=z*(factor*.8);
      }
      acceleration[p]=ax;acceleration[p+1]=ay;acceleration[p+2]=az;
    }
  }
  let previousClock:number|null=null;
  let elapsed=0,steps=0;
  function reset(){
    positions.set(initial);
    previousClock=null;
    elapsed=0;steps=0;
  }
  function advance(clock:number,strength:number,halo:number,rotationSpeed:number){
    if(!Number.isFinite(clock))return false;
    if(previousClock===null){previousClock=clock;return false;}
    if(clock<previousClock-1e-5){reset();previousClock=clock;return true;}
    const dt=Math.min(.18,Math.max(0,clock-previousClock))*
      Math.max(0,rotationSpeed)/.6;
    previousClock=clock;
    if(dt<1e-6)return false;
    const parts=Math.max(1,Math.ceil(dt/.035));
    const h=dt/parts;
    const force=Math.max(.1,Math.min(2.5,strength));
    const haloWeight=Math.max(0,Math.min(2,halo));
    for(let part=0;part<parts;part++){
      accelerationAt(force,haloWeight);
      const half=.5*h;
      for(let p=0;p<initial.length;p++){
        velocities[p]+=acceleration[p]*half;
        positions[p]+=velocities[p]*h;
      }
      accelerationAt(force,haloWeight);
      for(let p=0;p<initial.length;p++)
        velocities[p]+=acceleration[p]*half;
      steps++;
    }
    elapsed+=dt;
    return true;
  }
  function meanDrift(){
    if(!count)return 0;
    const stride=Math.max(1,Math.floor(count/96));
    let drift=0,samples=0;
    for(let i=0;i<count;i+=stride){
      const p=i*3;
      drift+=Math.hypot(positions[p]-initial[p],positions[p+1]-initial[p+1],
        positions[p+2]-initial[p+2]);
      samples++;
    }
    return drift/samples;
  }
  return {positions,velocities,attractors:centers,
    get time(){return elapsed;},get steps(){return steps;},
    advance,reset,meanDrift};
}
