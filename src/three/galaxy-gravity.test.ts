import {describe,expect,it} from 'vitest';
import {galaxyDefaults,generateGalaxy} from './galaxy';
import {createGalaxyCoreMotion,createGalaxyGravitySimulation,galaxyGravityAttractors} from './galaxy-gravity';

describe('GALAXY MODE approximate gravity',()=>{
  it('keeps the historical view and projects opt-in gravity settings safely',()=>{
    const options={...galaxyDefaults};
    expect(options.gravityEnabled).toBe(false);
    expect(options.gravityStrength).toBe(1);
    expect(options.gravityHalo).toBe(1);
  });
  it('uses a symplectic central plus dark-halo potential, not a fixed spin orbit',()=>{
    const options={...galaxyDefaults,gravityEnabled:true,count:6000};
    const stars=generateGalaxy('gravitational-tracers',options,false);
    const initial=new Float32Array(stars.positions);
    const gravity=createGalaxyGravitySimulation(stars,options);
    expect(gravity.attractors).toHaveLength(1);
    expect(gravity.attractors[0].mass).toBeGreaterThan(0);
    expect(gravity.attractors[0].halo).toBeGreaterThan(0);
    expect(gravity.advance(0,1,1,.6)).toBe(false);
    for(let step=1;step<=300;step++)
      gravity.advance(step*.035,1,1,.6);
    expect(gravity.time).toBeCloseTo(10.5,2);
    expect(gravity.steps).toBeGreaterThanOrEqual(300);
    expect(gravity.meanDrift()).toBeGreaterThan(.12);
    expect(gravity.positions.every(Number.isFinite)).toBe(true);
    expect(stars.positions).toEqual(initial);
    expect(gravity.positions).not.toEqual(initial);
    // Tracers stay gravitationally bound on normal settings and retain Z.
    const max=Math.max(...gravity.positions.map(x=>Math.abs(x)));
    expect(max).toBeLessThan(options.radius*4);
    expect(gravity.positions.some((x,i)=>i%3===2&&Math.abs(x)>.005)).toBe(true);
  });
  it('responds to mass and halo separately, pauses, and deterministically rewinds',()=>{
    const options={...galaxyDefaults,gravityEnabled:true};
    const tracers={
      positions:new Float32Array([options.radius,0,.05,
        options.radius*.5,.1,-.03,options.radius*.7,.2,.02]),
      spins:new Float32Array([1,1,1]),
      orbitCenters:new Float32Array(6),
    };
    const normal=createGalaxyGravitySimulation(tracers,options);
    const intense=createGalaxyGravitySimulation(tracers,options);
    const noHalo=createGalaxyGravitySimulation(tracers,options);
    for(let i=0;i<=400;i++){
      const t=i*.035;
      normal.advance(t,1,1,.6);
      intense.advance(t,2.2,1,.6);
      noHalo.advance(t,1,0,.6);
    }
    expect(Math.hypot(normal.positions[0]-intense.positions[0],
      normal.positions[1]-intense.positions[1])).toBeGreaterThan(.15);
    expect(Math.hypot(normal.positions[0]-noHalo.positions[0],
      normal.positions[1]-noHalo.positions[1])).toBeGreaterThan(.15);
    const paused=new Float32Array(normal.positions);
    expect(normal.advance(14,.4,1,.6)).toBe(false);
    expect(normal.positions).toEqual(paused);
    expect(normal.advance(0,1,1,.6)).toBe(true);
    expect(normal.positions).toEqual(tracers.positions);
    expect(normal.steps).toBe(0);
  });
  it('numerically moves both galaxy nuclei while preserving their barycenter',()=>{
    const options={...galaxyDefaults,galaxyType:'interacting' as const,
      movingCoresEnabled:true,gravityEnabled:true,count:8000};
    const stars=generateGalaxy('moving-nuclei',options,false);
    const motion=createGalaxyCoreMotion(stars,options);
    expect(motion.count).toBe(2);
    const [a,b]=motion.bodies;
    const startDistance=motion.distance;
    const totalMass=a.mass+b.mass;
    const baryX=(a.x*a.mass+b.x*b.mass)/totalMass;
    const baryY=(a.y*a.mass+b.y*b.mass)/totalMass;
    const momentumX=a.vx*a.mass+b.vx*b.mass;
    const momentumY=a.vy*a.mass+b.vy*b.mass;
    expect(Math.hypot(momentumX,momentumY)).toBeLessThan(1e-7);
    motion.advance(0,1,1,.6);
    for(let i=1;i<=100;i++)motion.advance(i*.035,1,1,.6);
    expect(motion.steps).toBeGreaterThan(50);
    expect(motion.merged).toBe(false);
    expect(motion.distance).toBeLessThan(startDistance-.1);
    const currentBaryX=(a.x*a.mass+b.x*b.mass)/totalMass;
    const currentBaryY=(a.y*a.mass+b.y*b.mass)/totalMass;
    expect(Math.hypot(currentBaryX-baryX,currentBaryY-baryY)).toBeLessThan(.0002);
    expect(motion.bodies.every(body=>Number.isFinite(body.x)&&Number.isFinite(body.y))).toBe(true);
    motion.advance(0,1,1,.6);
    expect(motion.distance).toBeCloseTo(startDistance,4);
    expect(motion.merged).toBe(false);
    expect(motion.steps).toBe(0);
  });
  it('flies past twice, rebounds between passages, then merges with momentum conservation',()=>{
    const options={...galaxyDefaults,galaxyType:'interacting' as const,
      movingCoresEnabled:true,gravityEnabled:true,count:4000,coreFriction:1,
      coreMergeDistance:.4};
    const stars=generateGalaxy('orbital-decay-merger',options,true);
    const motion=createGalaxyCoreMotion(stars,options);
    const [a,b]=motion.bodies;
    const totalMass=a.mass+b.mass;
    // A shared drift must persist after the merger without moving the pair's
    // center of mass under mutual gravity and dynamical friction.
    a.vx+=.1;b.vx+=.1;
    a.vy+=.025;b.vy+=.025;
    const px=a.mass*a.vx+b.mass*b.vx,py=a.mass*a.vy+b.mass*b.vy;
    motion.advance(0,1,1,.6);
    motion.advance(.035,1,1,.6);
    expect(motion.merged).toBe(false);
    expect(motion.passages).toBe(0);
    let previousPassages=0,rebound=false;
    const periDistances:number[]=[];
    for(let i=2;i<=4200&&!motion.merged;i++){
      motion.advance(i*.035,1,1,.6);
      if(motion.passages>previousPassages){
        expect(motion.passages).toBe(previousPassages+1);
        expect(motion.merged).toBe(false);
        periDistances.push(motion.distance);
        previousPassages=motion.passages;
      }
      if(periDistances.length===1&&motion.stage==='separating'&&
        motion.distance>periDistances[0]+options.radius*.20)rebound=true;
    }
    expect(periDistances.length).toBeGreaterThanOrEqual(2);
    expect(periDistances[1]).toBeLessThan(periDistances[0]);
    expect(rebound,'the galaxy nuclei must separate after the first flyby').toBe(true);
    expect(motion.merged,'a decaying orbit must eventually coalesce').toBe(true);
    expect(motion.count).toBe(1);
    expect(a.mass).toBeCloseTo(totalMass,6);
    expect(a.vx*totalMass).toBeCloseTo(px,5);
    expect(a.vy*totalMass).toBeCloseTo(py,5);
    const before=[a.x,a.y] as const;
    motion.advance(150,1,1,.6);
    expect(Math.hypot(a.x-before[0],a.y-before[1])).toBeGreaterThan(0);
    expect(b.active).toBe(false);
    expect(motion.distance).toBe(0);
    motion.advance(0,1,1,.6);
    expect(motion.merged).toBe(false);
    expect(motion.count).toBe(2);
    expect(motion.passages).toBe(0);
  });
  it('without dynamical friction, bound cores can keep swinging by without merging',()=>{
    const options={...galaxyDefaults,galaxyType:'interacting' as const,
      movingCoresEnabled:true,gravityEnabled:true,count:4000,
      coreFriction:0,coreMergeDistance:.4};
    const stars=generateGalaxy('orbital-decay-merger',options,true);
    const motion=createGalaxyCoreMotion(stars,options);
    const initial=motion.distance;
    motion.advance(0,1,1,.6);
    let min=initial,max=0;
    for(let i=1;i<=4000;i++){
      motion.advance(i*.035,1,1,.6);
      min=Math.min(min,motion.distance);
      max=Math.max(max,motion.distance);
    }
    expect(motion.passages).toBeGreaterThanOrEqual(3);
    expect(motion.merged).toBe(false);
    expect(motion.count).toBe(2);
    expect(min).toBeLessThan(initial*.50);
    expect(max).toBeGreaterThan(initial*.92);
  });
  it('relative-velocity friction dissipates orbital energy without center-of-mass drift',()=>{
    const options={...galaxyDefaults,galaxyType:'interacting' as const,
      movingCoresEnabled:true,gravityEnabled:true,count:4000};
    const stars=generateGalaxy('energy-decay',options,true);
    const dissipative=createGalaxyCoreMotion(stars,{...options,coreFriction:1});
    const conservative=createGalaxyCoreMotion(stars,{...options,coreFriction:0});
    const energy=(sim:ReturnType<typeof createGalaxyCoreMotion>)=>{
      const [a,b]=sim.bodies;
      const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;
      const dvx=b.vx-a.vx,dvy=b.vy-a.vy,dvz=b.vz-a.vz;
      const r2=dx*dx+dy*dy+dz*dz,R=options.radius;
      return .5*(dvx*dvx+dvy*dvy+dvz*dvz)-
        (a.mass+b.mass)/Math.sqrt(r2+(R*.20)**2)+
        .5*(a.halo+b.halo)*Math.log(r2+(R*.30)**2);
    };
    const originalEnergy=energy(dissipative);
    const [a,b]=dissipative.bodies;
    const mass=a.mass+b.mass;
    const cx=(a.mass*a.x+b.mass*b.x)/mass;
    const cy=(a.mass*a.y+b.mass*b.y)/mass;
    dissipative.advance(0,1,1,.6);
    conservative.advance(0,1,1,.6);
    for(let i=1;i<=680;i++){
      dissipative.advance(i*.035,1,1,.6);
      conservative.advance(i*.035,1,1,.6);
    }
    expect(dissipative.passages).toBeGreaterThanOrEqual(1);
    expect(dissipative.merged).toBe(false);
    expect(energy(dissipative)).toBeLessThan(originalEnergy-.005);
    expect(energy(conservative)).toBeCloseTo(originalEnergy,3);
    expect(Math.hypot((a.mass*a.x+b.mass*b.x)/mass-cx,
      (a.mass*a.y+b.mass*b.y)/mass-cy)).toBeLessThan(.0001);
  });
  it('keeps star and gas tracers synchronized to the same moving nuclei',()=>{
    const options={...galaxyDefaults,galaxyType:'interacting' as const,
      movingCoresEnabled:true,gravityEnabled:true,count:4000};
    const stars=generateGalaxy('shared-motion',options,false);
    const coreMotion=createGalaxyCoreMotion(stars,options);
    const starGravity=createGalaxyGravitySimulation(stars,options,coreMotion);
    const gasGravity=createGalaxyGravitySimulation(stars,options,coreMotion);
    starGravity.advance(0,1,1,.6);
    gasGravity.advance(0,1,1,.6);
    for(let i=1;i<=30;i++){
      const time=i*.035;
      starGravity.advance(time,1,1,.6);
      gasGravity.advance(time,1,1,.6);
    }
    // Both tracer systems have exactly the same shared moving potential.
    // Advancing a second tracer must not double-step the moving nuclei.
    const reference=createGalaxyCoreMotion(stars,options);
    reference.advance(0,1,1,.6);
    for(let i=1;i<=30;i++)reference.advance(i*.035,1,1,.6);
    expect(coreMotion.steps).toBe(reference.steps);
    expect(starGravity.positions).toEqual(gasGravity.positions);
    expect(starGravity.positions).not.toEqual(stars.positions);
    expect(coreMotion.distance).toBeGreaterThan(0);
  });
  it('uses both fixed mass centers for an interacting galaxy',()=>{
    const options={...galaxyDefaults,galaxyType:'interacting' as const,
      gravityEnabled:true,count:8000};
    const stars=generateGalaxy('gravity-interaction',options,false);
    const attractors=galaxyGravityAttractors(stars,options);
    expect(attractors).toHaveLength(2);
    expect(Math.hypot(attractors[0].x-attractors[1].x,
      attractors[0].y-attractors[1].y)).toBeGreaterThan(0);
    expect(attractors[0].mass).toBeGreaterThan(attractors[1].mass);
    const gravity=createGalaxyGravitySimulation(stars,options);
    gravity.advance(0,1,1,.6);
    for(let i=1;i<=80;i++)gravity.advance(i*.035,1,1,.6);
    expect(gravity.meanDrift()).toBeGreaterThan(.01);
    expect(gravity.positions.every(Number.isFinite)).toBe(true);
  });
});
