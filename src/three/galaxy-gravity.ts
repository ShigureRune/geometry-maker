import type {GalaxySettings} from './galaxy';

/**
 * Interactive massless tracers in a softened stellar-bulge + dark-matter-halo
 * potential. This is a genuine numerical leapfrog gravity integration, NOT a
 * full N-body solver: stars do not attract one another. Interacting galaxies
 * use two mass centers. Optional live cores can move and merge, while all
 * tracer populations share their positions. Stars never attract other stars.
 */
export type GravityTracers={
  positions:Float32Array;
  spins:Float32Array;
  orbitCenters?:Float32Array;
};
export type GravityAttractor={
  x:number;y:number;mass:number;halo:number;
  /** Size of the gravitational softening radii in units of the main galaxy.
   * A compact companion needs a correspondingly compact potential well. */
  softeningScale:number;
};

/** Acceleration magnitude per unit separation toward a single source.
 * Both initial circular velocities and numerical integration share this
 * kernel, so the small companion doesn't rotate at a different potential
 * than the one that actually attracts its stars. */
export function galaxyGravitySourceStrength(
  center:GravityAttractor,distanceSquared:number,radius:number,
  strength=1,haloWeight=1,
):number{
  const s=center.softeningScale;
  const eps2=(radius*.14*s)**2;
  const halo2=(radius*.30*s)**2;
  return (center.mass/Math.pow(distanceSquared+eps2,1.5)+
    center.halo*Math.max(0,haloWeight)/(distanceSquared+halo2))*
    Math.max(0,strength);
}
export type GravityBody=GravityAttractor&{
  z:number;vx:number;vy:number;vz:number;active:boolean;
};
export type GalaxyCoreMotion={
  bodies:GravityBody[];
  readonly merged:boolean;
  readonly count:number;
  readonly distance:number;
  readonly steps:number;
  /** Number of completed close passages (local separation minima). */
  readonly passages:number;
  readonly stage:'approaching'|'separating'|'merged';
  advance:(clock:number,strength:number,halo:number,speed:number)=>boolean;
  reset:()=>void;
};
export type GalaxyGravitySimulation={
  positions:Float32Array;
  velocities:Float32Array;
  attractors:readonly GravityAttractor[];
  time:number;
  steps:number;
  /** 1 for a dynamically stripped particle, 0 for a bound disk tracer. */
  tidalFlags:Float32Array;
  readonly tidalEnabled:boolean;
  readonly tidalStrippedCount:number;
  readonly tidalTailExtent:number;
  readonly tidalBridgeCount:number;
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
      halo:defaultHalo*share,
      // The companion disk/bulge is drawn at companionSize*R, but previously
      // both wells were smoothed over the FULL main-galaxy radius. Its own
      // acceleration was therefore far too weak near the visible nucleus.
      softeningScale:companion?Math.max(.30,options.companionSize):1};
  });
}

/** Two moving extended galaxy potentials with a barycentric initial encounter.
 * Pairwise forces preserve momentum: both live cores are accelerated by their
 * partner; on impact, mass and linear momentum are conserved. */
