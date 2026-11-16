/**
 * Barnes–Hut stellar self-gravity for the live GALAXY MODE positions.
 *
 * A deterministic, stratified subset of visible stars carries the disk mass.
 * Every rendered star feels this softened field, but ONLY sampled stars feed
 * mass back. This is an explicitly bounded approximation, not an exact
 * 30,000-body gravitational solve. Bulge and dark-halo fields remain external.
 *
 * The tree is two-dimensional (thin disk) with a mass-weighted Z coordinate.
 * Forces are evaluated in 3D with Plummer softening. A node containing the
 * target location is NEVER accepted as a monopole, and sampled particles skip
 * their own body ID at leaf level.
 */
type Quad={
  x:number;y:number;size:number;
  mass:number;cx:number;cy:number;cz:number;
  children:Quad[]|null;indices:number[]|null;
};
export type StellarSelfGravity={
  readonly sourceCount:number;
  readonly particleCount:number;
  readonly updates:number;
  readonly nodeCount:number;
  readonly accelerations:Float32Array;
  readonly totalMass:number;
  update:(positions:Float32Array,strength:number)=>void;
  accelerationAt:(x:number,y:number,z:number,particleIndex?:number)=>readonly [number,number,number];
};

export function createStellarSelfGravity(
  initial:Float32Array,radius:number,requestedSources=1024,
  theta=.68,
):StellarSelfGravity{
  const particleCount=Math.floor(initial.length/3);
  const sourceCount=Math.min(particleCount,Math.max(1,
    Math.min(2048,Math.floor(requestedSources))));
  const sources=new Int32Array(sourceCount);
  for(let j=0;j<sourceCount;j++)
    sources[j]=Math.floor((j+.5)*particleCount/sourceCount);
  const accelerations=new Float32Array(particleCount*3);
  // A distributed stellar disk accounts for a modest fraction of the
  // stellar bulge's background mass. Keeping the existing bulge + halo
  // avoids double-counting their entire gravitational contribution.
  const totalMass=(radius*.085)**2*radius*.36*.60;
  const particleMass=sourceCount?totalMass/sourceCount:0;
  const eps2=(radius*.055)**2;
  const theta2=theta*theta;
  let root:Quad|null=null,positions=initial,updates=0,nodeCount=0;
  let strength=0;

  function build(ids:number[],x:number,y:number,size:number,depth:number):Quad{
    nodeCount++;
    let mx=0,my=0,mz=0;
    for(const i of ids){
      const k=i*3;
      mx+=positions[k];my+=positions[k+1];mz+=positions[k+2];
    }
    const mass=ids.length*particleMass,div=ids.length||1;
    const node:Quad={x,y,size,mass,cx:mx/div,cy:my/div,cz:mz/div,
      indices:ids,children:null};
    if(ids.length<=1||depth>=16||size<radius*.00002)return node;
    const half=size*.5,mx0=x+half,my0=y+half;
    const buckets:number[][]=[[],[],[],[]];
    for(const i of ids){
      const k=i*3;
      buckets[(positions[k]>=mx0?1:0)+(positions[k+1]>=my0?2:0)].push(i);
    }
    const children:Quad[]=[];
    for(let j=0;j<4;j++){
      if(!buckets[j].length)continue;
      children.push(build(buckets[j],x+(j&1)*half,y+(j&2?half:0),
        half,depth+1));
    }
    node.indices=null;node.children=children;
    return node;
  }
  function rebuild(){
    if(!sourceCount){root=null;nodeCount=0;return;}
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(const i of sources){
      const k=i*3,x=positions[k],y=positions[k+1];
      if(x<minX)minX=x;if(x>maxX)maxX=x;
      if(y<minY)minY=y;if(y>maxY)maxY=y;
    }
    const size=Math.max(radius*.0001,maxX-minX,maxY-minY)*1.0001;
    const cx=(minX+maxX)*.5,cy=(minY+maxY)*.5;
    nodeCount=0;
    root=build(Array.from(sources),cx-size*.5,cy-size*.5,size,0);
  }
  function fieldAt(x:number,y:number,z:number,particleIndex=-1):
      readonly [number,number,number]{
    if(!root||strength<=0)return [0,0,0];
    let ax=0,ay=0,az=0;
    const stack=[root];
    while(stack.length){
      const node=stack.pop()!;
      const dx=node.cx-x,dy=node.cy-y,dz=node.cz-z;
      const d2=dx*dx+dy*dy+dz*dz;
      const contained=x>=node.x&&x<node.x+node.size&&
        y>=node.y&&y<node.y+node.size;
      if(node.children&&
        (contained||node.size*node.size>=theta2*(d2+eps2))){
        for(const child of node.children)stack.push(child);
      }else if(node.indices){
        for(const index of node.indices){
          if(index===particleIndex)continue;
          const p=index*3;
          const sx=positions[p]-x,sy=positions[p+1]-y,
            sz=positions[p+2]-z;
          const d=sx*sx+sy*sy+sz*sz+eps2;
          const f=particleMass*strength/(d*Math.sqrt(d));
          ax+=sx*f;ay+=sy*f;az+=sz*f;
        }
      }else{
        const d=d2+eps2;
        const f=node.mass*strength/(d*Math.sqrt(d));
        ax+=dx*f;ay+=dy*f;az+=dz*f;
      }
    }
    return [ax,ay,az];
  }
  function update(nextPositions:Float32Array,nextStrength:number){
    positions=nextPositions;
    strength=Math.max(0,Math.min(2,nextStrength));
    accelerations.fill(0);
    if(!strength||!sourceCount){
      root=null;nodeCount=0;
      return;
    }
    rebuild();
    for(let i=0;i<particleCount;i++){
      const k=i*3;
      const [ax,ay,az]=fieldAt(positions[k],positions[k+1],
        positions[k+2],i);
      accelerations[k]=ax;
      accelerations[k+1]=ay;
      accelerations[k+2]=az;
    }
    updates++;
  }
  return {
    sourceCount,particleCount,totalMass,accelerations,
    get updates(){return updates;},get nodeCount(){return nodeCount;},
    update,accelerationAt:fieldAt,
  };
}
