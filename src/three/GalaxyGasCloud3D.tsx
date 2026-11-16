import {useEffect,useLayoutEffect,useMemo,useRef,type RefObject} from 'react';
import {useFrame} from '@react-three/fiber';
import {BufferAttribute,BufferGeometry,NormalBlending,ShaderMaterial} from 'three';
import {galaxyMorphEasing,type GalaxyData,type GalaxySettings} from './galaxy';
import {generateGalaxyGas,type GalaxyGasData} from './galaxy-generators/gas';

const vertexShader=String.raw`
attribute vec3 aColor;
attribute vec3 aFrom;
attribute float aSize;
attribute float aOpacity;
attribute float aSpin;
attribute float aPhase;
attribute float aCore;
attribute vec2 aOrbitCenter;
uniform float uTime,uRotationSpeed,uEntrance,uMorph,uMorphEnabled,uDpr,uExportScale;
varying vec3 vColor;
varying float vOpacity;
varying float vPhase;
varying float vCore;
void main(){
  float angular=aSpin*uRotationSpeed*uTime;
  float c=cos(angular),s=sin(angular);
  vec2 local=position.xy-aOrbitCenter;
  vec3 target=vec3(aOrbitCenter.x+local.x*c-local.y*s,
    aOrbitCenter.y+local.x*s+local.y*c,position.z);
  float blend=uMorphEnabled>.5?uMorph:1.0;
  vec3 point=mix(aFrom,target,blend);
  if(uMorphEnabled<.5)point*=uEntrance;
  vec4 view=modelViewMatrix*vec4(point,1.);
  gl_Position=projectionMatrix*view;
  float distanceScale=clamp(19./max(.5,-view.z),.45,2.0);
  gl_PointSize=clamp(aSize*uDpr*distanceScale,3.,76.)*uExportScale;
  vColor=aColor;
  vOpacity=aOpacity*(uMorphEnabled>.5?blend:uEntrance);
  vPhase=aPhase;
  vCore=aCore;
}
`;
const fragmentShader=String.raw`
varying vec3 vColor;
varying float vOpacity;
varying float vPhase;
varying float vCore;
uniform float uEnergy,uCoreGlow;
void main(){
  // Each fragment belongs to a true 3D cloudlet billboard. There is no
  // large disk mesh, no uniform radial atlas and no screen-sized gas UVs.
  vec2 p=gl_PointCoord*2.-1.;
  float d=dot(p,p);
  if(d>1.)discard;
  // No high-contrast sine stripes or hard cloud boundaries: these created
  // visible individual "cotton balls" on the galaxy arms.
  // A softly offset Gaussian lets thousands of 3D wisps overlap smoothly.
  float asymmetry=.93+.07*sin(p.x*4.4+vPhase)*sin(p.y*4.6-vPhase);
  float cloud=exp(-d*2.35)*(1.-smoothstep(.52,1.,d))*asymmetry;
  // Rebuild the bright nucleus with many truly 3D soft cloudlets, not
  // another flat disk. The center-glow slider only amplifies nearby cores.
  float nucleus=vCore*uCoreGlow;
  float alpha=clamp(vOpacity*cloud*uEnergy*(1.+1.75*nucleus),0.,.22);
  if(alpha<.003)discard;
  vec3 rgb=mix(vColor,vec3(1.,.81,.59),min(.30,nucleus*.16));
  gl_FragColor=vec4(rgb,alpha);
}
`;
type Previous={seed:string;data:GalaxyGasData;rotationSpeed:number};
function oldPosition(old:Previous,index:number,time:number):[number,number,number]{
  const i=index*3,c=index*2,angle=old.data.spins[index]*old.rotationSpeed*time;
  const x=old.data.positions[i]-(old.data.orbitCenters[c]??0);
  const y=old.data.positions[i+1]-(old.data.orbitCenters[c+1]??0);
  const cx=old.data.orbitCenters[c],cy=old.data.orbitCenters[c+1];
  return [cx+x*Math.cos(angle)-y*Math.sin(angle),
    cy+x*Math.sin(angle)+y*Math.cos(angle),old.data.positions[i+2]];
}

/** Volumetric gas rendered as thousands of separate camera-facing
 * billboards with 3D centers. Gas inherits orbital direction and orbit
 * pivot directly from the selected stellar source points. */
