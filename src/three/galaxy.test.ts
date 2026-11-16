import {describe,expect,it} from 'vitest';
import {
  GALAXY_TYPES,GALAXY_LOW_STAR_LIMIT,galaxyDefaults,galaxyMorphEasing,
  generateGalaxy,validateGalaxySettings,
} from './galaxy';
import {threeDefaults,validateThreeSettings} from './settings';
import {GALAXY_PRESETS,galaxyWithPreset} from './galaxy-presets';
import {generateGalaxyGas} from './galaxy-generators/gas';
import {generateGalaxyDetailStars} from './galaxy-generators/detail-stars';
import {generateGalaxyNucleus} from './galaxy-nucleus';

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
      {armWidth:0},{armWidth:3},{inclination:-1},{inclination:80},{barred:'yes'},{darkBackground:'bad'},
      {galaxyType:'banana'},{ringRadius:1},{ringWidth:0},{ellipticity:2},{clumpiness:-1},
      {branchiness:2},{irregularity:5},{companionDistance:5},{companionSize:2},{tidalStrength:2}]){
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
  it('connects the old warm nucleus to inner spiral arms without a black gap',()=>{
    const settings={...galaxyDefaults,count:12000};
    const galaxy=generateGalaxy('inner-arm-detail',settings,false);
    const start=Math.floor(galaxy.count*(.105+.305+.12));
    const end=galaxy.count-Math.floor(galaxy.count*(.025+settings.dust/60*.055));
    let inner=0;
    for(let i=start;i<end;i++){
      const r=Math.hypot(galaxy.positions[i*3],galaxy.positions[i*3+1])/settings.radius;
      if(r>.12&&r<.32)inner++;
    }
    expect(inner/(end-start)).toBeGreaterThan(.065);
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
  it('supports all seven deterministic, visibly distinct galaxy morphologies',()=>{
    const results=GALAXY_TYPES.map(galaxyType=>{
      const settings={...galaxyDefaults,galaxyType,count:5000};
      const first=generateGalaxy('seven-types',settings,false);
      const repeat=generateGalaxy('seven-types',settings,false);
      const alternate=generateGalaxy('seven-types-other',settings,false);
      expect(first.count).toBe(5000);
      expect(first.positions).toEqual(repeat.positions);
      expect(first.colors).toEqual(repeat.colors);
      expect(first.positions).not.toEqual(alternate.positions);
      expect(Array.from(first.positions).every(Number.isFinite)).toBe(true);
      expect(Array.from(first.opacities).every(x=>Number.isFinite(x)&&x>=0&&x<=1)).toBe(true);
      return first.positions;
    });
    for(let i=0;i<results.length;i++)for(let j=i+1;j<results.length;j++)
      expect(results[i]).not.toEqual(results[j]);
  });
  it('ring creates a radius-concentrated annulus and elliptical galaxy has a flattened envelope',()=>{
    const ring=generateGalaxy('ring-proof',{...galaxyDefaults,galaxyType:'ring',count:12000},false);
    const radii=Array.from({length:ring.count},(_,i)=>Math.hypot(ring.positions[i*3],ring.positions[i*3+1])/galaxyDefaults.radius);
    expect(radii.filter(r=>Math.abs(r-galaxyDefaults.ringRadius)<.20).length/ring.count).toBeGreaterThan(.65);
    const ellipse=generateGalaxy('ellipse-proof',{...galaxyDefaults,galaxyType:'elliptical',count:8000,ellipticity:.75},false);
    let xx=0,yy=0;
    for(let i=0;i<ellipse.count;i++){xx+=ellipse.positions[i*3]**2;yy+=ellipse.positions[i*3+1]**2;}
    expect(Math.sqrt(yy/xx)).toBeLessThan(.65);
  });
  it('the interacting galaxy has spatially separate components plus extended tidal material',()=>{
    const pair=generateGalaxy('pair-proof',{...galaxyDefaults,galaxyType:'interacting',count:10000},false);
    const xs=Array.from({length:pair.count},(_,i)=>pair.positions[i*3]/galaxyDefaults.radius);
    expect(xs.filter(x=>x<-.18).length).toBeGreaterThan(1000);
    expect(xs.filter(x=>x>.4).length).toBeGreaterThan(1000);
    expect(xs.filter(x=>Math.abs(x)>.85).length).toBeGreaterThan(20);
  });
  it('preset selection preserves shared options, type and enabled state',()=>{
    expect(Object.keys(GALAXY_PRESETS).length).toBeGreaterThanOrEqual(7);
    for(const [id,preset] of Object.entries(GALAXY_PRESETS)){
      const result=galaxyWithPreset({...galaxyDefaults,count:20000,darkBackground:false},id as keyof typeof GALAXY_PRESETS);
      expect(result.galaxyType).toBe(preset.type);
      expect(result.enabled).toBe(true);
      expect(result.count).toBe(20000);
      expect(result.darkBackground).toBe(false);
      expect(validateGalaxySettings(result)).toEqual(result);
    }
  });
  it('v3 project without the new galaxy-type fields opens as grand design',()=>{
    const old={...galaxyDefaults} as Partial<typeof galaxyDefaults>;
    for(const key of ['galaxyType','ringRadius','ringWidth','ellipticity','clumpiness',
      'branchiness','irregularity','companionDistance','companionSize','tidalStrength'] as const)
      delete old[key];
    expect(validateGalaxySettings(old)).toEqual(galaxyDefaults);
  });
  it('generates genuine 3D gas cloudlets instead of a flat 2D disk for every type',()=>{
    for(const galaxyType of GALAXY_TYPES){
      const settings={...galaxyDefaults,galaxyType,count:6000};
      const stars=generateGalaxy('gas-depth',settings,true);
      const gas=generateGalaxyGas('gas-depth',settings,true,stars);
      const repeat=generateGalaxyGas('gas-depth',settings,true,stars);
      expect(gas.count).toBeGreaterThan(450);
      expect(gas.count).toBeLessThanOrEqual(1600);
      expect(gas.positions).toEqual(repeat.positions);
      expect(gas.spins).toEqual(repeat.spins);
      expect(Array.from(gas.positions).every(Number.isFinite)).toBe(true);
      const zs=Array.from({length:gas.count},(_,i)=>gas.positions[i*3+2]);
      const mean=zs.reduce((a,b)=>a+b,0)/zs.length;
      const deviation=Math.sqrt(zs.reduce((a,b)=>a+(b-mean)**2,0)/zs.length);
      // A real volumetric field has measurable thickness from edge-on.
      // A thin disk remains volumetric, but no longer needs the oversized
      // 0.09R vertical gas scatter that produced the edge-on cotton-ball fog.
      expect(deviation,galaxyType+' must have 3D depth').toBeGreaterThan(settings.radius*.015);
      expect(gas.opacities.every(x=>x>=0&&x<=1)).toBe(true);
      expect(gas.coreFactors.length).toBe(gas.count);
      expect(gas.coreFactors.every(x=>Number.isFinite(x)&&x>=0&&x<=1)).toBe(true);
      const starSpeeds=new Set(Array.from(stars.spins));
      expect(gas.spins.every(value=>starSpeeds.has(value))).toBe(true);
    }
  });
  it('restores a brightable 3D stellar nucleus without bringing back a flat disk',()=>{
    const settings={...galaxyDefaults,galaxyType:'grand_design' as const,count:12000};
    const stars=generateGalaxy('bright-3d-core',settings,false);
    const clouds=generateGalaxyGas('bright-3d-core',settings,false,stars);
    const brightable=Array.from(clouds.coreFactors).filter(x=>x>.12);
    // The old volumetric setup allocated almost all gas to spiral arms,
    // leaving the central stellar bulge black once the XY gas sheet was removed.
    // A separate unresolved 3D bulge supplies the smooth central glow;
    // fewer large gas blobs should be concentrated directly on the nucleus.
    expect(brightable.length/clouds.count).toBeGreaterThan(.08);
    const centers=Array.from({length:clouds.count},(_,i)=>
      Math.hypot(clouds.positions[i*3],clouds.positions[i*3+1])/settings.radius);
    const inner=centers.filter(x=>x<.25).length;
    // The luminous center is handled by the smooth 3D bulge, not by large
    // cloudlet billboards; keep some warm gas without the old heavy core fog.
    expect(inner/clouds.count).toBeGreaterThan(.12);
  });
  it('inherits the actual stellar positions, local rotation direction and pivots for gas',()=>{
    const settings={...galaxyDefaults,galaxyType:'interacting' as const,count:12000};
    const stars=generateGalaxy('gas-rotation',settings,false);
    const gas=generateGalaxyGas('gas-rotation',settings,false,stars);
    expect(gas.count).toBeGreaterThan(1000);
    expect(gas.count).toBeLessThanOrEqual(4200);
    const starCenters=new Set(Array.from({length:stars.count},(_,i)=>
      stars.orbitCenters![i*2].toFixed(3)+','+stars.orbitCenters![i*2+1].toFixed(3)));
    let positive=false,negative=false;
    for(let i=0;i<gas.count;i++){
      expect(starCenters.has(gas.orbitCenters[i*2].toFixed(3)+','+
        gas.orbitCenters[i*2+1].toFixed(3))).toBe(true);
      if(gas.spins[i]>0)positive=true;
      if(gas.spins[i]<0)negative=true;
    }
    expect(positive&&negative).toBe(true);
    const differentSeed=generateGalaxy('different',settings,false);
    expect(generateGalaxyGas('different',settings,false,differentSeed).positions)
      .not.toEqual(gas.positions);
  });
  it('distributes 3D gas along the arms instead of stamping repeated clumps',()=>{
    const settings={...galaxyDefaults,galaxyType:'grand_design' as const,count:12000};
    const stars=generateGalaxy('gas-blobs-regression',settings,false);
    const gas=generateGalaxyGas('gas-blobs-regression',settings,false,stars);
    // Previous code reused each star anchor for 3-13 consecutive cloud
    // billboards, causing grape-like clusters and a lumpy bright nucleus.
    let distance=0;
    for(let i=1;i<gas.count;i++){
      const p=i*3,q=(i-1)*3;
      distance+=Math.hypot(gas.positions[p]-gas.positions[q],
        gas.positions[p+1]-gas.positions[q+1]);
    }
    expect(distance/(gas.count-1)).toBeGreaterThan(settings.radius*.40);
    expect(Math.max(...gas.sizes)).toBeLessThan(18);
    expect(gas.count).toBeGreaterThan(2000);
    const nonCoreHeights=Array.from({length:gas.count},(_,i)=>i)
      .filter(i=>gas.coreFactors[i]<.01)
      .map(i=>Math.abs(gas.positions[i*3+2]))
      .sort((a,b)=>a-b);
    expect(nonCoreHeights[Math.floor(nonCoreHeights.length*.9)])
      .toBeLessThan(settings.radius*.09);
    expect(Math.max(...gas.opacities)).toBeLessThan(.27);
  });
  it('maintains deterministic, fine resolved stars on extreme camera zoom',()=>{
    const settings={...galaxyDefaults,count:12000};
    const galaxy=generateGalaxy('zoom-fine-structure',settings,false);
    const detail=generateGalaxyDetailStars('zoom-fine-structure',settings,false,galaxy);
    const repeat=generateGalaxyDetailStars('zoom-fine-structure',settings,false,galaxy);
    expect(detail.count).toBeGreaterThan(galaxy.count*4);
    expect(detail.count).toBeLessThanOrEqual(65000);
    // A substantial near-bulge population must survive zoom. Do not just
    // raise global exposure, which previously washed out spiral-arm colors.
    const parentBulge=Array.from(galaxy.cores).filter(x=>x>0).length;
    expect(parentBulge/galaxy.count).toBeGreaterThan(.125);
    const innerCount=Array.from({length:detail.count},(_,i)=>i).filter(i=>{
      const cx=detail.orbitCenters[2*i],cy=detail.orbitCenters[2*i+1];
      const radius=Math.hypot(detail.positions[3*i]-cx,
        detail.positions[3*i+1]-cy)/settings.radius;
      return radius>.08&&radius<.32;
    }).length;
    expect(innerCount/detail.count,'star density around the bulge should be high')
      .toBeGreaterThan(.29);
    expect(innerCount/detail.count,'avoid replacing the entire outer disk')
      .toBeLessThan(.50);
    expect(detail.positions).toEqual(repeat.positions);
    expect(detail.colors).toEqual(repeat.colors);
    expect(Math.min(...detail.sizes)).toBeGreaterThanOrEqual(.63);
    expect(Math.max(...detail.sizes)).toBeLessThan(1.41);
    expect(detail.opacities.every(x=>x>=0&&x<=.66)).toBe(true);
    expect(detail.highlights).toEqual(repeat.highlights);
    const highlightCount=Array.from(detail.highlights).filter(x=>x===1).length;
    expect(highlightCount).toBeGreaterThan(detail.count*.07);
    expect(highlightCount).toBeLessThan(detail.count*.25);
    const strong=Array.from(detail.opacities).filter(v=>v>.40).length;
    const faint=Array.from(detail.opacities).filter(v=>v<.27).length;
    expect(strong,'some individually bright stars remain').toBeGreaterThan(500);
    expect(faint,'most stars must remain faint to preserve arm colors')
      .toBeGreaterThan(strong*3);
    const allowedSpins=new Set(galaxy.spins);
    expect(detail.spins.every(s=>allowedSpins.has(s))).toBe(true);
    const highZ=Array.from({length:detail.count},(_,i)=>detail.positions[i*3+2]);
    expect(highZ.some(z=>Math.abs(z)>.001)).toBe(true);
    const minRadial=Math.min(...Array.from({length:detail.count},(_,i)=>
      Math.hypot(detail.positions[i*3],detail.positions[i*3+1])));
    expect(minRadial,'keep the tiny unresolved nucleus smooth')
      .toBeGreaterThan(settings.radius*.077);
    const innerRim=Array.from({length:detail.count},(_,i)=>i).filter(i=>{
      const r=Math.hypot(detail.positions[i*3],detail.positions[i*3+1])/settings.radius;
      return r>.10&&r<.20&&detail.opacities[i]>.01;
    }).length;
    expect(innerRim,'resolved stars must surround the smooth nucleus')
      .toBeGreaterThan(1000);
    const mobile=generateGalaxy('zoom-fine-structure',settings,true);
    const mobileDetails=generateGalaxyDetailStars('zoom-fine-structure',settings,true,mobile);
    expect(mobileDetails.count).toBeLessThanOrEqual(16000);
    expect(mobileDetails.count).toBeGreaterThan(10000);
  });
  it('uses each interacting nucleus as the correct nearby star orbit pivot',()=>{
    const settings={...galaxyDefaults,galaxyType:'interacting' as const,count:9000};
    const galaxy=generateGalaxy('zoom-twin-cores',settings,false);
    const detail=generateGalaxyDetailStars('zoom-twin-cores',settings,false,galaxy);
    const parentPivots=new Set(Array.from({length:galaxy.count},(_,i)=>
      galaxy.orbitCenters![i*2].toFixed(4)+','+galaxy.orbitCenters![i*2+1].toFixed(4)));
    const localPivots=new Set(Array.from({length:detail.count},(_,i)=>{
      const pivot=detail.orbitCenters[i*2].toFixed(4)+','+
        detail.orbitCenters[i*2+1].toFixed(4);
      expect(parentPivots.has(pivot)).toBe(true);
      return pivot;
    }));
    expect(localPivots.size).toBeGreaterThanOrEqual(2);
  });
  it('adds a reproducible, locally concentrated 3D hot nucleus and warm bulge',()=>{
    for(const galaxyType of GALAXY_TYPES){
      const options={...galaxyDefaults,galaxyType,count:12000};
      const stars=generateGalaxy('white-hot-nucleus',options,false);
      const data=generateGalaxyNucleus('white-hot-nucleus',options,false,stars);
      const again=generateGalaxyNucleus('white-hot-nucleus',options,false,stars);
      expect(data.count,galaxyType).toBeGreaterThan(100);
      expect(data.positions).toEqual(again.positions);
      expect(data.colors).toEqual(again.colors);
      expect(data.count).toBe(data.centers.length*520);
      expect(data.positions.every(Number.isFinite)).toBe(true);
      expect(data.opacities.every(x=>x>=0&&x<=1)).toBe(true);
      // A fivefold-wider halo must NOT use fivefold-larger additive sprites:
      // oversized billboards merge into a featureless white ball on zoom.
      expect(Math.max(...data.sizes),galaxyType+' resolves fine nuclear stars').toBeLessThan(4);
      expect(Math.min(...data.sizes),galaxyType+' retains variable star sizes').toBeLessThan(1.5);
      // The center must be a continuous, unresolved light volume rather than
      // individual white pinpricks, even when the camera moves close.
      for(let i=0;i<data.count;i++){
        const pivot=Math.floor(i/520);
        const [x,y]=data.centers[pivot];
        const radius=Math.hypot(data.positions[i*3]-x,data.positions[i*3+1]-y)/options.radius;
        if(radius<.11)expect(data.opacities[i],galaxyType+' should hide nuclear points').toBe(0);
      }
      const [cx,cy]=data.centers[0];
      const innerPinpoints=Array.from({length:520},(_,i)=>i).filter(i=>
        Math.hypot(data.positions[i*3]-cx,data.positions[i*3+1]-cy)<options.radius*.035);
      expect(innerPinpoints.length,galaxyType+' keeps a tiny bright hotspot').toBeGreaterThan(20);
      expect(data.positions.some((v,i)=>i%3===2&&Math.abs(v)>.01)).toBe(true);
      let inner=0,halo=0,far=0;
      for(let i=0;i<data.count;i++){
        const pivot=i/data.count<data.centers.length?Math.floor(i/520):0;
        const [cx,cy]=data.centers[pivot];
        const d=Math.hypot(data.positions[i*3]-cx,data.positions[i*3+1]-cy)/options.radius;
        if(d<.07)inner++;
        if(d>.075&&d<.30)halo++;
        if(d>.60)far++;
      }
      expect(inner,galaxyType+' nucleus should be concentrated').toBeGreaterThan(data.count*.025);
      expect(halo,galaxyType+' bulge should have a smooth warm envelope').toBeGreaterThan(data.count*.35);
      expect(far/data.count,galaxyType+' nucleus should not illuminate outer arms').toBeLessThan(.025);
    }
  });
  it('keeps interacting galaxies with two separate, rotating hot nuclei',()=>{
    const options={...galaxyDefaults,galaxyType:'interacting' as const,count:12000};
    const stars=generateGalaxy('dual-nucleus',options,false);
    const nuclei=generateGalaxyNucleus('dual-nucleus',options,false,stars);
    expect(nuclei.centers.length).toBe(2);
    expect(nuclei.count).toBe(1040);
    expect(Math.hypot(nuclei.centers[0][0]-nuclei.centers[1][0],
      nuclei.centers[0][1]-nuclei.centers[1][1])).toBeGreaterThan(options.radius*.5);
    expect(nuclei.spins.slice(0,520).every(x=>x===nuclei.spins[0])).toBe(true);
    expect(Math.sign(nuclei.spins[0])).toBe(-Math.sign(nuclei.spins[520]));
  });
  it('ease is seekable and exact at endpoints',()=>{
    expect(galaxyMorphEasing(-4)).toBe(0);
    expect(galaxyMorphEasing(0)).toBe(0);
    expect(galaxyMorphEasing(.5)).toBe(.5);
    expect(galaxyMorphEasing(1)).toBe(1);
    expect(galaxyMorphEasing(8)).toBe(1);
  });
});
