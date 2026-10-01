import {CylinderLBM} from '../src/lbm.js';
const solver=new CylinderLBM();for(let i=0;i<24000;i++)solver.step();const result={steps:solver.steps,finite:solver.field().finite,Strouhal:solver.strouhal(),force:solver.force};console.log(JSON.stringify(result,null,2));if(!result.finite||!result.Strouhal||result.Strouhal?.value<.15||result.Strouhal?.value>.25)process.exitCode=1;
