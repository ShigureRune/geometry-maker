import {describe,expect,it} from 'vitest';
import {
  GALAXY_LOW_STAR_LIMIT,galaxyDefaults,galaxyMorphEasing,
  generateGalaxy,validateGalaxySettings,
} from './galaxy';
import {threeDefaults,validateThreeSettings} from './settings';

describe('GALAXY MODE',()=>{
  it('is opt-in and old 3D JSON stays in ordinary 3D mode',()=>{
    expect(galaxyDefaults.enabled).toBe(false);
    expect(validateThreeSettings({...threeDefaults,galaxy:undefined}).galaxy).toEqual(galaxyDefaults);
  });
  it('round-trips settings and rejects invalid counts, palettes and arm ranges',()=>{
    const customized={...galaxyDefaults,enabled:true,arms:6,count:24000,palette:'rose' as const,rotationSpeed:1.25};
    expect(validateGalaxySettings(customized)).toEqual(customized);
    expect(validateThreeSettings({...threeDefaults,galaxy:customized}).galaxy).toEqual(customized);
    for(const value of [{count:30001},{count:Infinity},{arms:1},{arms:9},{palette:'unknown'},{radius:100},{coreGlow:-1},{seedTransition:'yes'},
      {armWidth:0},{armWidth:3},{inclination:-1},{inclination:80},{barred:'yes'},{darkBackground:'bad'}]){
      expect(()=>validateGalaxySettings({...galaxyDefaults,...value})).toThrow();
    }
  });
  it('generates identical data for the same seed and settings',()=>{
    const a=generateGalaxy('spiral-seed',galaxyDefaults,false);
    const b=generateGalaxy('spiral-seed',galaxyDefaults,false);
    const c=generateGalaxy('another-seed',galaxyDefaults,false);
    expect(a.count).toBe(12000);
    expect(a.positions).toEqual(b.positions);
    expect(a.colors).toEqual(b.colors);
    expect(a.sizes).toEqual(b.sizes);
    expect(a.opacities).toEqual(b.opacities);
    expect(a.kinds).toEqual(b.kinds);
    expect(a.positions).not.toEqual(c.positions);
    expect(Array.from(a.positions).every(Number.isFinite)).toBe(true);
    expect(Array.from(a.sizes).every(v=>v>0&&Number.isFinite(v))).toBe(true);
  });
  it('caps low-quality stars without altering the saved requested count',()=>{
    const original={...galaxyDefaults,count:30000};
    const mobile=generateGalaxy('same',original,true);
    expect(mobile.count).toBe(GALAXY_LOW_STAR_LIMIT);
    expect(original.count).toBe(30000);
    expect(generateGalaxy('same',original,false).count).toBe(30000);
  });
  it('has a visible 3D depth and a central stellar nucleus',()=>{
    const galaxy=generateGalaxy('depth',galaxyDefaults,true);
    expect(galaxy.positions.some((v,i)=>i%3===2&&Math.abs(v)>.01)).toBe(true);
    expect(galaxy.cores.some(x=>x>.5)).toBe(true);
    expect(galaxy.cores.some(x=>x===0)).toBe(true);
    expect(galaxy.kinds.some(x=>x===1)).toBe(true);
    expect(galaxy.opacities.some(x=>x<.2)).toBe(true);
    expect(galaxyDefaults.arms).toBe(2);
  });
  it('arms bend with radius rather than becoming near-concentric rings',()=>{
    const galaxy=generateGalaxy('shape-check',galaxyDefaults,false);
    const start=Math.floor(galaxy.count*(.105+.305+.12));
    const end=galaxy.count-Math.floor(galaxy.count*(.025+galaxyDefaults.dust/60*.055));
    const meanAngle=(min:number,max:number)=>{
      let x=0,y=0,n=0;
      for(let i=start;i<end;i+=galaxyDefaults.arms){
        const p=i*3,px=galaxy.positions[p],py=galaxy.positions[p+1];
        const norm=Math.hypot(px,py)/galaxyDefaults.radius;
        if(norm<min||norm>max)continue;
        const theta=Math.atan2(py,px);
        x+=Math.cos(theta);y+=Math.sin(theta);n++;
      }
      expect(n).toBeGreaterThan(100);
      return Math.atan2(y,x);
    };
    const inner=meanAngle(.30,.46),outer=meanAngle(.82,.98);
    const delta=Math.abs(Math.atan2(Math.sin(outer-inner),Math.cos(outer-inner)));
    expect(delta).toBeGreaterThan(.9);
    expect(delta).toBeLessThan(3.14);
  });
  it('arm thickness, inclination and central bar are validated with legacy compatibility',()=>{
    const old={...galaxyDefaults};
    delete (old as Partial<typeof old>).armWidth;
    delete (old as Partial<typeof old>).inclination;
    delete (old as Partial<typeof old>).barred;
    delete (old as Partial<typeof old>).darkBackground;
    expect(validateGalaxySettings(old)).toMatchObject({armWidth:1.25,inclination:23,barred:false,darkBackground:true});
    expect(generateGalaxy('barred',{...galaxyDefaults,barred:true},true).positions)
      .not.toEqual(generateGalaxy('barred',galaxyDefaults,true).positions);
    expect(generateGalaxy('wide',{...galaxyDefaults,armWidth:2.2},true).positions)
      .not.toEqual(generateGalaxy('wide',galaxyDefaults,true).positions);
  });
  it('ease is seekable and exact at endpoints',()=>{
    expect(galaxyMorphEasing(-4)).toBe(0);
    expect(galaxyMorphEasing(0)).toBe(0);
    expect(galaxyMorphEasing(.5)).toBe(.5);
    expect(galaxyMorphEasing(1)).toBe(1);
    expect(galaxyMorphEasing(8)).toBe(1);
  });
});
