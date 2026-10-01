import {CylinderLBM} from './lbm.js';
let solver,paused=false,timer=null;
function send(){const f=solver.field();const den=.5*solver.U**2*solver.D;postMessage({type:'field',...f,steps:solver.steps,W:solver.W,H:solver.H,Re:solver.Re,drag:solver.force[0]/den,lift:solver.force[1]/den,St:solver.strouhal()},[f.rgba.buffer]);}
function run(){if(!paused){const start=performance.now();let n=0;while(performance.now()-start<35&&n<100){solver.step();n++;}if(solver.steps%100<n)send();}timer=setTimeout(run,0);}
onmessage=e=>{if(e.data.type==='start'){clearTimeout(timer);solver=new CylinderLBM(320,128,e.data.Re||100);paused=false;send();run();}if(e.data.type==='pause')paused=e.data.value;if(e.data.type==='export')postMessage({type:'csv',csv:'step,drag,lift\n'+solver.samples.map(x=>x.join(',')).join('\n')});};
