import * as THREE from 'three';
import {voxelMask} from './shapes.js';
export const GRID = [64,32,32];
const prelude = `precision highp float;
uniform sampler2D velocity, pressure, source, solidMask;
uniform vec4 obstacles[12];
uniform vec4 kinds[12];
uniform int count;
uniform float inlet, viscosity, dt, confinement;
varying vec2 vUv;
const vec3 N=vec3(64.,32.,32.);
vec2 uv3(vec3 p){p=clamp(p,vec3(.5),N-.5);float z=floor(p.z);return (vec2(mod(z,8.)*64.,floor(z/8.)*32.)+p.xy)/vec2(512.,128.);}
vec3 cell(){vec2 q=floor(vUv*vec2(512.,128.));return vec3(mod(q.x,64.),mod(q.y,32.),floor(q.x/64.)+8.*floor(q.y/32.))+.5;}
vec4 at(sampler2D t,vec3 p){return texture2D(t,uv3(p));}
vec3 linearVelocity(vec3 p){vec3 b=floor(p-.5)+.5;vec3 f=fract(p-.5);return mix(mix(mix(at(velocity,b).xyz,at(velocity,b+vec3(1,0,0)).xyz,f.x),mix(at(velocity,b+vec3(0,1,0)).xyz,at(velocity,b+vec3(1,1,0)).xyz,f.x),f.y),mix(mix(at(velocity,b+vec3(0,0,1)).xyz,at(velocity,b+vec3(1,0,1)).xyz,f.x),mix(at(velocity,b+vec3(0,1,1)).xyz,at(velocity,b+vec3(1,1,1)).xyz,f.x),f.y),f.z);}
bool solid(vec3 p){if(at(solidMask,p).r>.5)return true;if(p.y<1.||p.y>31.||p.z<1.||p.z>31.)return true;for(int i=0;i<12;i++){if(i>=count)break;vec3 d=p-obstacles[i].xyz;float r=obstacles[i].w;float k=kinds[i].x;if(k<.5&&length(d)<r)return true;if(k>.5&&k<1.5&&max(max(abs(d.x),abs(d.y)),abs(d.z))<r)return true;if(k>1.5&&length(d.xz)<r&&abs(d.y)<r*1.5)return true;}return false;}
vec3 vel(vec3 p){if(solid(p))return vec3(0);if(p.x<1.)return vec3(inlet,0,0);return at(velocity,p).xyz;}
`;
const vertex = `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
export class FluidSolver {
 constructor(renderer){
  this.renderer=renderer; this.steps=0;this.inlet=1;this.viscosity=.02;this.dt=.45;this.confinement=.18;
  this.scene=new THREE.Scene();this.camera=new THREE.Camera();this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2));this.scene.add(this.quad);
  const target=(w=512,h=128)=>new THREE.WebGLRenderTarget(w,h,{type:THREE.FloatType,format:THREE.RGBAFormat,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:false,stencilBuffer:false});
  this.v=[target(),target()];this.p=[target(),target()];this.div=target();this.curl=target();this.curl.texture.minFilter=THREE.LinearFilter;this.curl.texture.magFilter=THREE.LinearFilter;this.dye=[target(),target()];this.dye.forEach(t=>{t.texture.minFilter=THREE.LinearFilter;t.texture.magFilter=THREE.LinearFilter;});this.particles=[target(128,64),target(128,64)];
  this.maskTexture=new THREE.DataTexture(new Float32Array(512*128*4),512,128,THREE.RGBAFormat,THREE.FloatType);this.maskTexture.needsUpdate=true;
  this.uniforms={solidMask:{value:this.maskTexture},velocity:{value:null},pressure:{value:null},source:{value:null},obstacles:{value:Array.from({length:12},()=>new THREE.Vector4())},kinds:{value:Array.from({length:12},()=>new THREE.Vector4())},count:{value:0},inlet:{value:1},viscosity:{value:.02},dt:{value:.45},confinement:{value:.18},curlField:{value:this.curl.texture},density:{value:null},smokeSource:{value:new THREE.Vector4(18,16,16,6)}};
  const material=body=>new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:prelude+body,uniforms:this.uniforms});
  this.init=material(`void main(){vec3 p=cell();gl_FragColor=vec4(solid(p)?vec3(0):vec3(inlet,0,0),1);}`);
  this.zero=material(`void main(){gl_FragColor=vec4(0);}`);
  this.advect=material(`void main(){vec3 p=cell();vec3 u=linearVelocity(p-dt*vel(p));vec3 lap=vel(p+vec3(1,0,0))+vel(p-vec3(1,0,0))+vel(p+vec3(0,1,0))+vel(p-vec3(0,1,0))+vel(p+vec3(0,0,1))+vel(p-vec3(0,0,1))-6.*vel(p);u+=viscosity*dt*lap;if(p.x<2.)u=vec3(inlet,0,0);if(solid(p))u=vec3(0);gl_FragColor=vec4(u,1);}`);
  this.curlPass=material(`void main(){vec3 p=cell(),xp=vel(p+vec3(1,0,0)),xm=vel(p-vec3(1,0,0)),yp=vel(p+vec3(0,1,0)),ym=vel(p-vec3(0,1,0)),zp=vel(p+vec3(0,0,1)),zm=vel(p-vec3(0,0,1));vec3 w=.5*vec3(yp.z-ym.z-zp.y+zm.y,zp.x-zm.x-xp.z+xm.z,xp.y-xm.y-yp.x+ym.x);gl_FragColor=vec4(w,length(w));}`);
  this.confine=material(`uniform sampler2D curlField;void main(){vec3 p=cell();vec3 g=.5*vec3(at(curlField,p+vec3(1,0,0)).w-at(curlField,p-vec3(1,0,0)).w,at(curlField,p+vec3(0,1,0)).w-at(curlField,p-vec3(0,1,0)).w,at(curlField,p+vec3(0,0,1)).w-at(curlField,p-vec3(0,0,1)).w);vec3 force=confinement*cross(g/(length(g)+.0001),at(curlField,p).xyz);vec3 u=vel(p)+dt*force;u=clamp(u,vec3(-3.),vec3(3.));if(p.x<2.)u=vec3(inlet,0,0);if(solid(p))u=vec3(0);gl_FragColor=vec4(u,1);}`);
  this.smoke=material(`uniform sampler2D density;uniform vec4 smokeSource;
