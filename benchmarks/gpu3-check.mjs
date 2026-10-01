// Run after npm ci and npx playwright install chromium, with npm run dev in another terminal.
// This long GPU continuation can take hours with software rendering.
// STEPS=4688 node benchmarks/gpu3-check.mjs > gpu3-result.json
import {chromium} from '@playwright/test';
const steps=Number(process.env.STEPS||4688);
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage();
await page.goto(process.env.BASE_URL||'http://localhost:5173');
await page.locator('#toggle').click();
const result=await page.evaluate(async steps=>{
 const THREE=await import('/node_modules/three/build/three.module.js');
 const {LBM3D}=await import('/src/lbm3d.js');
 const renderer=new THREE.WebGLRenderer();
 const solver=new LBM3D(renderer,{grid:[128,64,64],Re:300,U:.06,seedWarm:true});
 for(let n=0;n<steps;n+=32){solver.step(Math.min(32,steps-n));solver.forces();await new Promise(r=>setTimeout(r,0));}
 const field=solver.field();delete field.data;
 const output={field,frequency:solver.strouhal(),history:solver.history};
 solver.dispose();renderer.dispose();return output;
},steps);
console.log(JSON.stringify(result));await browser.close();
