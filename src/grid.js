const q=typeof location!=='undefined'?new URLSearchParams(location.search).get('grid')||(()=>{try{return localStorage.getItem('flowforge-grid');}catch{return null;}})():null;
export const S=q==='standard'?1:2;
export const NX=64*S,NY=32*S,NZ=32*S,W=NX*8,H=NY*NZ/8;
