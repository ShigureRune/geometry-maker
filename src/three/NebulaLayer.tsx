import {useEffect,useMemo,type RefObject} from 'react';
import {useFrame} from '@react-three/fiber';
import {AdditiveBlending,BufferAttribute,BufferGeometry,Color,ShaderMaterial,Vector2} from 'three';
import {nebulaDefaults,type NebulaSettings} from './nebula-settings';
import {generateNebulaVolume} from './nebula-volume';

/** Every gas wisp has its own 3D location. Unlike the retired fullscreen
 * gl_Position=vec4(position.xy,...) plane, moving the camera changes gas
 * overlap, apparent size and depth. A single Points draw call runs on mobile. */
const vertexShader=String.raw`
attribute float aSize,aStrength,aTint,aPhase;
uniform float uTime,uSwirl,uScale,uThickness,uPixelScale,uLow;
varying float vStrength,vTint,vPhase;
void main(){
  vec3 p=position;
  // World-space dimensions: depth never collapses to a single plane.
  p.xy*=uScale/1.4;
  p.z=-12.0+(p.z+12.0)*(.25+uThickness*.011);
  float swirl=(p.z+11.0)*uSwirl*.0025;
  float c=cos(swirl),s=sin(swirl);
  p.xy=vec2(p.x*c-p.y*s,p.x*s+p.y*c);
  p.xy+=vec2(sin(aPhase+uTime*.18),cos(aPhase+uTime*.13))*.25;
  p.z+=sin(aPhase*.7+uTime*.11)*.18;
  vec4 eye=modelViewMatrix*vec4(p,1.0);
  gl_Position=projectionMatrix*eye;
  float perspective=30.0/max(2.0,-eye.z);
  gl_PointSize=clamp(aSize*uPixelScale*perspective,1.0,mix(70.0,44.0,uLow));
  vStrength=aStrength;vTint=aTint;vPhase=aPhase;
}`;

const fragmentShader=String.raw`
precision mediump float;
uniform vec3 uA,uB,uC;
uniform float uDensity,uBrightness,uGlow,uOpacity,uNoise;
varying float vStrength,vTint,vPhase;
void main(){
  vec2 p=gl_PointCoord*2.0-1.0;
  float d=dot(p,p);
  if(d>1.0)discard;
  // Gaussian puffs overlap into one 3D cloud; no hard circles or screen UV.
  float softness=exp(-d*(4.3+uNoise*.022))*(1.0-smoothstep(.60,1.0,d));
  float breakup=.84+.16*sin(p.x*5.0+vPhase)*sin(p.y*6.0-vPhase);
  float opacity=uOpacity*.01*(.09+uDensity*.0020)*vStrength;
  float alpha=clamp(softness*opacity*breakup,0.0,.19);
  if(alpha<.002)discard;
  vec3 color=mix(uA,uB,smoothstep(.02,.68,vTint));
  color=mix(color,uC,smoothstep(.67,1.0,vTint)*.85);
  color*= (.4+uBrightness*.007)*(.65+uGlow*.005);
  gl_FragColor=vec4(color,alpha);
}`;

export function NebulaLayer({settings,seconds,low,seed}:{
  settings?:NebulaSettings;
  seconds:RefObject<number>;
  low:boolean;seed:string;
}){
  const nebula=settings??nebulaDefaults;
  const volume=useMemo(()=>generateNebulaVolume(seed,low),[seed,low]);
  const geometry=useMemo(()=>{
    const buffer=new BufferGeometry();
    buffer.setAttribute('position',new BufferAttribute(volume.positions,3));
    buffer.setAttribute('aSize',new BufferAttribute(volume.sizes,1));
    buffer.setAttribute('aStrength',new BufferAttribute(volume.strengths,1));
    buffer.setAttribute('aTint',new BufferAttribute(volume.tints,1));
    buffer.setAttribute('aPhase',new BufferAttribute(volume.phases,1));
    return buffer;
  },[volume]);
  const material=useMemo(()=>new ShaderMaterial({
    vertexShader,fragmentShader,transparent:true,depthTest:true,depthWrite:false,
    blending:AdditiveBlending,toneMapped:false,
    uniforms:{
      uA:{value:new Color()},uB:{value:new Color()},uC:{value:new Color()},
      uTime:{value:0},uSwirl:{value:0},uScale:{value:1},uThickness:{value:50},
      uPixelScale:{value:1},uLow:{value:0},
      uDensity:{value:55},uBrightness:{value:110},uGlow:{value:95},
      uOpacity:{value:48},uNoise:{value:55},
    },
  }),[]);
  const size=useMemo(()=>new Vector2(),[]);
  useEffect(()=>()=>{geometry.dispose();},[geometry]);
  useEffect(()=>()=>{material.dispose();},[material]);
  // The normal renderer, PNG export and video export all share the same
  // scene playhead; exporting a time-locked frame is deterministic.
  useFrame(({gl})=>{
    const uniforms=material.uniforms;
    const frameSize=gl.getDrawingBufferSize(size);
    uniforms.uPixelScale.value=Math.max(.35,Math.min(5,frameSize.y/720));
    uniforms.uTime.value=nebula.animation?seconds.current*nebula.driftSpeed:0;
    uniforms.uLow.value=low?1:0;
  });
  const uniforms=material.uniforms;
  uniforms.uA.value.set(nebula.colorA);
  uniforms.uB.value.set(nebula.colorB);
  uniforms.uC.value.set(nebula.colorC);
  uniforms.uDensity.value=nebula.density;
  uniforms.uBrightness.value=nebula.brightness;
  uniforms.uGlow.value=nebula.glow;
  uniforms.uOpacity.value=nebula.opacity;
  uniforms.uScale.value=nebula.scale;
  uniforms.uNoise.value=nebula.noise;
  uniforms.uSwirl.value=nebula.swirl;
  uniforms.uThickness.value=nebula.thickness;
  return <points name="nebula-worldspace-cloud" geometry={geometry}
    material={material} frustumCulled={false} renderOrder={-1}/>;
}
