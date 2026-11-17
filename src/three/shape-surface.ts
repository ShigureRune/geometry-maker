import {
  BoxGeometry,BufferGeometry,CapsuleGeometry,ConeGeometry,CylinderGeometry,
  DodecahedronGeometry,IcosahedronGeometry,OctahedronGeometry,SphereGeometry,
  TetrahedronGeometry,TorusGeometry,TorusKnotGeometry,
} from 'three';
import type {ThreeKind} from './model';

/** Exact 13 solid surfaces shared by ordinary PARTICLE MODE and VOID.
 * The ordinary mode still creates its own MeshSurfaceSampler from these.
 */
export function surfaceGeometry(kind:ThreeKind,low:boolean):BufferGeometry {
  const n=low?12:32;
  switch(kind){
    case 'sphere':return new SphereGeometry(1,n,n/2);
    case 'cube':return new BoxGeometry(2/Math.sqrt(3),2/Math.sqrt(3),2/Math.sqrt(3));
    case 'torus':return new TorusGeometry(.72,.23,low?8:16,low?24:64);
    case 'icosahedron':return new IcosahedronGeometry(1,0);
    case 'dodecahedron':return new DodecahedronGeometry(1,0);
    case 'octahedron':return new OctahedronGeometry(1,0);
    case 'tetrahedron':return new TetrahedronGeometry(1,0);
    case 'cylinder':return new CylinderGeometry(.62,.62,1.45,n);
    case 'cone':return new ConeGeometry(.72,1.35,n);
    case 'capsule':return new CapsuleGeometry(.42,.68,low?4:8,low?10:24);
    case 'prism':return new CylinderGeometry(.69,.69,1.32,3);
    case 'pyramid':return new CylinderGeometry(0,.70,1.30,4);
    case 'torus-knot':return new TorusKnotGeometry(.50,.15,low?48:112,low?6:12,2,3);
  }
}


export type ShapeSurface={
  /** Coordinates for each triangle, 3 vertices * XYZ. */
  triangles:Float32Array;
  /** Area cumulative distribution: no bias toward over-tessellated patches. */
  cumulative:Float64Array;
  area:number;
};
const cached=new Map<string,ShapeSurface>();

/** Cache only one triangle CDF per shape and quality (max 26 templates).
 * No per-node mesh, MeshSurfaceSampler, or geometry allocation in the web.
 * Sampling cost is O(log triangles) for each point.
 */
export function shapeSurface(kind:ThreeKind,low:boolean):ShapeSurface{
  const key=(low?'low:':'high:')+kind;
  const saved=cached.get(key);
  if(saved)return saved;
  const geometry=surfaceGeometry(kind,low);
  const positions=geometry.getAttribute('position'),indices=geometry.getIndex();
  const triangleCount=Math.floor((indices?.count??positions.count)/3);
  const triangles=new Float32Array(triangleCount*9);
  const cumulative=new Float64Array(triangleCount);
  let area=0;
  for(let triangle=0;triangle<triangleCount;triangle++){
    const start=triangle*9;
    for(let vertex=0;vertex<3;vertex++){
      const index=indices?indices.getX(triangle*3+vertex):triangle*3+vertex;
      const i=start+vertex*3;
      triangles[i]=positions.getX(index);
      triangles[i+1]=positions.getY(index);
      triangles[i+2]=positions.getZ(index);
    }
    const ax=triangles[start+3]-triangles[start],ay=triangles[start+4]-triangles[start+1],
      az=triangles[start+5]-triangles[start+2];
    const bx=triangles[start+6]-triangles[start],by=triangles[start+7]-triangles[start+1],
      bz=triangles[start+8]-triangles[start+2];
    area+=Math.hypot(ay*bz-az*by,az*bx-ax*bz,ax*by-ay*bx)*.5;
    cumulative[triangle]=area;
  }
  geometry.dispose();
  const result={triangles,cumulative,area};
  cached.set(key,result);
  return result;
}
