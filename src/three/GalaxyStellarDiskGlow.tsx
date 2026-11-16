import {useMemo,useRef,type RefObject} from 'react';
import {useFrame} from '@react-three/fiber';
import {BackSide,Mesh,NormalBlending,ShaderMaterial,Vector3} from 'three';
import {galaxyAppearance,galaxyMorphEasing,type GalaxyData,type GalaxySettings} from './galaxy';
import {generateGalaxyNucleus} from './galaxy-nucleus';

// A low-surface-brightness three-dimensional stellar disk. Unlike a wide
// camera-facing glow sprite, it foreshortens to a thin midplane edge-on and
// fills the spaces between arms when viewed face-on.
const vertexShader=String.raw`
varying vec3 vLocalPosition;
void main(){
  vLocalPosition=position;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}
`;
const fragmentShader=String.raw`
uniform vec3 uEyeLocal,uDiskColor;
uniform float uDensity,uEntrance;
varying vec3 vLocalPosition;
void main(){
  vec3 ray=normalize(vLocalPosition-uEyeLocal);
  float b=dot(uEyeLocal,ray);
  float discriminant=b*b-dot(uEyeLocal,uEyeLocal)+1.0;
  if(discriminant<=0.0)discard;
  float h=sqrt(discriminant);
  float nearT=max(0.0,-b-h);
  float farT=max(0.0,-b+h);
  float travel=farT-nearT;
  if(travel<0.0001)discard;

  float integrated=0.0;
  for(int i=0;i<12;i++){
    vec3 point=uEyeLocal+ray*(nearT+travel*(float(i)+0.5)/12.0);
    float radius=length(point.xy);
    // Old, faint stars spread continuously between the bright blue arms.
    // The short physical Z scale is supplied by the ellipsoid geometry.
    // Fade to true transparency at the physical radial edge. Without this
    // taper the clipped ellipsoid forms an unnatural circular outline.
    float outerFade=1.0-smoothstep(0.72,1.0,radius);
    integrated+=exp(-2.05*radius)*exp(-3.0*point.z*point.z)*outerFade;
  }
  integrated*=travel/12.0;
  float alpha=(1.0-exp(-integrated*uDensity))*uEntrance;
  if(alpha<0.002)discard;
  gl_FragColor=vec4(uDiskColor,clamp(alpha,0.0,0.26));
}
`;

function DiskVolume({pivot,radius,thickness,color,density,seconds,animation,morph,morphDuration}:{
  pivot:readonly [number,number];radius:number;thickness:number;
  color:readonly [number,number,number];density:number;
  seconds:RefObject<number>;animation:boolean;morph:RefObject<boolean>;
  morphDuration:RefObject<number>;
}){
  const mesh=useRef<Mesh>(null),material=useRef<ShaderMaterial>(null);
  const eye=useMemo(()=>new Vector3(),[]);
  const uniforms=useMemo(()=>({
    uEyeLocal:{value:new Vector3(0,0,3)},
    uDiskColor:{value:new Vector3(...color)},
    uDensity:{value:density},uEntrance:{value:1},
  }),[]);
  useFrame(({camera})=>{
    if(!mesh.current)return;
    mesh.current.updateWorldMatrix(true,false);
    eye.copy(camera.position);
    mesh.current.worldToLocal(eye);
    const time=seconds.current;
    const entrance=morph.current
      ?galaxyMorphEasing(time/Math.max(.001,morphDuration.current))
      :!animation&&time===0?1:galaxyMorphEasing(time/2.6);
    uniforms.uEyeLocal.value.copy(eye);
    uniforms.uDiskColor.value.set(...color);
    uniforms.uDensity.value=density;
    uniforms.uEntrance.value=entrance;
    if(material.current){
      material.current.uniforms.uEyeLocal.value.copy(eye);
      material.current.uniforms.uDiskColor.value.copy(uniforms.uDiskColor.value);
      material.current.uniforms.uDensity.value=density;
      material.current.uniforms.uEntrance.value=entrance;
    }
  });
  return <mesh ref={mesh} name="galaxy-diffuse-stellar-disk-volume"
    position={[pivot[0],pivot[1],0]}
    scale={[radius,radius,thickness]} renderOrder={-0.5}
    frustumCulled={false}>
    <sphereGeometry args={[1,40,28]}/>
    <shaderMaterial ref={material} vertexShader={vertexShader}
      fragmentShader={fragmentShader} uniforms={uniforms}
      side={BackSide} transparent depthWrite={false} depthTest={false}
      blending={NormalBlending}/>
  </mesh>;
}

/** Real 3D low-density stellar disk, independent from dense spiral arm stars. */
export function GalaxyStellarDiskGlow({seed,options,stars,low,seconds,animation,morph,morphDuration,
  progressHost}:{
  seed:string;options:GalaxySettings;stars:GalaxyData;low:boolean;
  seconds:RefObject<number>;animation:boolean;morph:RefObject<boolean>;
  morphDuration:RefObject<number>;progressHost?:RefObject<HTMLDivElement|null>;
}){
  const isDisk=['grand_design','barred_spiral','flocculent','interacting'].includes(options.galaxyType);
  const nuclei=useMemo(()=>generateGalaxyNucleus(seed,options,low,stars),
    [seed,options.galaxyType,options.radius,low,stars]);
  const palette=galaxyAppearance(seed,options.palette).colors;
  const diskColor:[number,number,number]=[
    palette.disk[0]*.66+palette.cloud[0]*.34,
    palette.disk[1]*.66+palette.cloud[1]*.34,
    palette.disk[2]*.66+palette.cloud[2]*.34,
  ];
  useFrame(()=>{
    if(progressHost?.current){
      progressHost.current.dataset.galaxyDiskRepresentation=isDisk?'3d-thin-stellar-volume':'none';
      progressHost.current.dataset.galaxyDiskCount=isDisk?String(nuclei.centers.length):'0';
    }
  });
  if(!isDisk)return null;
  return <group name="galaxy-thin-3d-stellar-disk">
    {nuclei.centers.map((pivot,i)=>{
      const companion=options.galaxyType==='interacting'&&i===1;
      const factor=companion?Math.max(.35,options.companionSize):1;
      const r=options.radius*(options.galaxyType==='interacting'?.86:1.06)*factor;
      return <DiskVolume key={i} pivot={pivot} radius={r}
        thickness={options.radius*.038*factor}
        color={diskColor} density={low?.28:.35}
        seconds={seconds} animation={animation}
        morph={morph} morphDuration={morphDuration}/>;
    })}
  </group>;
}
