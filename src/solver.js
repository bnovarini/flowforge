import * as THREE from 'three';
export const GRID = [64,32,32];
const prelude = `precision highp float;
uniform sampler2D velocity, pressure, source;
uniform vec4 obstacles[12];
uniform vec4 kinds[12];
uniform int count;
uniform float inlet, viscosity, dt;
varying vec2 vUv;
const vec3 N=vec3(64.,32.,32.);
vec2 uv3(vec3 p){p=clamp(p,vec3(.5),N-.5);float z=floor(p.z);return (vec2(mod(z,8.)*64.,floor(z/8.)*32.)+p.xy)/vec2(512.,128.);}
vec3 cell(){vec2 q=floor(vUv*vec2(512.,128.));return vec3(mod(q.x,64.),mod(q.y,32.),floor(q.x/64.)+8.*floor(q.y/32.))+.5;}
vec4 at(sampler2D t,vec3 p){return texture2D(t,uv3(p));}
vec3 linearVelocity(vec3 p){vec3 b=floor(p-.5)+.5;vec3 f=fract(p-.5);return mix(mix(mix(at(velocity,b).xyz,at(velocity,b+vec3(1,0,0)).xyz,f.x),mix(at(velocity,b+vec3(0,1,0)).xyz,at(velocity,b+vec3(1,1,0)).xyz,f.x),f.y),mix(mix(at(velocity,b+vec3(0,0,1)).xyz,at(velocity,b+vec3(1,0,1)).xyz,f.x),mix(at(velocity,b+vec3(0,1,1)).xyz,at(velocity,b+vec3(1,1,1)).xyz,f.x),f.y),f.z);}
bool solid(vec3 p){if(p.y<1.||p.y>31.||p.z<1.||p.z>31.)return true;for(int i=0;i<12;i++){if(i>=count)break;vec3 d=p-obstacles[i].xyz;float r=obstacles[i].w;float k=kinds[i].x;if(k<.5&&length(d)<r)return true;if(k>.5&&k<1.5&&max(max(abs(d.x),abs(d.y)),abs(d.z))<r)return true;if(k>1.5&&length(d.xz)<r&&abs(d.y)<r*1.5)return true;}return false;}
vec3 vel(vec3 p){if(solid(p))return vec3(0);if(p.x<1.)return vec3(inlet,0,0);return at(velocity,p).xyz;}
`;
const vertex = `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
export class FluidSolver {
 constructor(renderer){
  this.renderer=renderer; this.steps=0;this.inlet=1;this.viscosity=.02;this.dt=.45;
  this.scene=new THREE.Scene();this.camera=new THREE.Camera();this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2));this.scene.add(this.quad);
  const target=(w=512,h=128)=>new THREE.WebGLRenderTarget(w,h,{type:THREE.FloatType,format:THREE.RGBAFormat,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:false,stencilBuffer:false});
  this.v=[target(),target()];this.p=[target(),target()];this.div=target();this.particles=[target(128,64),target(128,64)];
  this.uniforms={velocity:{value:null},pressure:{value:null},source:{value:null},obstacles:{value:Array.from({length:12},()=>new THREE.Vector4())},kinds:{value:Array.from({length:12},()=>new THREE.Vector4())},count:{value:0},inlet:{value:1},viscosity:{value:.02},dt:{value:.45}};
  const material=body=>new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:prelude+body,uniforms:this.uniforms});
  this.init=material(`void main(){vec3 p=cell();gl_FragColor=vec4(solid(p)?vec3(0):vec3(inlet,0,0),1);}`);
  this.zero=material(`void main(){gl_FragColor=vec4(0);}`);
  this.advect=material(`void main(){vec3 p=cell();vec3 u=linearVelocity(p-dt*vel(p));vec3 lap=vel(p+vec3(1,0,0))+vel(p-vec3(1,0,0))+vel(p+vec3(0,1,0))+vel(p-vec3(0,1,0))+vel(p+vec3(0,0,1))+vel(p-vec3(0,0,1))-6.*vel(p);u+=viscosity*dt*lap;if(p.x<2.)u=vec3(inlet,0,0);if(solid(p))u=vec3(0);gl_FragColor=vec4(u,1);}`);
  this.divergence=material(`void main(){vec3 p=cell();float d=.5*(vel(p+vec3(1,0,0)).x-vel(p-vec3(1,0,0)).x+vel(p+vec3(0,1,0)).y-vel(p-vec3(0,1,0)).y+vel(p+vec3(0,0,1)).z-vel(p-vec3(0,0,1)).z);gl_FragColor=vec4(solid(p)?0.:d,0,0,1);}`);
  this.jacobi=material(`float pr(vec3 q,vec3 p){if(q.x>63.)return 0.;if(q.x<1.||solid(q))return at(pressure,p).x;return at(pressure,q).x;}void main(){vec3 p=cell();float s=pr(p+vec3(1,0,0),p)+pr(p-vec3(1,0,0),p)+pr(p+vec3(0,1,0),p)+pr(p-vec3(0,1,0),p)+pr(p+vec3(0,0,1),p)+pr(p-vec3(0,0,1),p);gl_FragColor=vec4(solid(p)?0.:(s-at(source,p).x)/6.,0,0,1);}`);
  this.project=material(`float pr(vec3 q,vec3 p){if(q.x>63.)return 0.;if(q.x<1.||solid(q))return at(pressure,p).x;return at(pressure,q).x;}void main(){vec3 p=cell();vec3 g=.5*vec3(pr(p+vec3(1,0,0),p)-pr(p-vec3(1,0,0),p),pr(p+vec3(0,1,0),p)-pr(p-vec3(0,1,0),p),pr(p+vec3(0,0,1),p)-pr(p-vec3(0,0,1),p));vec3 u=vel(p)-g;if(p.x<2.)u=vec3(inlet,0,0);if(solid(p))u=vec3(0);gl_FragColor=vec4(u,1);}`);
  this.seed=material(`float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}void main(){vec3 p=vec3(2.+60.*hash(vUv),3.+26.*hash(vUv+1.),3.+26.*hash(vUv+2.));gl_FragColor=vec4(p,hash(vUv+3.)*160.);}`);
  this.move=material(`float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}void main(){vec4 a=texture2D(source,vUv);vec3 p=a.xyz;vec3 u=linearVelocity(p);p+=dt*linearVelocity(p+.5*dt*u);float age=a.w+dt;if(p.x>62.||p.y<2.||p.y>30.||p.z<2.||p.z>30.||solid(p)||age>180.){p=vec3(2.,3.+26.*hash(vUv+age*.001),3.+26.*hash(vUv+age*.002+2.));age=0.;}gl_FragColor=vec4(p,age);}`);
 }
 pass(mat,target){this.quad.material=mat;this.renderer.setRenderTarget(target);this.renderer.render(this.scene,this.camera);this.renderer.setRenderTarget(null);}
 setShapes(shapes){this.uniforms.count.value=shapes.length;shapes.forEach((s,i)=>{this.uniforms.obstacles.value[i].set(...s.pos,s.size);this.uniforms.kinds.value[i].x={sphere:0,box:1,cylinder:2}[s.type];});}
 reset(){this.uniforms.inlet.value=this.inlet;this.pass(this.init,this.v[0]);this.pass(this.init,this.v[1]);this.pass(this.zero,this.p[0]);this.pass(this.zero,this.p[1]);this.pass(this.seed,this.particles[0]);this.pass(this.seed,this.particles[1]);this.steps=0;}
 step(){const u=this.uniforms;u.inlet.value=this.inlet;u.viscosity.value=this.viscosity;u.velocity.value=this.v[0].texture;this.pass(this.advect,this.v[1]);this.v.reverse();u.velocity.value=this.v[0].texture;this.pass(this.divergence,this.div);u.source.value=this.div.texture;for(let i=0;i<24;i++){u.pressure.value=this.p[0].texture;this.pass(this.jacobi,this.p[1]);this.p.reverse();}u.pressure.value=this.p[0].texture;this.pass(this.project,this.v[1]);this.v.reverse();u.velocity.value=this.v[0].texture;u.source.value=this.particles[0].texture;this.pass(this.move,this.particles[1]);this.particles.reverse();this.steps++;}
 diagnostics(){const a=new Float32Array(512*128*4);this.renderer.readRenderTargetPixels(this.v[0],0,0,512,128,a);let max=0,sum=0,finite=true;for(let i=0;i<a.length;i+=4){let m=Math.hypot(a[i],a[i+1],a[i+2]);finite&&=Number.isFinite(m);sum+=m;max=Math.max(max,m);}return {finite,max,mean:sum/(64*32*32),steps:this.steps};}
}
export {prelude};
