import {useEffect,useMemo,type RefObject} from 'react';
import {useFrame} from '@react-three/fiber';
import {AdditiveBlending,Color,ShaderMaterial,Vector2} from 'three';
import {nebulaDefaults,type NebulaSettings} from './nebula-settings';

/** Fullscreen GPU gas layer: a single fixed-cost draw call, no textures or
 * particle allocations. Draw as an early opaque-queue blended pass so actual
 * 3D objects remain in front (a transparent queue would cover solids). */
const vertexShader=String.raw`
varying vec2 vUv;
void main(){
  vUv=uv;
  gl_Position=vec4(position.xy,0.999,1.0);
}`;
const fragmentShader=String.raw`
precision mediump float;
varying vec2 vUv;
uniform vec3 uA,uB,uC;
uniform float uAspect,uTime,uDensity,uBrightness,uGlow,uOpacity;
uniform float uScale,uNoise,uSwirl,uThickness,uLow;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise2(vec2 p){
  vec2 i=floor(p),f=fract(p);
  f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),
    mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);
}
float fbm(vec2 p){
  float v=0.0,a=0.5;
  for(int i=0;i<3;i++){
    if(i==2 && uLow>0.5)break;
    v+=a*noise2(p);
    p=p*2.03+vec2(3.13,7.17);
    a*=0.5;
  }
  return v;
}
void main(){
  vec2 p=(vUv-.5)*vec2(uAspect,1.0);
  float radius=length(p);
  float angle=atan(p.y,p.x)+uSwirl*.015*radius;
  vec2 warped=vec2(cos(angle),sin(angle))*radius;
  warped*=3.0/max(.2,uScale);
  warped+=vec2(uTime*.045,-uTime*.025);
  float n=fbm(warped*(1.2+uNoise*.016));
  float n2=fbm(warped*1.45+vec2(5.31,1.79)-uTime*.026);
  float cloud=smoothstep(.26,.71,n*.83+n2*.40);
  float ring=1.0-smoothstep(.12,.72+uThickness*.004,radius);
  float filaments=smoothstep(.31,.74,n2)*ring;
  float haze=cloud*ring*(.65+uDensity*.012);
  float alpha=clamp((haze+filaments*.18)*uOpacity*.008,0.0,.68);
  vec3 tint=mix(uA,uB,smoothstep(.25,.85,n));
  tint=mix(tint,uC,clamp(n2*.7,0.0,.62));
  vec3 outputColor=tint*(.45+uBrightness*.006)*(.70+uGlow*.006);
  gl_FragColor=vec4(outputColor,alpha);
}`;

export function NebulaLayer({settings,seconds,low}:{
  settings?:NebulaSettings;
  seconds:RefObject<number>;
  low:boolean;
}){
  const nebula=settings??nebulaDefaults;
  const material=useMemo(()=>new ShaderMaterial({
    vertexShader,fragmentShader,
    transparent:false,blending:AdditiveBlending,
    depthTest:false,depthWrite:false,toneMapped:false,
    uniforms:{
      uA:{value:new Color()},uB:{value:new Color()},uC:{value:new Color()},
      uAspect:{value:1},uTime:{value:0},
      uDensity:{value:0},uBrightness:{value:0},uGlow:{value:0},uOpacity:{value:0},
      uScale:{value:1},uNoise:{value:0},uSwirl:{value:0},uThickness:{value:0},
      uLow:{value:0},
    },
  }),[]);
  const bufferSize=useMemo(()=>new Vector2(),[]);
  useEffect(()=>()=>material.dispose(),[material]);
  // Update uniforms without recreating the shader or material while sliders
  // move. Captures use the shared playhead, so paused and exported frames match.
  useFrame(({gl},_delta)=>{
    const m=material.uniforms;
    const size=gl.getDrawingBufferSize(bufferSize);
    m.uAspect.value=Math.max(.1,size.x/Math.max(1,size.y));
    m.uTime.value=nebula.animation?seconds.current*nebula.driftSpeed:0;
    m.uLow.value=low?1:0;
  });
  const uniforms=material.uniforms;
  uniforms.uA.value.set(nebula.colorA);uniforms.uB.value.set(nebula.colorB);
  uniforms.uC.value.set(nebula.colorC);
  uniforms.uDensity.value=nebula.density;uniforms.uBrightness.value=nebula.brightness;
  uniforms.uGlow.value=nebula.glow;uniforms.uOpacity.value=nebula.opacity;
  uniforms.uScale.value=nebula.scale;uniforms.uNoise.value=nebula.noise;
  uniforms.uSwirl.value=nebula.swirl;uniforms.uThickness.value=nebula.thickness;
  return <mesh frustumCulled={false} renderOrder={-900} material={material}>
    <planeGeometry args={[2,2]}/>
  </mesh>;
}
