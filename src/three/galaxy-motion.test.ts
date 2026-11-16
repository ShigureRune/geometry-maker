import {describe,expect,it} from 'vitest';
import {GALAXY_MOTION_GLSL,galaxyAngularRate,galaxyOrbitDelta,
  galaxyRotate,galaxySpiralSpine} from './galaxy-motion';
import {galaxyAppearance,galaxyDefaults,generateGalaxy,GALAXY_TYPES} from './galaxy';

function wrap(a:number):number{return Math.atan2(Math.sin(a),Math.cos(a));}

describe('shared stellar and nebular orbital geometry',()=>{
  it('GPU and TS share spiral and orbital constants',()=>{
    expect(GALAXY_MOTION_GLSL).toContain('float galaxySpiralSpine(');
    expect(GALAXY_MOTION_GLSL).toContain('float galaxyAngularRate(');
    expect(GALAXY_MOTION_GLSL).toContain('float galaxyGasOrbit(');
    expect(GALAXY_MOTION_GLSL).toContain('0.025+0.080/');
    expect(GALAXY_MOTION_GLSL).toContain('0.145,0.250');
  });
  it('gas inverse sampling and star forward motion have exactly the same direction',()=>{
    for(const handed of [-1,1]){
      for(const radius of [.15,.30,.65,.95]){
        const a=galaxyOrbitDelta(radius,5.2,.85,handed);
        const [sx,sy]=galaxyRotate(radius,0,a);
        const [ox,oy]=galaxyRotate(sx,sy,-a);
        expect(ox).toBeCloseTo(radius,8);
        expect(oy).toBeCloseTo(0,8);
        expect(Math.sign(wrap(Math.atan2(sy,sx)))).toBe(handed);
      }
    }
    expect(galaxyOrbitDelta(.5,7,0,1)).toBe(0);
  });
  it('grand design and barred stellar arms follow the luminous gas spine',()=>{
    for(const type of ['grand_design','barred_spiral'] as const){
      const opts={...galaxyDefaults,galaxyType:type,count:15000,
        barred:type==='barred_spiral'};
      const data=generateGalaxy('coherent-galaxy',opts,false);
      const {orientation,handed}=galaxyAppearance('coherent-galaxy',opts.palette);
      const end=data.count-Math.floor(data.count*(.025+opts.dust/60*.055));
      const first=Math.floor(data.count*(.105+.305+.12));
      let error=0,samples=0;
      for(let i=first;i<end;i++){
        const x=data.positions[i*3],y=data.positions[i*3+1];
        const r=Math.hypot(x,y)/opts.radius;
        const spine=galaxySpiralSpine(r,i%opts.arms,opts.arms,
          orientation,handed,opts.twist,opts.barred);
        error+=Math.abs(wrap(Math.atan2(y,x)-spine));
        samples++;
        expect(Math.sign(data.spins[i])).toBe(handed);
        expect(Math.abs(data.spins[i])).toBeCloseTo(galaxyAngularRate(r),3);
      }
      expect(samples).toBeGreaterThan(3000);
      expect(error/samples).toBeLessThan(.35);
    }
  });
  it('all seven stellar types use the common orbital direction and rate',()=>{
    for(const galaxyType of GALAXY_TYPES){
      const opts={...galaxyDefaults,galaxyType,count:2000};
      const data=generateGalaxy('unified-orbit',opts,true);
      const {handed}=galaxyAppearance('unified-orbit',opts.palette);
      for(let i=0;i<data.count;i+=7){
        expect(Math.sign(data.spins[i])).toBe(handed);
        expect(Number.isFinite(data.spins[i])).toBe(true);
      }
    }
  });
  it('each interacting nucleus keeps its local pivot while orbiting',()=>{
    const settings={...galaxyDefaults,galaxyType:'interacting' as const,count:3000};
    const data=generateGalaxy('paired-centers',settings,true);
    expect(data.orbitCenters).toBeDefined();
    const centers=data.orbitCenters!;
    const first=0,companion=Math.floor(data.count*.68);
    expect(centers[first*2]).toBeCloseTo(-settings.radius*settings.companionDistance*.36,3);
    expect(centers[companion*2]).toBeCloseTo(settings.radius*settings.companionDistance*.60,3);
    const x=data.positions[companion*3],y=data.positions[companion*3+1];
    const cx=centers[companion*2],cy=centers[companion*2+1];
    const delta=galaxyOrbitDelta(.6,3,settings.rotationSpeed,
      Math.sign(data.spins[companion]));
    const [lx,ly]=galaxyRotate(x-cx,y-cy,delta);
    expect(Math.hypot(lx,ly)).toBeCloseTo(Math.hypot(x-cx,y-cy),5);
  });
});