export function GalaxyGasCloud3D({seed,options,stars,seconds,low,animation,morph,morphDuration,
  progressHost}:{
  seed:string;options:GalaxySettings;stars:GalaxyData;
  seconds:RefObject<number>;low:boolean;animation:boolean;
  morph:RefObject<boolean>;morphDuration:RefObject<number>;
  progressHost?:RefObject<HTMLDivElement|null>;
}){
  const data=useMemo(()=>generateGalaxyGas(seed,options,low,stars),[seed,options,low,stars]);
  const geometry=useMemo(()=>{
    const buffer=new BufferGeometry();
    buffer.setAttribute('position',new BufferAttribute(data.positions,3));
    buffer.setAttribute('aColor',new BufferAttribute(data.colors,3));
    buffer.setAttribute('aOpacity',new BufferAttribute(data.opacities,1));
    buffer.setAttribute('aSize',new BufferAttribute(data.sizes,1));
    buffer.setAttribute('aSpin',new BufferAttribute(data.spins,1));
    buffer.setAttribute('aPhase',new BufferAttribute(data.phases,1));
    buffer.setAttribute('aCore',new BufferAttribute(data.coreFactors,1));
    buffer.setAttribute('aOrbitCenter',new BufferAttribute(data.orbitCenters,2));
    buffer.setAttribute('aFrom',new BufferAttribute(new Float32Array(data.positions),3));
    return buffer;
  },[data]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  const previous=useRef<Previous|null>(null);
  const transitioning=useRef(false);
  const gpu=useRef<ShaderMaterial>(null);
  const uniforms=useMemo(()=>({
    uTime:{value:0},uRotationSpeed:{value:options.rotationSpeed},
    uEntrance:{value:1},uMorph:{value:1},uMorphEnabled:{value:0},
    uDpr:{value:1},uEnergy:{value:1},uCoreGlow:{value:options.coreGlow/100},
    uExportScale:{value:1},
  }),[]);
  useLayoutEffect(()=>{
    const prior=previous.current;
    transitioning.current=!!(prior&&prior.seed!==seed&&options.seedTransition&&animation);
    if(transitioning.current&&prior){
      const from=(geometry.getAttribute('aFrom') as BufferAttribute).array as Float32Array;
      for(let i=0;i<data.count;i++){
        const oldIndex=Math.floor(i*prior.data.count/data.count);
        const [x,y,z]=oldPosition(prior,oldIndex,seconds.current);
        from[i*3]=x;from[i*3+1]=y;from[i*3+2]=z;
      }
      (geometry.getAttribute('aFrom') as BufferAttribute).needsUpdate=true;
    }
    previous.current={seed,data,rotationSpeed:options.rotationSpeed};
  },[seed,data,geometry,seconds,options.rotationSpeed,options.seedTransition,animation]);
  useFrame(()=>{
    const clock=import.meta.env.DEV&&progressHost?.current
      ?Number(progressHost.current.dataset.galaxyMotionClock):NaN;
    const time=Number.isFinite(clock)?clock:seconds.current;
    const phase=galaxyMorphEasing(time/Math.max(.001,morphDuration.current));
    uniforms.uTime.value=time;
    uniforms.uRotationSpeed.value=options.rotationSpeed;
    uniforms.uEntrance.value=!animation&&time===0?1:galaxyMorphEasing(time/2.6);
    uniforms.uMorphEnabled.value=transitioning.current&&morph.current?1:0;
    uniforms.uMorph.value=phase;
    uniforms.uDpr.value=low?1:1.45;
    // Normal alpha blending, not the unbounded energy of AdditiveBlending.
    uniforms.uEnergy.value=(low?.82:.39)*Math.sqrt(1400/Math.max(650,data.count))*
      (!low&&options.galaxyType==='ring'?.60:1);
    uniforms.uCoreGlow.value=options.coreGlow/100;
    if(gpu.current){
      for(const key of Object.keys(uniforms) as (keyof typeof uniforms)[])
        gpu.current.uniforms[key].value=uniforms[key].value;
    }
    if(progressHost?.current){
      progressHost.current.dataset.galaxyGasTime=time.toFixed(3);
      progressHost.current.dataset.galaxyGasMaterialTime=
        Number(gpu.current?.uniforms.uTime.value??-1).toFixed(3);
      progressHost.current.dataset.galaxyGasSpeed=options.rotationSpeed.toFixed(2);
      progressHost.current.dataset.galaxyGasRepresentation='3d-points';
      progressHost.current.dataset.galaxyGasCount=String(data.count);
    }
    if(phase>=1)transitioning.current=false;
  });
  return <points name="galaxy-volumetric-gas-3d" geometry={geometry}
    renderOrder={0} frustumCulled={false}>
    <shaderMaterial ref={gpu} vertexShader={vertexShader} fragmentShader={fragmentShader}
      uniforms={uniforms} transparent depthWrite={false} depthTest={false}
      blending={NormalBlending}/>
  </points>;
}