export function createGalaxyCoreMotion(
  tracers:GravityTracers,options:GalaxySettings,
):GalaxyCoreMotion{
  const original=galaxyGravityAttractors(tracers,options);
  const bodies:GravityBody[]=original.map(c=>({
    ...c,z:0,vx:0,vy:0,vz:0,active:true,
  }));
  const radius=options.radius;
  const pairSoft2=(radius*.20)**2;
  const haloCore2=(radius*.30)**2;
  const mergeDistance=radius*options.coreMergeDistance;
  const friction=Math.max(0,Math.min(2,options.coreFriction));
  if(bodies.length===2){
    const a=bodies[0],b=bodies[1],sum=a.mass+b.mass;
    const dx=b.x-a.x,dy=b.y-a.y;
    const distance=Math.max(.001,Math.hypot(dx,dy));
    const ux=dx/distance,uy=dy/distance;
    // Start on a bound, *eccentric* encounter. Some initial tangential
    // angular momentum is essential: a nearly radial fall visually sticks
    // the cores together on the first approach instead of a flyby.
    // Estimate circular speed in the SAME softened+halo potential used below.
    const r2=distance*distance;
    const circular=Math.sqrt(
      sum*r2/Math.pow(r2+pairSoft2,1.5)+
      (a.halo+b.halo)*r2/(r2+haloCore2));
    const incoming=circular*(.13+.22*options.coreApproachSpeed);
    const tangential=circular*(.40+.45*options.coreImpactParameter);
    const relativeVx=-ux*incoming-uy*tangential;
    const relativeVy=-uy*incoming+ux*tangential;
    a.vx=-relativeVx*b.mass/sum;a.vy=-relativeVy*b.mass/sum;
    b.vx=relativeVx*a.mass/sum;b.vy=relativeVy*a.mass/sum;
  }
  const initial=bodies.map(b=>({...b}));
  let previousClock:number|null=null;
  let wasMerged=false,steps=0,passages=0;
  function separation(){
    const [a,b]=bodies;
    if(!b?.active)return 0;
    return Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);
  }
  function radialVelocity(){
    const [a,b]=bodies;
    if(!b?.active)return 0;
    const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;
    return (dx*(b.vx-a.vx)+dy*(b.vy-a.vy)+dz*(b.vz-a.vz))/
      Math.max(.0001,Math.hypot(dx,dy,dz));
  }
  let previousRadial=radialVelocity();
  function reset(){
    for(let i=0;i<initial.length;i++)Object.assign(bodies[i],initial[i]);
    previousClock=null;wasMerged=false;steps=0;passages=0;
    previousRadial=radialVelocity();
  }
  /** Mutual acceleration in the reduced (relative) two-body system.
   * Both galaxies receive equal and opposite forces even if the halo-to-bulge
   * mass ratio is different: their shared barycenter therefore cannot drift. */
  function pairAcceleration(strength:number,haloWeight:number){
    const a=bodies[0],b=bodies[1];
    if(!b?.active)return [[0,0,0],[0,0,0]] as const;
    const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;
    const d2=dx*dx+dy*dy+dz*dz;
    const total=a.mass+b.mass;
    const mu=(total/Math.pow(d2+pairSoft2,1.5)+
      (a.halo+b.halo)*haloWeight/(d2+haloCore2))*strength;
    const aShare=b.mass/total,bShare=a.mass/total;
    return [[mu*dx*aShare,mu*dy*aShare,mu*dz*aShare],
      [-mu*dx*bShare,-mu*dy*bShare,-mu*dz*bShare]] as const;
  }
  /** A local dynamical-friction approximation: stellar and dark-halo
   * encounters transfer orbital energy into internal motions. Drag is
   * strongest during close passages; it damps RELATIVE velocity only,
   * preserving the pair's total linear momentum. This is intentionally
   * a restricted two-body model, not resolved N-body dynamical friction. */
  function dampRelativeVelocity(halfStep:number){
    if(friction===0)return;
    const a=bodies[0],b=bodies[1],sum=a.mass+b.mass;
    const r=separation();
    const near=1/(1+Math.pow(r/(radius*.48),4));
    const damping=Math.exp(-friction*(.004+.030*near)*halfStep);
    const dx=(b.vx-a.vx)*(damping-1);
    const dy=(b.vy-a.vy)*(damping-1);
    const dz=(b.vz-a.vz)*(damping-1);
    const fa=b.mass/sum,fb=a.mass/sum;
    a.vx-=dx*fa;a.vy-=dy*fa;a.vz-=dz*fa;
    b.vx+=dx*fb;b.vy+=dy*fb;b.vz+=dz*fb;
  }
  function merge(){
    const a=bodies[0],b=bodies[1],sum=a.mass+b.mass;
    // Momentum-weighted location and velocity; no invented teleportation of
    // the remnant's barycenter or sudden change of overall linear momentum.
    for(const key of ['x','y','z','vx','vy','vz'] as const)
      a[key]=(a[key]*a.mass+b[key]*b.mass)/sum;
    a.mass=sum;a.halo+=b.halo;
    a.softeningScale=Math.max(a.softeningScale,b.softeningScale);
    b.x=a.x;b.y=a.y;b.z=a.z;
    b.vx=a.vx;b.vy=a.vy;b.vz=a.vz;
    b.active=false;wasMerged=true;
  }
  function advance(clock:number,strength:number,halo:number,speed:number){
    if(!Number.isFinite(clock))return false;
    if(previousClock===null){previousClock=clock;return false;}
    if(clock<previousClock-1e-5){reset();previousClock=clock;return true;}
    const dt=Math.min(.18,Math.max(0,clock-previousClock))*
      Math.max(0,speed)/.6;
    previousClock=clock;
    if(dt<1e-6||bodies.length<2)return false;
    if(wasMerged){
      // A merger remnant moves with its conserved center-of-mass velocity.
      const a=bodies[0],b=bodies[1];
      a.x+=a.vx*dt;a.y+=a.vy*dt;a.z+=a.vz*dt;
      b.x=a.x;b.y=a.y;b.z=a.z;
      steps++;return true;
    }
    const parts=Math.max(1,Math.ceil(dt/.035)),h=dt/parts;
    const force=Math.max(.1,Math.min(2.5,strength));
    const haloWeight=Math.max(0,Math.min(2,halo));
    for(let j=0;j<parts;j++){
      const first=pairAcceleration(force,haloWeight);
      for(let i=0;i<2;i++){
        const body=bodies[i],acc=first[i];
        body.vx+=acc[0]*h*.5;body.vy+=acc[1]*h*.5;
        body.vz+=acc[2]*h*.5;
      }
      dampRelativeVelocity(h*.5);
      for(const body of bodies){
        body.x+=body.vx*h;body.y+=body.vy*h;body.z+=body.vz*h;
      }
      const second=pairAcceleration(force,haloWeight);
      for(let i=0;i<2;i++){
        const body=bodies[i],acc=second[i];
        body.vx+=acc[0]*h*.5;body.vy+=acc[1]*h*.5;
        body.vz+=acc[2]*h*.5;
      }
      dampRelativeVelocity(h*.5);
      steps++;
      const radial=radialVelocity();
      // Count ACTUAL pericentric turns, not elapsed seconds or collisions
      // with an arbitrary distance threshold. Both nuclei must pull away
      // from one another after each of at least two close encounters.
      if(previousRadial<0&&radial>=0)passages++;
      previousRadial=radial;
      // Only the THIRD (or later) inward passage may coalesce. This keeps
      // the first two complete swing-bys, regardless of merge-radius slider.
      if(friction>0&&passages>=2&&radial<0&&separation()<mergeDistance){
        merge();break;
      }
    }
    return true;
  }
  return {bodies,
    get merged(){return wasMerged;},
    get count(){return bodies.filter(b=>b.active).length;},
    get distance(){return separation();},
    get passages(){return passages;},
    get stage(){return wasMerged?'merged':radialVelocity()>=0?'separating':'approaching';},
    get steps(){return steps;},
    advance,reset,
  };
}

