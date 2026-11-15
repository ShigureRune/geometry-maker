import {useLayoutEffect,useMemo,useRef,type RefObject} from 'react';
import {useFrame} from '@react-three/fiber';
import {AdditiveBlending,Vector3} from 'three';
import {galaxyAppearance,galaxyMorphEasing,type GalaxySettings} from './galaxy';

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
uniform float uOldOrientation,uOldHanded,uOldArms,uOldTwist,uOldWidth,uOldDust,uOldBar,uOldCore;
uniform vec3 uOldBulge,uOldDisk,uOldYoung,uOldHii;
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
vec4 galaxyLight(vec2 p,float orientation,float handed,float arms,float twist,
  float width,float dust,float barred,float coreGlow,
  vec3 bulgeColor,vec3 diskColor,vec3 youngColor,vec3 hiiColor){
  float r=length(p);
  if(r>1.19)return vec4(0.);
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
      float sw=(.095+r*.205)*width;
      armsBrightness=max(armsBrightness,exp(-.72*pow(gap/max(sw,.02),2.)));
      float dustCenter=spine+handed*(.095+.025*r);
      float d=abs(angleDelta(angle,dustCenter));
      lane=max(lane,exp(-pow(d/max((.030+.028*r)*width,.012),2.)));
    }
  }
  float broadNoise=noise(p*15.0+vec2(orientation,1.7));
  float fineNoise=noise(p*37.0+vec2(1.3,orientation));
  float disk=exp(-r*2.05)*edge*(.80+.40*broadNoise);
  float arm=armsBrightness*edge*smoothstep(.10,.24,r)*
    (.62+.36*broadNoise+.20*fineNoise);
  float obscuration=lane*(dust/60.0)*.72*step(.16,r);
  arm*=1.0-obscuration;
  disk*=1.0-obscuration*.48;
  float bulge=exp(-pow(r/.142,1.65))*(.64+.65*coreGlow);
  if(barred>0.5){
    vec2 q=vec2(dot(p,vec2(cos(orientation),sin(orientation))),
      dot(p,vec2(-sin(orientation),cos(orientation))));
    bulge+=exp(-pow(length(q/vec2(.29,.070)),1.6))*.16;
  }
  float hii=smoothstep(.70,.90,noise(p*24.0+vec2(orientation,2.3)))*arm*.9;
  float alpha=clamp(bulge*.76+disk*.31+arm*.62+hii*.13,0.0,.94);
  vec3 rgb=bulgeColor*(bulge*1.7)+diskColor*(disk*.48)+
    youngColor*(arm*1.24)+hiiColor*(hii*.62);
  // The dusty lanes dim the disk; without this the overlaid soft disk
  // would wash out the dark, trailing arm detail.
  rgb*=1.0-obscuration*.23;
  return vec4(rgb,alpha);
}
void main(){
  vec2 p=vLocal/max(.001,uRadius);
  vec4 current=galaxyLight(p,uOrientation,uHanded,uArms,uTwist,
    uWidth,uDust,uBar,uCore,uBulge,uDisk,uYoung,uHii);
  if(uMorph<.999){
    vec4 previous=galaxyLight(p,uOldOrientation,uOldHanded,uOldArms,uOldTwist,
      uOldWidth,uOldDust,uOldBar,uOldCore,uOldBulge,uOldDisk,uOldYoung,uOldHii);
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
    barred:options.barred,coreGlow:options.coreGlow};
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
    options.dust,options.barred,options.coreGlow,
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
    uOldOrientation:{value:0},uOldHanded:{value:1},uOldArms:{value:2},
    uOldTwist:{value:1.5},uOldWidth:{value:1.25},
    uOldDust:{value:35},uOldBar:{value:0},uOldCore:{value:.75},
    uOldBulge:{value:new Vector3()},uOldDisk:{value:new Vector3()},
    uOldYoung:{value:new Vector3()},uOldHii:{value:new Vector3()},
  }),[]);
  useLayoutEffect(()=>{
    if(lastSeed.current!==seed){
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
      }
    }
    assign('old',old.current);
    assign('now',now);
    if(!morph.current)old.current=now;
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
      transparent depthWrite={false} depthTest={false} side={2} blending={AdditiveBlending}/>
  </mesh>;
}
