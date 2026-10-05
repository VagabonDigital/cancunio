import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {previewServer} from './preview.mjs';
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({headless:true, ...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL} : {})});
const server = previewServer(4174);
const output = process.env.QA_OUTPUT || 'qa';
await mkdir(output,{recursive:true});
const failures=[];
try {
for (const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
for (const profile of ['emrys','hannah']) {
 const context=await browser.newContext({viewport});
 const page=await context.newPage();
 page.on('pageerror',e=>failures.push(e.message));
 const saved=new Map();
 let failSave=false;
 await page.route('**/api/bootstrap',r=>r.fulfill({json:{profile,preferences:[{profile:profile==='emrys'?'hannah':'emrys',item_key:'do:cancun-yucatan:punta-laguna',value:'want'},...[...saved].filter(([,value])=>value).map(([item_key,value])=>({profile,item_key,value}))]}}));
 await page.route('**/api/preference',async r=>{const data=r.request().postDataJSON();if(!failSave)saved.set(data.item_key,data.value);await r.fulfill({status:failSave?500:200,json:{ok:!failSave}})});
 await page.goto('http://127.0.0.1:4174',{waitUntil:'domcontentloaded'});
 const cards=page.locator('#cardGrid .card');
 await cards.first().waitFor();
 assert.equal(await cards.count(),59,'Cancun records');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal overflow');
 await page.locator('[data-mode=picks]').click();assert.equal(await cards.count(),0,'empty picks');
 await page.locator('[data-mode=matches]').click();assert.equal(await cards.count(),0,'empty matches');
 await page.locator('[data-mode=explore]').click();
 const first=()=>page.locator('#cardGrid .card[data-id="punta-laguna"]');
 await first().locator('[data-pref=want]').click();
 await page.waitForFunction(()=>document.querySelector('#matchCount').textContent==='1');
 await page.locator('[data-mode=matches]').click();assert.equal(await cards.count(),1,'mutual want');
 await page.screenshot({path:`${output}/${viewport.width}-${profile}-matches.png`});
 await page.locator('[data-mode=picks]').click();assert.equal(await cards.count(),1,'want in picks');
 await first().locator('[data-pref=maybe]').click();assert.equal(await cards.count(),1,'maybe in picks');assert.equal(await page.locator('#matchCount').textContent(),'0');
 await first().locator('[data-pref=skip]').click();assert.equal(await cards.count(),0,'skip excluded');
 await page.locator('[data-mode=explore]').click();
 await first().locator('[data-pref=skip]').click();assert.equal(await page.locator('#pickCount').textContent(),'0','toggle clears');
 await page.locator('#searchInput').fill('Punta Laguna');assert.equal(await cards.count(),1,'search');
 await first().locator('.open-btn').click();await page.locator('.detail-sheet.open').waitFor();assert.match(await page.locator('#sheetBody').textContent(),/Research trail/);
 assert.equal(await page.locator('#sheetClose').evaluate(el=>el===document.activeElement),true,'dialog initial focus');
 await page.keyboard.press('Shift+Tab');assert.equal(await page.locator('#sheetBody .source-link').last().evaluate(el=>el===document.activeElement),true,'focus wraps backwards');
 await page.keyboard.press('Tab');assert.equal(await page.locator('#sheetClose').evaluate(el=>el===document.activeElement),true,'focus wraps forwards');
 await page.locator('[data-sheet-pref=want]').click();await page.waitForFunction(()=>document.querySelector('[data-sheet-pref=want]').getAttribute('aria-pressed')==='true');
 failSave=true;await page.locator('[data-sheet-pref=maybe]').click();
 await page.waitForFunction(()=>document.querySelector('[data-sheet-pref=want]').getAttribute('aria-pressed')==='true');
 assert.equal(await page.locator('#matchCount').textContent(),'1','failed save rolls back card and sheet');failSave=false;
 await page.screenshot({path:`${output}/${viewport.width}-${profile}-detail.png`});
 await page.keyboard.press('Escape');assert.equal(await first().locator('.open-btn').evaluate(el=>el===document.activeElement),true,'focus restored after rerender');
 await page.reload();await cards.first().waitFor();assert.equal(await page.locator('#pickCount').textContent(),'1','saved choice survives reload');
 await first().locator('[data-pref=want]').click();
 await page.locator('#searchInput').fill('Punta Laguna');
 await page.locator('#resetBtn').click();assert.equal(await cards.count(),59);
 await page.locator('.filters-disclosure summary').click();await page.locator('[data-quick=water]').click();
 assert.ok(await cards.count()>0 && await cards.count()<59,'quick filter');
 assert.equal(await page.locator('[data-quick=water]').getAttribute('aria-pressed'),'true');
 await page.locator('#filterDone').click();await page.locator('#resetBtn').click();
 await page.locator('.content-btn[data-content=eat]').click();assert.equal(await cards.count(),20,'eat filter');
 await page.locator('.filters-disclosure summary').click();await page.locator('[data-budget=cheap]').click();assert.ok(await cards.count()>0 && await cards.count()<20,'budget filter');
 await page.locator('.cheap-toggle').click();assert.ok(await page.locator('#cheapToggle').isChecked());assert.equal(await page.locator('#filterCount').textContent(),'2','active filter count');
 await page.screenshot({path:`${output}/${viewport.width}-${profile}-filters.png`});
 await page.locator('#filterDone').click();
 await page.locator('#resetBtn').click();
 await page.locator('[data-destination=rio-beyond]').click();assert.equal(await cards.count(),61,'Rio records');
 await page.locator('.content-btn[data-content=do]').click();assert.equal(await cards.count(),37,'Rio activities');
 await page.locator('#resetBtn').click();
 await page.locator('[data-spatial-view=map]').waitFor({timeout:15000});
 await page.locator('[data-spatial-view=map]').click();await page.locator('.leaflet-marker-icon').first().waitFor();assert.equal(await page.locator('.leaflet-marker-icon').count(),61,'map pins');
 await page.locator('#mapFitBtn').click();
 await page.locator('.leaflet-marker-icon').first().click({force:true});await page.locator('.detail-sheet.open').waitFor();await page.locator('#sheetClose').click();
 await page.locator('[data-destination=cancun-yucatan]').click();await page.waitForFunction(()=>document.querySelectorAll('.leaflet-marker-icon').length===59);
 if(viewport.width>620){await page.locator('[data-spatial-view=split]').click();assert.ok(await page.locator('.spatial-map-pane').isVisible());assert.ok(await cards.first().isVisible());}
 await page.locator('[data-spatial-view=list]').click();
 await page.locator('#cardGrid').scrollIntoViewIfNeeded();
 await page.screenshot({path:`${output}/${viewport.width}-${profile}-board.png`,fullPage:false});
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`${output}/${viewport.width}-${profile}-hero.png`});
 await page.locator('#searchInput').fill('no-matching-trip-123');assert.ok(await page.locator('#emptyState').isVisible());
 await page.locator('#emptyAction').click();assert.equal(await cards.count(),59,'empty filter recovery');
 assert.ok(saved.has('do:cancun-yucatan:punta-laguna'),'canonical preference keys');
 console.log(`PASS ${viewport.width}px / ${profile}: views, destinations, preferences, save rollback, persistence, filters, keyboard dialog, map and recovery`);
 await context.close();
}
}
assert.deepEqual(failures,[],'browser exceptions');
// Failure paths use intercepted local requests, never production accounts.
const edgeContext = await browser.newContext({viewport:{width:320,height:740},reducedMotion:'reduce'});
const edge = await edgeContext.newPage();
let bootstrapFails = true;
await edge.route('**/api/bootstrap', r => r.fulfill({status:bootstrapFails?503:200,json:bootstrapFails?{error:'test'}:{profile:'emrys',preferences:[]}}));
await edge.route('**/leaflet.js', r => r.abort());
await edge.goto('http://127.0.0.1:4174',{waitUntil:'domcontentloaded'});
await edge.locator('#retryLoad').waitFor();
assert.equal(await edge.locator('#board').getAttribute('aria-busy'),'false');
bootstrapFails=false;await edge.locator('#retryLoad').click();await edge.locator('#cardGrid .card').first().waitFor();
assert.ok(await edge.locator('.map-unavailable').isVisible(),'map failure remains readable');
for (const width of [320,768,1024]) {
 await edge.setViewportSize({width,height:900});
 assert.equal(await edge.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${width}px has no horizontal overflow`);
}
for (const destination of ['cancun','rio']) {
 assert.ok(await edge.evaluate(async d=>{const img=new Image();img.src=`/assets/${d}-hero.jpg`;try{await img.decode();return img.naturalWidth>0}catch{return false}},destination),'hero decodes');
}
await edge.route('**/*', r => r.request().resourceType()==='image' && !r.request().url().startsWith('http://127.0.0.1') ? r.abort() : r.fallback());
await edge.reload();await edge.locator('#cardGrid .card').first().scrollIntoViewIfNeeded();
await edge.locator('#cardGrid .image-unavailable').first().waitFor();
assert.ok(await edge.locator('#cardGrid .card-body').first().isVisible(),'unavailable photography preserves content');
await edgeContext.close();
console.log('PASS load/retry, unavailable map/images, hero decoding, reduced motion and 320/768/1024px overflow checks');
} finally {await browser.close();server.close()}


