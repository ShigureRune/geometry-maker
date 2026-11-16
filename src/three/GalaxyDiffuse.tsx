import {useLayoutEffect,useMemo,useRef,type RefObject} from 'react';
import {useFrame} from '@react-three/fiber';
import {AdditiveBlending,DoubleSide,Vector3} from 'three';
import {GALAXY_TYPES,galaxyAppearance,galaxyMorphEasing,type GalaxySettings} from './galaxy';

const vertexShader=String.raw`
varying vec2 vLocal;
void main(){
  vLocal=position.xy;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}
`;
const fragmentShader=String.raw`
varying vec2 vLocal;
uniform float uRadius,uTime,uRotationSpeed,uEntrance,uMorph;
uniform float uOrientation,uHanded,uArms,uTwist,uWidth,uDust,uBar,uCore;
uniform vec3 uBulge,uDisk,uYoung,uHii;
uniform float uType,uTidal;
uniform vec4 uExtraA,uExtraB;
uniform float uOldOrientation,uOldHanded,uOldArms,uOldTwist,uOldWidth,uOldDust,uOldBar,uOldCore;
uniform vec3 uOldBulge,uOldDisk,uOldYoung,uOldHii;
uniform float uOldType,uOldTidal;
uniform vec4 uOldExtraA,uOldExtraB;
const float TAU=6.28318530718;
float hash(vec2 p){
  p=fract(p*vec2(123.34,345.45));
  p+=dot(p,p+34.345);
  return fract(p.x*p.y);
}
float noise(vec2 p){
  vec2 a=floor(p),f=fract(p);
  f=f*f*(3.0-2.0*f);
  return mix(mix(hash(a),hash(a+vec2(1.,0.)),f.x),
    mix(hash(a+vec2(0.,1.)),hash(a+vec2(1.,1.)),f.x),f.y);
}
float angleDelta(float a,float b){
  return atan(sin(a-b),cos(a-b));
}
// Inverse orbital advection: sampling the luminous gas at an earlier
// angle makes the rendered clouds orbit forward with the stars. All
// morphology branches must use this local coordinate, not static UVs.
vec2 counterRotate(vec2 p,float angle){
  float c=cos(angle),s=sin(angle);
  return vec2(p.x*c+p.y*s,-p.x*s+p.y*c);
}
vec2 gasOrbit(vec2 p,float handed,float time,float speed){
  float radius=length(p);
  float angularSpeed=(.025+.08/(.40+radius*1.5));
  return counterRotate(p,handed*time*speed*angularSpeed);
}
// Two additional, softly blended octaves break up the synthetic smooth
// ribbons without hard pixel edges or randomly flickering each frame.
float cloudNoise(vec2 p){
  return .54*noise(p)+.29*noise(p*2.07+vec2(3.41,7.82))+
    .17*noise(p*4.17+vec2(11.7,2.58));
}
float swirlingArm(vec2 p,float orientation,float handed,float twist,float width){
  float r=max(.17,length(p)),theta=atan(p.y,p.x);
  float peak=0.0;
  for(int j=0;j<2;j++){
    float spiral=orientation+float(j)*3.14159265+
      handed*(1.65+twist*.35)*log(r/.16);
    float d=atan(sin(theta-spiral),cos(theta-spiral));
    peak=max(peak,exp(-.68*pow(d/max(.04,width*(.11+.24*r)),2.)));
  }
  return peak*smoothstep(.12,.22,r)*(1.0-smoothstep(.93,1.20,r));
}
vec4 galaxyLight(vec2 p,float orientation,float handed,float arms,float twist,
  float width,float dust,float barred,float coreGlow,
  vec3 bulgeColor,vec3 diskColor,vec3 youngColor,vec3 hiiColor,
  float galaxyType,vec4 extraA,vec4 extraB,float tidalStrength){
  float r=length(p);
  if(r>1.25)return vec4(0.);
  // Shared gas/stellar clock. A paused scene keeps uTime fixed; PNG and
  // video export set that same clock deterministically per captured frame.
  vec2 gasP=gasOrbit(p,handed,uTime,uRotationSpeed);
  // 3:ring 4:elliptical 5:irregular 6:interacting.
  // Separate morphology functions are vital: a ring should NOT inherit
  // luminous spiral arms from the default galaxy.
  if(galaxyType>2.5&&galaxyType<3.5){
    float ring=exp(-.5*pow((r-extraA.x)/max(.04,extraA.y),2.));
    float texture=cloudNoise(gasP*12.0+vec2(orientation,3.));
    float knot=noise(gasP*36.0+vec2(2.,orientation));
    float ringWidth=max(.04,extraA.y);
    float dustArc=smoothstep(.49,.77,noise(gasP*28.0+vec2(orientation,6.)));
    float knots=.34+.83*texture;
    float disk=.14*exp(-r*3.0),bulge=.29*exp(-pow(r/.115,1.7));
    float glow=ring*knots*(1.-smoothstep(.98,1.21,r));
    glow*=1.0-(dust/60.)*.48*dustArc*exp(-pow((r-extraA.x-ringWidth*.42)/max(.03,ringWidth*.48),2.));
    float pink=glow*smoothstep(.58,.84,knot)*.55;
    return vec4(bulgeColor*(bulge*1.24)+diskColor*(disk*.70)+youngColor*glow*.95+
      hiiColor*pink*.75,clamp(glow*.72+bulge*.77+disk*.40,0.,.94));
  }
  if(galaxyType>3.5&&galaxyType<4.5){
    float q=length(vec2(p.x,p.y/max(.16,1.-extraA.z*.78)));
    // The ellipsoid stays put, but its faint stellar grain circulates.
    float grain=.87+.29*cloudNoise(gasP*17.+vec2(orientation,2.));
    float bulge=exp(-pow(q/.34,1.30))*(.82+.31*coreGlow)*grain;
    float halo=exp(-pow(q/.75,1.65))*.23;
    float nucleus=exp(-pow(q/.057,1.8))*.34;
    return vec4(bulgeColor*(bulge*.95+nucleus)+diskColor*halo*.65,
      clamp(bulge*.72+halo*.53+nucleus*.22,0.,.91));
  }
  if(galaxyType>4.5&&galaxyType<5.5){
    float clouds=0.;
    for(int i=0;i<12;i++){
      float k=float(i);
      vec2 anchor=vec2(hash(vec2(k+orientation*7.,2.))-.5,
        hash(vec2(7.,k+orientation*4.))-.5)*vec2(1.55,1.16);
      float scale=mix(.07,.23,hash(vec2(k,orientation+4.)));
      float d=length((gasP-anchor)/scale);
      clouds+=exp(-d*d*1.2);
    }
    float texture=cloudNoise(gasP*12.0+vec2(orientation,3.));
    clouds=min(1.4,clouds)*(.39+.90*texture);
    float young=clouds*(.76+.25*noise(gasP*37.+vec2(2.,orientation)));
    float pink=clouds*smoothstep(.58,.82,noise(gasP*25.+vec2(orientation,8.)));
    float warm=clouds*max(.10,.39*(1.-extraB.y));
    return vec4(diskColor*warm+youngColor*young*.80+
      hiiColor*pink*max(.2,extraB.y)*.47,
      clamp(clouds*.49+pink*.12,0.,.82));
  }
  if(galaxyType>5.5){
    float gap=extraB.z,companion=max(.25,extraB.w);
    // Each galaxy's luminous arms rotate around its OWN core; rotating
    // all gas about the midpoint would drag the companion nucleus away.
    vec2 first=gasOrbit(p-vec2(-gap*.36,-.12),handed,uTime,uRotationSpeed);
    vec2 second=gasOrbit((p-vec2(gap*.60,.10))/companion,handed,uTime,uRotationSpeed);
    float ga=exp(-pow(length(first)/.20,1.4));
    float gb=exp(-pow(length(second)/.24,1.5));
    float armsA=swirlingArm(first,orientation,handed,twist,width);
    float armsB=swirlingArm(second,orientation+2.35,-handed,twist,width);
    float tail=0.;
    for(int j=0;j<2;j++){
      float tailSide=j==0?-1.:1.;
      vec2 origin=j==0?vec2(-gap*.36,-.12):vec2(gap*.60,.10);
      float radial=length(p-origin);
      float theta=atan(p.y-origin.y,p.x-origin.x);
      float target=tailSide*(.45+radial*1.85)+orientation*.38;
      float deviation=atan(sin(theta-target),cos(theta-target));
      tail+=exp(-pow(deviation/.17,2.))*smoothstep(.35,.55,radial)*
        (1.-smoothstep(.98,1.24,radial));
    }
    // Tidal tails stay attached to their galaxies while light-bearing
    // knots flow along them instead of being frozen to screen pixels.
    float texture=cloudNoise(gasP*10.0+vec2(orientation,3.));
    tail*=tidalStrength*(.40+.87*texture);
    armsA*=.65+.60*cloudNoise(first*10.+vec2(orientation,3.));
    armsB*=.66+.54*cloudNoise(second*16.+vec2(4.,orientation));
    float coreA=exp(-pow(length(first)/.06,1.6));
    float coreB=exp(-pow(length(second)/.08,1.7));
    return vec4(bulgeColor*(ga*.71+gb*.60+coreA*.34+coreB*.24)+
      diskColor*(ga*.21+gb*.14+tail*.39)+
      youngColor*(armsA*.73+armsB*.47+tail*.34),
      clamp(ga*.60+gb*.61+armsA*.40+armsB*.30+tail*.26,0.,.92));
  }
  float edge=1.0-smoothstep(0.93,1.16,r);
  // The gas and arm dust are sampled in the same moving orbital frame.
  // Stationary p here would leave bright patches glued to the screen.
  float angle=atan(gasP.y,gasP.x);
  float rSafe=max(mix(.145,.25,barred),r);
  float winding=handed*(1.65+twist*.35)*log(rSafe/mix(.145,.25,barred));
  float armsBrightness=0.0;
  float filaments=0.0;
  float lane=0.0;
  for(int j=0;j<8;j++){
    if(float(j)<arms){
      float a=float(j);
      float feather=.065*sin(rSafe*19.0+a*3.4+orientation)+
        .027*sin(rSafe*44.0+a*2.7);
      float spine=orientation+TAU*a/arms+winding+feather;
      float gap=abs(angleDelta(angle,spine));
      float sw=(.17+r*.29)*width;
      armsBrightness=max(armsBrightness,exp(-.68*pow(gap/max(sw,.02),2.)));
      float narrow=abs(angleDelta(angle,spine+handed*(.035+.02*r)));
      filaments=max(filaments,exp(-2.55*pow(narrow/max(sw,.02),2.)));
      float dustCenter=spine+handed*(.095+.025*r);
      float d=abs(angleDelta(angle,dustCenter));
      // Two dark strands, one narrow and one diffuse, trace the luminous arm.
      lane=max(lane,.80*exp(-pow(d/max((.033+.030*r)*width,.012),2.))+
        .23*exp(-pow((d-.056)/max(.022,.052*r*width),2.)));
    }
  }
  float broadNoise=cloudNoise(gasP*11.0+vec2(orientation,1.7));
  float fineNoise=noise(gasP*42.0+vec2(1.3,orientation));
  float disk=exp(-r*1.76)*edge*(.75+.43*broadNoise);
  float arm=(armsBrightness*.68+filaments*.38)*edge*smoothstep(.10,.24,r)*
    (.23+.98*broadNoise+.16*fineNoise);
  if(galaxyType>1.5&&galaxyType<2.5){
    // Flocculent galaxies: scattered bright segments, not two smooth ribbons.
    float patches=noise(gasP*(6.8+extraA.w*4.)+vec2(orientation,2.));
    float spurs=noise(gasP*(13.+extraB.x*7.)+vec2(4.,orientation));
    // Keep the clumpy structure soft: sharp high-frequency thresholds
    // make a galaxy look like a square Minecraft pixel texture.
    arm=arm*(.13+.82*smoothstep(.20,.80,patches))*(.65+.26*spurs)+
      smoothstep(.67,.91,spurs)*.10*exp(-r*1.8);
  }
  float obscuration=clamp(lane*(dust/60.0)*(.92+.23*broadNoise),0.,.94)*
    smoothstep(.15,.23,r);
  arm*=1.0-obscuration*.82;
  disk*=1.0-obscuration*.80;
  float nucleus=exp(-pow(r/.103,1.7))*(.56+.52*coreGlow);
  float oldStars=exp(-pow(r/.31,1.85))*(.25+.17*coreGlow)*
    (.94+.09*broadNoise);
  float bulge=nucleus+oldStars;
  if(barred>0.5){
    vec2 q=vec2(dot(gasP,vec2(cos(orientation),sin(orientation))),
      dot(gasP,vec2(-sin(orientation),cos(orientation))));
    float barStrength=galaxyType>.5&&galaxyType<1.5?.73:.16;
    bulge+=exp(-pow(length(q/vec2(.35,.062)),1.6))*barStrength;
  }
  float hii=arm*smoothstep(.65,.87,
    mix(noise(gasP*28.0+vec2(orientation,2.3)),broadNoise,.24));
  float alpha=clamp(bulge*.73+disk*.53+arm*.59+hii*.30,0.0,.93);
  vec3 rgb=bulgeColor*(bulge*1.20)+diskColor*(disk*.86)+
    youngColor*(arm*1.08)+hiiColor*(hii*.92);
  // A Hubble-like dark dust lane is a local loss of starlight, not a
  // painted black line. This is a low-cost opacity approximation.
  rgb*=1.0-obscuration*.47;
  return vec4(rgb,alpha);
}
void main(){
  vec2 p=vLocal/max(.001,uRadius);
  vec4 current=galaxyLight(p,uOrientation,uHanded,uArms,uTwist,
    uWidth,uDust,uBar,uCore,uBulge,uDisk,uYoung,uHii,uType,uExtraA,uExtraB,uTidal);
  if(uMorph<.999){
    vec4 previous=galaxyLight(p,uOldOrientation,uOldHanded,uOldArms,uOldTwist,
      uOldWidth,uOldDust,uOldBar,uOldCore,uOldBulge,uOldDisk,uOldYoung,uOldHii,
      uOldType,uOldExtraA,uOldExtraB,uOldTidal);
    current=mix(previous,current,uMorph);
  }
  current.a*=uEntrance;
  if(current.a<.006)discard;
  gl_FragColor=current;
}
`;

