const has=typeof location!=='undefined';
const get=k=>{try{return localStorage.getItem(k);}catch{return null;}};
const param=has?new URLSearchParams(location.search).get('grid'):null;
const manual=param||(has?get('flowforge-grid'):null);
export const MANUAL=manual==='standard'||manual==='high';
function probe(){
 if(!has)return {s:2,why:'default'};
 let gpu='';
 try{const c=document.createElement('canvas'),g=c.getContext('webgl2')||c.getContext('webgl');if(g){const e=g.getExtension('WEBGL_debug_renderer_info');gpu=e?String(g.getParameter(e.UNMASKED_RENDERER_WEBGL)||''):'';const l=g.getExtension('WEBGL_lose_context');if(l)l.loseContext();}}catch{}
 const cores=navigator.hardwareConcurrency||8,mem=navigator.deviceMemory||8;
 if(get('flowforge-grid-auto')==='standard')return {s:1,why:'earlier speed test on this device',gpu};
 if(/swiftshader|llvmpipe|software|basic render|microsoft/i.test(gpu))return {s:1,why:'software rendering',gpu};
 if(/intel/i.test(gpu)&&!/arc/i.test(gpu))return {s:1,why:'integrated Intel graphics',gpu};
 if(/mali|powervr|adreno ?\(?[1-5]\d\d\b/i.test(gpu))return {s:1,why:'entry-level mobile GPU',gpu};
 if(cores<=4||mem<=4)return {s:1,why:'low core count or memory',gpu};
 return {s:2,why:'capable GPU',gpu};
}
const auto=MANUAL?{s:manual==='standard'?1:2,why:'your setting'}:probe();
export const S=auto.s,AUTO_WHY=auto.why,AUTO_GPU=auto.gpu||'';
export const NX=64*S,NY=32*S,NZ=32*S,W=NX*8,H=NY*NZ/8;
