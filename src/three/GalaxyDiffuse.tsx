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
  // 3:ring 4:elliptical 5:irregular 6:interacting.
  // Separate morphology functions are vital: a ring should NOT inherit
  // luminous spiral arms from the default galaxy.
  if(galaxyType>2.5&&galaxyType<3.5){
    float ring=exp(-.5*pow((r-extraA.x)/max(.04,extraA.y),2.));
    float knots=.73+.27*noise(p*24.0+orientation);
    float disk=.16*exp(-r*3.0),bulge=.26*exp(-pow(r/.13,1.8));
    float glow=ring*knots*(1.-smoothstep(.98,1.21,r));
    return vec4(bulgeColor*bulge+diskColor*disk+youngColor*glow*.92+
      hiiColor*glow*.12,clamp(glow*.69+bulge*.68+disk*.45,0.,.94));
  }
  if(galaxyType>3.5&&galaxyType<4.5){
    float q=length(vec2(p.x,p.y/max(.16,1.-extraA.z*.78)));
    float bulge=exp(-pow(q/.40,1.32))*(.77+.24*coreGlow);
    float halo=exp(-pow(q/.76,1.65))*.16;
    return vec4(bulgeColor*bulge*.88+diskColor*halo*.60,
      clamp(bulge*.76+halo*.5,0.,.91));
  }
  if(galaxyType>4.5&&galaxyType<5.5){
    float clouds=0.;
    for(int i=0;i<12;i++){
      float k=float(i);
      vec2 anchor=vec2(hash(vec2(k+orientation*7.,2.))-.5,
        hash(vec2(7.,k+orientation*4.))-.5)*vec2(1.55,1.16);
      float scale=mix(.07,.23,hash(vec2(k,orientation+4.)));
      float d=length((p-anchor)/scale);
      clouds+=exp(-d*d*1.2);
    }
    clouds=min(1.4,clouds)*(.58+.36*noise(p*28.+vec2(orientation,1.)));
    float warm=clouds*max(.10,.39*(1.-extraB.y));
    return vec4(diskColor*warm+youngColor*clouds*.73+
      hiiColor*clouds*max(.1,extraB.y)*.26,
      clamp(clouds*.45,0.,.80));
  }
  if(galaxyType>5.5){
    float gap=extraB.z,companion=max(.25,extraB.w);
    vec2 first=p-vec2(-gap*.36,-.12);
    vec2 second=(p-vec2(gap*.60,.10))/companion;
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
    tail*=tidalStrength;
    return vec4(bulgeColor*(ga*.76+gb*.62)+diskColor*(ga*.23+gb*.17+tail*.37)+
      youngColor*(armsA*.66+armsB*.35+tail*.24),
      clamp(ga*.64+gb*.62+armsA*.36+armsB*.28+tail*.20,0.,.92));
  }
  float edge=1.0-smoothstep(0.93,1.16,r);
  float angle=atan(p.y,p.x)-handed*uTime*uRotationSpeed*.055;
  float rSafe=max(mix(.145,.25,barred),r);
  float winding=handed*(1.65+twist*.35)*log(rSafe/mix(.145,.25,barred));
  float armsBrightness=0.0;
  float lane=0.0;
  for(int j=0;j<8;j++){
    if(float(j)<arms){
      float a=float(j);
      float feather=.065*sin(rSafe*19.0+a*3.4+orientation)+
        .027*sin(rSafe*44.0+a*2.7);
      float spine=orientation+TAU*a/arms+winding+feather;
      float gap=abs(angleDelta(angle,spine));
      float sw=(.17+r*.29)*width;
      armsBrightness=max(armsBrightness,exp(-.58*pow(gap/max(sw,.02),2.)));
      float dustCenter=spine+handed*(.095+.025*r);
      float d=abs(angleDelta(angle,dustCenter));
      lane=max(lane,exp(-pow(d/max((.030+.028*r)*width,.012),2.)));
    }
  }
  float broadNoise=noise(p*15.0+vec2(orientation,1.7));
  float fineNoise=noise(p*37.0+vec2(1.3,orientation));
  float disk=exp(-r*1.76)*edge*(.88+.37*broadNoise);
  float arm=armsBrightness*edge*smoothstep(.10,.24,r)*
    (.54+.37*broadNoise+.19*fineNoise);
  if(galaxyType>1.5&&galaxyType<2.5){
    // Flocculent galaxies: scattered bright segments, not two smooth ribbons.
    float patches=noise(p*(6.8+extraA.w*4.)+vec2(orientation,2.));
    float spurs=noise(p*(13.+extraB.x*7.)+vec2(4.,orientation));
    // Keep the clumpy structure soft: sharp high-frequency thresholds
    // make a galaxy look like a square Minecraft pixel texture.
    arm=arm*(.13+.82*smoothstep(.20,.80,patches))*(.65+.26*spurs)+
      smoothstep(.67,.91,spurs)*.10*exp(-r*1.8);
  }
  float obscuration=lane*(dust/60.0)*.54*(.68+.32*broadNoise)*step(.16,r);
  arm*=1.0-obscuration;
  disk*=1.0-obscuration*.48;
  float nucleus=exp(-pow(r/.136,1.65))*(.48+.44*coreGlow);
  float oldStars=exp(-pow(r/.31,1.85))*(.27+.17*coreGlow);
  float bulge=nucleus+oldStars;
  if(barred>0.5){
    vec2 q=vec2(dot(p,vec2(cos(orientation),sin(orientation))),
      dot(p,vec2(-sin(orientation),cos(orientation))));
    float barStrength=galaxyType>.5&&galaxyType<1.5?.73:.16;
    bulge+=exp(-pow(length(q/vec2(.35,.062)),1.6))*barStrength;
  }
  float hii=smoothstep(.70,.90,noise(p*24.0+vec2(orientation,2.3)))*arm*.9;
  float alpha=clamp(bulge*.78+disk*.55+arm*.50+hii*.12,0.0,.93);
  vec3 rgb=bulgeColor*(bulge*1.22)+diskColor*(disk*.88)+
    youngColor*(arm*.94)+hiiColor*(hii*.56);
  // The dusty lanes dim the disk; without this the overlaid soft disk
  // would wash out the dark, trailing arm detail.
  rgb*=1.0-obscuration*.29;
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
export function GalaxyDiffuse({seed,options,seconds,animation,morph,morphDuration}:{
  seed:string;options:GalaxySettings;seconds:RefObject<number>;
  animation:boolean;morph:RefObject<boolean>;morphDuration:RefObject<number>;
}){
  const now=useMemo(()=>appearance(seed,options),[
    seed,options.palette,options.arms,options.twist,options.armWidth,
    options.dust,options.barred,options.coreGlow,options.galaxyType,
    options.ringRadius,options.ringWidth,options.ellipticity,options.clumpiness,
    options.branchiness,options.irregularity,options.companionDistance,
    options.companionSize,options.tidalStrength,
  ]);
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
    uniforms.uRadius.value=options.radius;
    uniforms.uMorph.value=phase;
    uniforms.uEntrance.value=!animation&&time===0?1:galaxyMorphEasing(time/2.6);
    if(phase>=1)old.current=now;
  });
  return <mesh name="galaxy-diffuse-light" position={[0,0,-.13]} renderOrder={0} frustumCulled={false}>
    <planeGeometry args={[options.radius*2.5,options.radius*2.5]}/>
    <shaderMaterial vertexShader={vertexShader} fragmentShader={fragmentShader} uniforms={uniforms}
      transparent depthWrite={false} depthTest={false} side={DoubleSide} blending={AdditiveBlending}/>
  </mesh>;
}
