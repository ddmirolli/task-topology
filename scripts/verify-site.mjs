import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import { connectBrowserbase } from '../pilot/browserbase.mjs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../site',import.meta.url));
const target=process.argv[2] || 'https://mtb-qa.invalid/';
const output=process.argv[3] || '/tmp/mtb-site-qa';
const connection=await connectBrowserbase(), errors=[], evidence=[];
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const assets={};
fs.mkdirSync(output,{recursive:true});
try {
 const context=await connection.browser.newContext({viewport:{width:1280,height:1000},colorScheme:'light'});
 if(target==='https://mtb-qa.invalid/') await context.route('https://mtb-qa.invalid/**',async route=>{
  const name=new URL(route.request().url()).pathname, file=path.join(root,name==='/'?'index.html':name);
  const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.ico':'image/x-icon'};
  if(!fs.existsSync(file))return route.fulfill({status:404,body:'Not found'});
  await route.fulfill({contentType:mime[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const response=await page.goto(target);assert.equal(response.status(),200);
 for(const name of ['index.html','app.js','style.css','results.json','intelligence.json','epoch-source.csv']){
   const url=new URL(name==='index.html'?'./':name,target).href;
   const got=await page.evaluate(async u=>{const r=await fetch(u);return {status:r.status,text:await r.text()};},url);
   assert.equal(got.status,200);const actual=createHash('sha256').update(got.text).digest('hex');
   const expected=createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex');
   assert.equal(actual,expected,`Hosted ${name} differs from worktree`);assets[name]=actual;
 }
 await page.locator('#rows tr').last().waitFor();
 assert.equal(await page.locator('#rows tr').count(),6);
 assert.match(await page.locator('#stats').innerText(),/18/);
 await page.screenshot({path:path.join(output,'desktop-light.png'),fullPage:true});
 await page.locator('#model').selectOption('gpt-5.6-terra');assert.equal(await page.locator('#rows tr').count(),3);
 await page.locator('#ticket').selectOption('01');assert.equal(await page.locator('#rows tr').count(),1);
 assert.match(await page.locator('#rows').innerText(),/2 \/ 3/);
 await page.locator('summary').click();assert.match(await page.locator('details').innerText(),/transcript grading pending/);
 await page.locator('[data-tier="2"]').click();assert.equal(await page.locator('#empty').isVisible(),true);
 assert.equal(await page.locator('#populated').isVisible(),false);
 await page.locator('[data-tier="3"]').click();assert.match(await page.locator('#empty-copy').innerText(),/ticketing/);
 await page.locator('[data-tier="1"]').click();await page.locator('#model').selectOption('all');await page.locator('#ticket').selectOption('all');
 await page.locator('#measure').selectOption('apiEquivalentUsd');assert.match(await page.locator('#chart-title').innerText(),/token cost/);
 await page.locator('[data-sort="elapsedSeconds"]').click();
 const values=await page.locator('#rows tr td:nth-child(4)').allTextContents();assert.deepEqual(values.map(Number),values.map(Number).sort((a,b)=>a-b));
 await page.emulateMedia({colorScheme:'dark'});await page.screenshot({path:path.join(output,'desktop-dark.png'),fullPage:true});
 await page.setViewportSize({width:375,height:900});await page.screenshot({path:path.join(output,'mobile-dark.png'),fullPage:true});
 await page.emulateMedia({colorScheme:'light'});await page.screenshot({path:path.join(output,'mobile-light.png'),fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No page-level horizontal overflow');
 assert.equal(errors.length,0,errors.join('\n'));
 evidence.push({url:target,sourceCommit,assets,responseHeaders:await response.allHeaders(),session:connection.sessionId,rows:6,filters:'passed',tierStates:'passed',sorting:'passed',mobileOverflow:false,pageErrors:errors});
 fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(evidence,null,2));
 console.log(JSON.stringify(evidence));await context.close();
} finally {await connection.close();}
