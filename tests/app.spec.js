import fs from 'node:fs';
import {test,expect} from '@playwright/test';
test('GPU flow evolves, stays finite, respects obstacle, and controls work',async({page},testInfo)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('fonts.googleapis'))errors.push(m.text());});
 await page.goto('/');await page.waitForFunction(()=>window.flowforge);await page.locator('#remove').click();await page.locator('#shape').selectOption('sphere');await page.locator('#add').click();await page.waitForFunction(()=>window.flowforge?.solver.steps>=30,null,{timeout:110000});
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 const result=await page.evaluate(()=>window.flowforge.diagnostics());
 expect(result.finite).toBe(true);expect(result.max).toBeGreaterThan(1);expect(result.max).toBeLessThan(10);expect(result.mean).toBeGreaterThan(.1);
 const field=await page.evaluate(()=>{const {solver,renderer}=window.flowforge;const a=new Float32Array(512*128*4);renderer.readRenderTargetPixels(solver.v[0],0,0,512,128,a);function at(x,y,z){const i=((Math.floor(z/8)*32+y)*512+(z%8)*64+x)*4;return Array.from(a.slice(i,i+3));}return {center:at(26,16,16),near:at(26,22,16),far:at(5,16,16)};});
 expect(Math.hypot(...field.center)).toBe(0);expect(Math.abs(field.near[1])).toBeGreaterThan(.001);
 const screenshot=testInfo.outputPath('flowforge-running.png');await page.screenshot({path:screenshot});if(fs.existsSync('/downloads'))fs.copyFileSync(screenshot,'/downloads/flowforge-running.png');
 await page.getByRole('button',{name:'Run',exact:true}).click();
 await page.locator('#shape').selectOption('box');await page.getByRole('button',{name:'+ Add',exact:true}).click();await expect(page.locator('#selected option')).toHaveCount(2);
 await page.locator('#size').fill('4');await page.locator('#size').dispatchEvent('input');expect(await page.evaluate(()=>window.flowforge.shapes[1].size)).toBe(4);
 await page.getByRole('button',{name:'Remove selected'}).click();await expect(page.locator('#selected option')).toHaveCount(1);
 await page.locator('#speed').fill('1.5');await page.locator('#speed').dispatchEvent('input');expect(await page.evaluate(()=>window.flowforge.solver.inlet)).toBe(1.5);
 expect(errors).toEqual([]);
 console.log(JSON.stringify({result,field}));
});
test('multiple obstacles and extreme controls remain finite',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>window.flowforge?.solver.steps>=2);
 await page.locator('#shape').selectOption('cylinder');await page.locator('#add').click();
 await page.locator('#speed').fill('2');await page.locator('#speed').dispatchEvent('input');
 await page.locator('#viscosity').fill('0.08');await page.locator('#viscosity').dispatchEvent('input');
 await page.waitForFunction(()=>window.flowforge.solver.steps>=40,null,{timeout:110000});
 const d=await page.evaluate(()=>window.flowforge.diagnostics());expect(d.finite).toBe(true);expect(d.max).toBeLessThan(10);expect(d.steps).toBeGreaterThanOrEqual(40);
 await page.locator('#reset').click();expect(await page.evaluate(()=>window.flowforge.solver.steps)).toBeLessThan(5);
});