type Appearance=ReturnType<typeof appearance>;
function appearance(seed:string,options:GalaxySettings){
  const structure=galaxyAppearance(seed,options.palette);
  return {...structure,arms:options.arms,twist:options.twist,
    armWidth:options.armWidth,dust:options.dust,
    barred:options.galaxyType==='barred_spiral'||options.barred,coreGlow:options.coreGlow,
    galaxyType:options.galaxyType,ringRadius:options.ringRadius,ringWidth:options.ringWidth,
    ellipticity:options.ellipticity,clumpiness:options.clumpiness,
    branchiness:options.branchiness,irregularity:options.irregularity,
    companionDistance:options.companionDistance,companionSize:options.companionSize,
    tidalStrength:options.tidalStrength};
}
const color=(rgb:readonly number[])=>new Vector3(rgb[0],rgb[1],rgb[2]);

/** A continuous, translucent disk behind the 3D stars.
 * Individual Points alone cannot make the dense luminous arms visible
 * at mobile resolution or at exported HD resolutions. */
export function GalaxyDiffuse({seed,options,seconds,animation,morph,morphDuration,progressHost}:{
  seed:string;options:GalaxySettings;seconds:RefObject<number>;
  animation:boolean;morph:RefObject<boolean>;morphDuration:RefObject<number>;
  progressHost?:RefObject<HTMLDivElement|null>;
}){
  const now=useMemo(()=>appearance(seed,options),[
    seed,options.palette,options.arms,options.twist,options.armWidth,
    options.dust,options.barred,options.coreGlow,options.galaxyType,
    options.ringRadius,options.ringWidth,options.ellipticity,options.clumpiness,
    options.branchiness,options.irregularity,options.companionDistance,
    options.companionSize,options.tidalStrength,
  ]);
  const material=useRef<ShaderMaterial>(null);
  const old=useRef(now);
  const lastSeed=useRef(seed);
  const uniforms=useMemo(()=>({
    uTime:{value:0},uRotationSpeed:{value:0},
    uRadius:{value:5.5},uEntrance:{value:1},uMorph:{value:1},
    uOrientation:{value:0},uHanded:{value:1},uArms:{value:2},
    uTwist:{value:1.5},uWidth:{value:1.25},
    uDust:{value:35},uBar:{value:0},uCore:{value:.75},
    uBulge:{value:new Vector3()},uDisk:{value:new Vector3()},
    uYoung:{value:new Vector3()},uHii:{value:new Vector3()},
    uType:{value:GALAXY_TYPES.indexOf(options.galaxyType)},uExtraA:{value:[.64,.12,.42,.68]},uExtraB:{value:[.55,.7,.9,.45]},uTidal:{value:.65},
    uOldOrientation:{value:0},uOldHanded:{value:1},uOldArms:{value:2},
    uOldTwist:{value:1.5},uOldWidth:{value:1.25},
    uOldDust:{value:35},uOldBar:{value:0},uOldCore:{value:.75},
    uOldBulge:{value:new Vector3()},uOldDisk:{value:new Vector3()},
    uOldYoung:{value:new Vector3()},uOldHii:{value:new Vector3()},
    uOldType:{value:GALAXY_TYPES.indexOf(options.galaxyType)},uOldExtraA:{value:[.64,.12,.42,.68]},
    uOldExtraB:{value:[.55,.7,.9,.45]},uOldTidal:{value:.65},
  }),[]);
  useLayoutEffect(()=>{
    const changedSeed=lastSeed.current!==seed;
    if(changedSeed){
      // Retain the PREVIOUS luminous disk until the shared particle
      // morph clock has finished, rather than popping instantly.
      lastSeed.current=seed;
    }else if(!morph.current)old.current=now;
    function assign(prefix:'old'|'now',value:Appearance){
      if(prefix==='old'){
        uniforms.uOldOrientation.value=value.orientation;
        uniforms.uOldHanded.value=value.handed;
        uniforms.uOldArms.value=value.arms;
        uniforms.uOldTwist.value=value.twist;
        uniforms.uOldWidth.value=value.armWidth;
        uniforms.uOldDust.value=value.dust;
        uniforms.uOldBar.value=value.barred?1:0;
        uniforms.uOldCore.value=value.coreGlow/100;
        uniforms.uOldBulge.value.copy(color(value.colors.bulge));
        uniforms.uOldDisk.value.copy(color(value.colors.disk));
        uniforms.uOldYoung.value.copy(color(value.colors.young));
        uniforms.uOldHii.value.copy(color(value.colors.hii));
        uniforms.uOldType.value=GALAXY_TYPES.indexOf(value.galaxyType);
        uniforms.uOldExtraA.value=[value.ringRadius,value.ringWidth,value.ellipticity,value.clumpiness];
        uniforms.uOldExtraB.value=[value.branchiness,value.irregularity,value.companionDistance,value.companionSize];
        uniforms.uOldTidal.value=value.tidalStrength;
      }else{
        uniforms.uOrientation.value=value.orientation;
        uniforms.uHanded.value=value.handed;
        uniforms.uArms.value=value.arms;
        uniforms.uTwist.value=value.twist;
        uniforms.uWidth.value=value.armWidth;
        uniforms.uDust.value=value.dust;
        uniforms.uBar.value=value.barred?1:0;
        uniforms.uCore.value=value.coreGlow/100;
        uniforms.uBulge.value.copy(color(value.colors.bulge));
        uniforms.uDisk.value.copy(color(value.colors.disk));
        uniforms.uYoung.value.copy(color(value.colors.young));
        uniforms.uHii.value.copy(color(value.colors.hii));
        uniforms.uType.value=GALAXY_TYPES.indexOf(value.galaxyType);
        uniforms.uExtraA.value=[value.ringRadius,value.ringWidth,value.ellipticity,value.clumpiness];
        uniforms.uExtraB.value=[value.branchiness,value.irregularity,value.companionDistance,value.companionSize];
        uniforms.uTidal.value=value.tidalStrength;
      }
    }
    assign('old',old.current);
    assign('now',now);
    if(!changedSeed&&!morph.current)old.current=now;
  },[seed,now,uniforms,morph]);
  useFrame(()=>{
    const time=seconds.current;
    const phase=morph.current?galaxyMorphEasing(time/Math.max(.001,morphDuration.current)):1;
    uniforms.uTime.value=time;
    uniforms.uRotationSpeed.value=options.rotationSpeed;
    // Write directly to the mounted Three.js material as well: this is
    // the authoritative GPU uniform container during demand rendering.
    if(material.current){
      material.current.uniforms.uTime.value=time;
      material.current.uniforms.uRotationSpeed.value=options.rotationSpeed;
    }
    if(progressHost?.current){
      progressHost.current.dataset.galaxyGasTime=time.toFixed(3);
      progressHost.current.dataset.galaxyGasSpeed=options.rotationSpeed.toFixed(2);
      progressHost.current.dataset.galaxyGasMaterialTime=
        Number(material.current?.uniforms.uTime.value??-1).toFixed(3);
    }
    uniforms.uRadius.value=options.radius;
    uniforms.uMorph.value=phase;
    uniforms.uEntrance.value=!animation&&time===0?1:galaxyMorphEasing(time/2.6);
    if(phase>=1)old.current=now;
  });
  return <mesh name="galaxy-diffuse-light" position={[0,0,-.13]} renderOrder={0} frustumCulled={false}>
    <planeGeometry args={[options.radius*2.5,options.radius*2.5]}/>
    <shaderMaterial ref={material} vertexShader={vertexShader} fragmentShader={fragmentShader} uniforms={uniforms}
      transparent depthWrite={false} depthTest={false} side={DoubleSide} blending={AdditiveBlending}/>
  </mesh>;
}