float sampleD(vec3 p){vec3 b=floor(p-.5)+.5,f=fract(p-.5);return mix(mix(mix(at(density,b).x,at(density,b+vec3(1,0,0)).x,f.x),mix(at(density,b+vec3(0,1,0)).x,at(density,b+vec3(1,1,0)).x,f.x),f.y),mix(mix(at(density,b+vec3(0,0,1)).x,at(density,b+vec3(1,0,1)).x,f.x),mix(at(density,b+vec3(0,1,1)).x,at(density,b+vec3(1,1,1)).x,f.x),f.y),f.z);}
void main(){vec3 p=cell();float d=sampleD(p-dt*vel(p))*.997;float r=length(p.yz-smokeSource.yz)/max(smokeSource.w,1.);float jet=exp(-r*r*2.);float ribbons=.55+.45*cos((p.y-smokeSource.y)*1.5)*cos((p.z-smokeSource.z)*1.5);if(abs(p.x-smokeSource.x)<1.2)d=max(d,jet*ribbons*.9);if(solid(p)||p.x>63.)d=0.;gl_FragColor=vec4(d,0,0,1);}`);
  this.divergence=material(`void main(){vec3 p=cell();float d=.5*(vel(p+vec3(1,0,0)).x-vel(p-vec3(1,0,0)).x+vel(p+vec3(0,1,0)).y-vel(p-vec3(0,1,0)).y+vel(p+vec3(0,0,1)).z-vel(p-vec3(0,0,1)).z);gl_FragColor=vec4(solid(p)?0.:d,0,0,1);}`);
  this.jacobi=material(`float pr(vec3 q,vec3 p){if(q.x>63.)return 0.;if(q.x<1.||solid(q))return at(pressure,p).x;return at(pressure,q).x;}void main(){vec3 p=cell();float s=pr(p+vec3(1,0,0),p)+pr(p-vec3(1,0,0),p)+pr(p+vec3(0,1,0),p)+pr(p-vec3(0,1,0),p)+pr(p+vec3(0,0,1),p)+pr(p-vec3(0,0,1),p);gl_FragColor=vec4(solid(p)?0.:(s-at(source,p).x)/6.,0,0,1);}`);
  this.project=material(`float pr(vec3 q,vec3 p){if(q.x>63.)return 0.;if(q.x<1.||solid(q))return at(pressure,p).x;return at(pressure,q).x;}void main(){vec3 p=cell();vec3 g=.5*vec3(pr(p+vec3(1,0,0),p)-pr(p-vec3(1,0,0),p),pr(p+vec3(0,1,0),p)-pr(p-vec3(0,1,0),p),pr(p+vec3(0,0,1),p)-pr(p-vec3(0,0,1),p));vec3 u=vel(p)-g;if(p.x<2.)u=vec3(inlet,0,0);if(solid(p))u=vec3(0);gl_FragColor=vec4(u,1);}`);
  this.seed=material(`float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}void main(){vec3 p=vec3(2.+60.*hash(vUv),3.+26.*hash(vUv+1.),3.+26.*hash(vUv+2.));gl_FragColor=vec4(p,hash(vUv+3.)*160.);}`);
  this.move=material(`float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}void main(){vec4 a=texture2D(source,vUv);vec3 p=a.xyz;vec3 u=linearVelocity(p);p+=dt*linearVelocity(p+.5*dt*u);float age=a.w+dt;if(p.x>62.||p.y<2.||p.y>30.||p.z<2.||p.z>30.||solid(p)||age>180.){p=vec3(2.,3.+26.*hash(vUv+age*.001),3.+26.*hash(vUv+age*.002+2.));age=0.;}gl_FragColor=vec4(p,age);}`);
 }
 pass(mat,target){this.quad.material=mat;this.renderer.setRenderTarget(target);this.renderer.render(this.scene,this.camera);this.renderer.setRenderTarget(null);}
 setShapes(shapes){const mask=voxelMask(shapes);this.owners=mask.owners;this.maskTexture.image.data=mask.data;this.maskTexture.needsUpdate=true;this.uniforms.count.value=0;const first=shapes[0];this.uniforms.smokeSource.value.set(first?Math.max(3,first.pos[0]-first.size-4):4,first?first.pos[1]:16,first?first.pos[2]:16,first?first.size*1.5:6);shapes.forEach((s,i)=>{this.uniforms.obstacles.value[i].set(...s.pos,s.size);this.uniforms.kinds.value[i].x={sphere:0,box:1,cylinder:2}[s.type]||0;});}
 reset(){this.uniforms.inlet.value=this.inlet;this.pass(this.init,this.v[0]);this.pass(this.init,this.v[1]);this.pass(this.zero,this.p[0]);this.pass(this.zero,this.p[1]);this.pass(this.seed,this.particles[0]);this.pass(this.seed,this.particles[1]);this.pass(this.zero,this.curl);this.pass(this.zero,this.dye[0]);this.pass(this.zero,this.dye[1]);this.steps=0;}
 step(){const u=this.uniforms;u.inlet.value=this.inlet;u.viscosity.value=this.viscosity;u.confinement.value=this.confinement;u.velocity.value=this.v[0].texture;this.pass(this.advect,this.v[1]);this.v.reverse();u.velocity.value=this.v[0].texture;if(this.confinement>0){this.pass(this.curlPass,this.curl);this.pass(this.confine,this.v[1]);this.v.reverse();u.velocity.value=this.v[0].texture;}this.pass(this.divergence,this.div);u.source.value=this.div.texture;for(let i=0;i<24;i++){u.pressure.value=this.p[0].texture;this.pass(this.jacobi,this.p[1]);this.p.reverse();}u.pressure.value=this.p[0].texture;this.pass(this.project,this.v[1]);this.v.reverse();u.velocity.value=this.v[0].texture;this.pass(this.curlPass,this.curl);u.density.value=this.dye[0].texture;this.pass(this.smoke,this.dye[1]);this.dye.reverse();u.density.value=this.dye[0].texture;u.source.value=this.particles[0].texture;this.pass(this.move,this.particles[1]);this.particles.reverse();this.steps++;}
 forces(selected){const v=new Float32Array(512*128*4),p=new Float32Array(v.length);this.renderer.readRenderTargetPixels(this.v[0],0,0,512,128,v);this.renderer.readRenderTargetPixels(this.p[0],0,0,512,128,p);const idx=(x,y,z)=>((Math.floor(z/8)*32+y)*512+(z%8)*64+x)*4;let pressure=0,friction=0,faces=0;for(let z=1;z<31;z++)for(let y=1;y<31;y++)for(let x=1;x<63;x++){if(this.owners[(z*32+y)*64+x]!==selected)continue;for(let d of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){let [a,b,c]=[x+d[0],y+d[1],z+d[2]];if(this.owners[(c*32+b)*64+a]>=0)continue;let i=idx(a,b,c);pressure-=p[i]*d[0];friction+=this.viscosity*v[i]*(1-Math.abs(d[0]));faces++;}}return {pressure,friction,total:pressure+friction,faces};}
 diagnostics(){const a=new Float32Array(512*128*4);this.renderer.readRenderTargetPixels(this.v[0],0,0,512,128,a);let max=0,sum=0,finite=true;for(let i=0;i<a.length;i+=4){let m=Math.hypot(a[i],a[i+1],a[i+2]);finite&&=Number.isFinite(m);sum+=m;max=Math.max(max,m);}return {finite,max,mean:sum/(64*32*32),steps:this.steps};}
}
export {prelude};
