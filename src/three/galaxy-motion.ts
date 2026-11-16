/** The spatial/angular formulas used by BOTH the star generator and GPU gas renderer.
 * Keep orientation, handedness, bar radius and the orbital clock in one source. */
export const GALAXY_MOTION={
  orbitBase:.025,orbitNumerator:.080,orbitOffset:.400,orbitRadiusFactor:1.500,
  windingBase:1.650,windingTwist:.350,
  normalBarRadius:.145,barredBarRadius:.250,
  featherOne:.065,featherTwo:.027,
  featherFrequencyOne:19,featherFrequencyTwo:44,
  featherArmOne:3.4,featherArmTwo:2.7,
} as const;

export function galaxyAngularRate(radius:number):number{
  return GALAXY_MOTION.orbitBase+
    GALAXY_MOTION.orbitNumerator/
    (GALAXY_MOTION.orbitOffset+radius*GALAXY_MOTION.orbitRadiusFactor);
}

export function galaxyOrbitDelta(radius:number,time:number,speed:number,handed:number):number{
  return handed*time*speed*galaxyAngularRate(radius);
}
export function galaxyRotate(x:number,y:number,angle:number):[number,number]{
  const c=Math.cos(angle),s=Math.sin(angle);
  return [x*c-y*s,x*s+y*c];
}

export function galaxySpiralSpine(
  radius:number,arm:number,arms:number,orientation:number,handed:number,
  twist:number,barred:boolean,
):number{
  const base=barred?GALAXY_MOTION.barredBarRadius:GALAXY_MOTION.normalBarRadius;
  const r=Math.max(base,radius);
  const winding=handed*(GALAXY_MOTION.windingBase+twist*GALAXY_MOTION.windingTwist)*Math.log(r/base);
  const feather=GALAXY_MOTION.featherOne*
      Math.sin(r*GALAXY_MOTION.featherFrequencyOne+arm*GALAXY_MOTION.featherArmOne+orientation)+
    GALAXY_MOTION.featherTwo*
      Math.sin(r*GALAXY_MOTION.featherFrequencyTwo+arm*GALAXY_MOTION.featherArmTwo);
  return orientation+Math.PI*2*arm/arms+winding+feather;
}

/** GLSL counterpart populated from the exact same constants. Inverse sampling
 * by -delta moves the GAS visually in the same +delta direction as STARS. */
export const GALAXY_MOTION_GLSL=String.raw`
float galaxyAngularRate(float radius){
  return ${GALAXY_MOTION.orbitBase.toFixed(3)}+${GALAXY_MOTION.orbitNumerator.toFixed(3)}/
    (${GALAXY_MOTION.orbitOffset.toFixed(3)}+radius*${GALAXY_MOTION.orbitRadiusFactor.toFixed(3)});
}
float galaxySpiralSpine(float radius,float arm,float arms,float orientation,
  float handed,float twist,float barred){
  float base=mix(${GALAXY_MOTION.normalBarRadius.toFixed(3)},${GALAXY_MOTION.barredBarRadius.toFixed(3)},barred);
  float r=max(base,radius);
  float winding=handed*(${GALAXY_MOTION.windingBase.toFixed(3)}+twist*${GALAXY_MOTION.windingTwist.toFixed(3)})*log(r/base);
  float feather=${GALAXY_MOTION.featherOne.toFixed(3)}*sin(r*${GALAXY_MOTION.featherFrequencyOne.toFixed(1)}+arm*${GALAXY_MOTION.featherArmOne.toFixed(3)}+orientation)+
    ${GALAXY_MOTION.featherTwo.toFixed(3)}*sin(r*${GALAXY_MOTION.featherFrequencyTwo.toFixed(1)}+arm*${GALAXY_MOTION.featherArmTwo.toFixed(3)});
  return orientation+6.28318530718*arm/arms+winding+feather;
}
vec2 galaxyGasOrbit(vec2 p,float handed,float time,float speed){
  float delta=handed*time*speed*galaxyAngularRate(length(p));
  float c=cos(delta),s=sin(delta);
  return vec2(p.x*c+p.y*s,-p.x*s+p.y*c);
}
`;
