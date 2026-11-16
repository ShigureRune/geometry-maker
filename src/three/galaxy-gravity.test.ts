import {describe,expect,it} from 'vitest';
import {galaxyDefaults,generateGalaxy} from './galaxy';
import {createGalaxyGravitySimulation,galaxyGravityAttractors} from './galaxy-gravity';

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