export function createGalaxyGravitySimulation(
  tracers:GravityTracers,options:GalaxySettings,
  coreMotion?:GalaxyCoreMotion|null,
):GalaxyGravitySimulation{
  const initial=new Float32Array(tracers.positions);
  const positions=new Float32Array(initial);
  const velocities=new Float32Array(initial.length);
  const acceleration=new Float32Array(initial.length);
  const count=Math.floor(initial.length/3);
  const centers=coreMotion?.bodies??galaxyGravityAttractors(tracers,options);
  const orbitCenters=tracers.orbitCenters;
  const tidalEnabled=!!(options.tidalDynamicsEnabled&&coreMotion&&
    options.galaxyType==='interacting'&&coreMotion.bodies.length===2);
  const tidalFlags=new Float32Array(count);
  const originalRadii=new Float32Array(count);
  const hostIndices=new Uint8Array(count);
  const tideScale=tidalEnabled?Math.min(1.6,options.tidalStrength/.65):0;
  let tidalStrippedCount=0,tidalTailExtent=0,tidalBridgeCount=0;
  // Initialize a physically supported near-circular orbital velocity in the
  // *same trailing direction* as the existing analytic galaxy animation.
  // Slight deterministic epicycles make the gravity effect visible over time.
  for(let i=0;i<count;i++){
    const j=i*3,k=i*2;
    const x=initial[j],y=initial[j+1],z=initial[j+2];
    const cx=orbitCenters?.[k]??0,cy=orbitCenters?.[k+1]??0;
    const dx=x-cx,dy=y-cy,r=Math.max(options.radius*.035,Math.hypot(dx,dy));
    const host=centers.length>1&&
      Math.hypot(cx-centers[1].x,cy-centers[1].y)<
        Math.hypot(cx-centers[0].x,cy-centers[0].y)?1:0;
    hostIndices[i]=host;
    originalRadii[i]=Math.hypot(dx,dy);
    const own=centers[host];
    const r2=r*r;
    const v2=r2*galaxyGravitySourceStrength(own,r2,options.radius);
    const speed=Math.sqrt(Math.max(0,v2))*
      (1+.07*Math.sin(i*1.733+z*3.17));
    const sign=Math.sign(tracers.spins[i]||1);
    const radial=.026*Math.cos(i*2.11+z);
    // The stellar disk must inherit its parent's bulk orbital velocity:
    // without this the glowing nucleus flies off while its own stars lag
    // behind, and a physical tidal bridge never forms coherently.
    const mobile=tidalEnabled?coreMotion?.bodies[host]:undefined;
    velocities[j]=-sign*dy/r*speed+radial*dx/r*speed+(mobile?.vx??0);
    velocities[j+1]=sign*dx/r*speed+radial*dy/r*speed+(mobile?.vy??0);
    velocities[j+2]=-.02*z+(mobile?.vz??0);
  }
  const initialVelocities=new Float32Array(velocities);
  /** Use a co-moving frame for each stellar disk, then add only the
   * DIFFERENTIAL gravity due to its companion. The uniform acceleration
   * exactly matches the acceleration applied to the parent nucleus; this
   * prevents the stars from leaving their own galaxies for a fake reason.
   * At physical tide strength (the legacy slider's default .65), the
   * differential field is unscaled. Other values are explicitly illustrative.
   * This still uses massless tracers; the material ripped out has no
   * back-reaction on the two galaxy potentials. */
  function accelerationAt(strength:number,haloWeight:number){
    if(tidalEnabled&&coreMotion){
      const a=coreMotion.bodies[0],b=coreMotion.bodies[1];
      const active=b.active;
      const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;
      const d2=dx*dx+dy*dy+dz*dz;
      const total=a.mass+b.mass;
      // Match the live core integrator's softened mutual force exactly.
      const mu=active?(
        total/Math.pow(d2+(options.radius*.20)**2,1.5)+
        (a.halo+b.halo)*haloWeight/
          (d2+(options.radius*.30)**2))*strength:0;
      const ax0=dx*mu*b.mass/total,ay0=dy*mu*b.mass/total;
      const az0=dz*mu*b.mass/total;
      const ax1=-dx*mu*a.mass/total,ay1=-dy*mu*a.mass/total;
      const az1=-dz*mu*a.mass/total;
      const gBA=active?galaxyGravitySourceStrength(
        b,d2,options.radius,strength,haloWeight):0;
      const gAB=active?galaxyGravitySourceStrength(
        a,d2,options.radius,strength,haloWeight):0;
      // External force at the host center, subtracted from the force at
      // the particle; a non-stripped star at r=0 follows its nucleus.
      for(let i=0;i<count;i++){
        const p=i*3,host=active?hostIndices[i]:0;
        const own=host===0?a:b;
        const other=host===0?b:a;
        const x=positions[p],y=positions[p+1],z=positions[p+2];
        const lx=x-own.x,ly=y-own.y,lz=z-own.z;
        const ownStrength=galaxyGravitySourceStrength(own,
          lx*lx+ly*ly+lz*lz,options.radius,strength,haloWeight);
        let fx=-lx*ownStrength+(host===0?ax0:ax1);
        let fy=-ly*ownStrength+(host===0?ay0:ay1);
        let fz=-lz*ownStrength*.8+(host===0?az0:az1);
        if(active&&tideScale>0){
          const ex=x-other.x,ey=y-other.y,ez=z-other.z;
          const influence=galaxyGravitySourceStrength(other,
            ex*ex+ey*ey+ez*ez,options.radius,strength,haloWeight);
          const atHost=host===0?gBA:gAB;
          const hx=host===0?dx:-dx,hy=host===0?dy:-dy;
          const hz=host===0?dz:-dz;
          // Nonlinear differential acceleration creates physical tidal
          // bridge and tail trajectories as the cores sweep past.
          fx+=tideScale*(-ex*influence-hx*atHost);
          fy+=tideScale*(-ey*influence-hy*atHost);
          fz+=tideScale*(-ez*influence-hz*atHost)*.8;
        }
        acceleration[p]=fx;acceleration[p+1]=fy;acceleration[p+2]=fz;
      }
      return;
    }
    // Original fixed-potential and solo-galaxy dynamics are byte-for-byte
    // unchanged when the optional tidal feature is off.
    for(let i=0;i<count;i++){
      const p=i*3,x=positions[p],y=positions[p+1],z=positions[p+2];
      let ax=0,ay=0,az=0;
      for(const center of centers){
        if('active' in center&&!center.active)continue;
        const dx=x-center.x,dy=y-center.y;
        const dz=z-('z' in center&&typeof center.z==='number'?center.z:0);
        const dist2=dx*dx+dy*dy+dz*dz;
        const factor=-galaxyGravitySourceStrength(
          center,dist2,options.radius,strength,haloWeight);
        ax+=dx*factor;ay+=dy*factor;
        az+=dz*(factor*.8);
      }
      acceleration[p]=ax;acceleration[p+1]=ay;acceleration[p+2]=az;
    }
  }
  /** A conservative Roche-lobe/expansion diagnostic. Stripping is recorded
   * only after a tracer has expanded beyond its own original orbit and crossed
   * a mass-ratio-dependent tidal boundary while moving outward. Status does
   * not create or move stars: all tail geometry comes from the integrator. */
  function updateTidalDiagnostics(){
    if(!tidalEnabled||!coreMotion)return;
    const a=coreMotion.bodies[0],b=coreMotion.bodies[1];
    const active=b.active;
    const separation=active?Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z):0;
    let extent=0,bridge=0;
    for(let i=0;i<count;i++){
      const p=i*3;
      const host=active?hostIndices[i]:0;
      const own=host===0?a:b,other=host===0?b:a;
      const dx=positions[p]-own.x,dy=positions[p+1]-own.y;
      const r=Math.hypot(dx,dy);
      if(!tidalFlags[i]&&active&&tideScale>0&&
        separation<options.radius*.85){
        const q=own.mass/other.mass;
        const q13=Math.cbrt(q),q23=q13*q13;
        const roche=separation*.49*q23/
          (.6*q23+Math.log(1+q13));
        const rv=dx*(velocities[p]-own.vx)+
          dy*(velocities[p+1]-own.vy);
        if(r>Math.max(roche,originalRadii[i]*1.20,
          options.radius*.16*own.softeningScale)&&rv>0){
          tidalFlags[i]=1;tidalStrippedCount++;
        }
      }
      if(!tidalFlags[i])continue;
      extent=Math.max(extent,r);
      if(active){
        const vx=b.x-a.x,vy=b.y-a.y;
        const len2=vx*vx+vy*vy;
        const tx=positions[p]-a.x,ty=positions[p+1]-a.y;
        const t=(tx*vx+ty*vy)/Math.max(.0001,len2);
        const transverse=Math.abs(tx*vy-ty*vx)/
          Math.sqrt(Math.max(.0001,len2));
        if(t>.08&&t<.92&&transverse<options.radius*.22)bridge++;
      }
    }
    tidalTailExtent=extent;tidalBridgeCount=bridge;
  }
  let previousClock:number|null=null;
  let elapsed=0,steps=0;
  function reset(){
    positions.set(initial);
    velocities.set(initialVelocities);
    tidalFlags.fill(0);
    tidalStrippedCount=0;tidalTailExtent=0;tidalBridgeCount=0;
    previousClock=null;
    elapsed=0;steps=0;
  }
  function advance(clock:number,strength:number,halo:number,rotationSpeed:number){
    if(!Number.isFinite(clock))return false;
    // Idempotent shared clock: the first star/gas/detail layer advances
    // the cores, subsequent layers see the same current attractors.
    coreMotion?.advance(clock,strength,halo,rotationSpeed);
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
    if(tidalEnabled&&steps%8<parts)updateTidalDiagnostics();
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
  return {positions,velocities,attractors:centers,tidalFlags,
    tidalEnabled,
    get tidalStrippedCount(){return tidalStrippedCount;},
    get tidalTailExtent(){return tidalTailExtent;},
    get tidalBridgeCount(){return tidalBridgeCount;},
    get time(){return elapsed;},get steps(){return steps;},
    advance,reset,meanDrift};
}
