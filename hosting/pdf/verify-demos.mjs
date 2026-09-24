import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const origin = process.env.INKLURA_DOWNLOAD_ORIGIN || 'https://pdf.inklura.fr';
await mkdir('output/hosting-verification', {recursive:true});
const browser = await chromium.launch();
try {
  for (const [label,width,js,motion,dark] of [['demo-desktop',1440,true,'no-preference',false],['demo-mobile',390,true,'reduce',false],['demo-dark',1440,true,'no-preference',true],['demo-no-js',390,false,'reduce',false]]) {
    const context = await browser.newContext({viewport:{width,height:1000},javaScriptEnabled:js,reducedMotion:motion,colorScheme:dark?'dark':'light'});
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin);
    await page.locator('.ipdf-lab').waitFor();
    assert.equal(await page.locator('.ipdf-demo-options input:checked').count(),3);
    await page.getByLabel('Nom',{exact:true}).uncheck();
    await page.waitForTimeout(500);
    assert.equal(await page.locator('.mask-name').evaluate(el=>getComputedStyle(el).opacity),'0');
    await page.getByLabel('Nom',{exact:true}).check();
    if(js){
      // Exercise chapter seeking as the first media request (preload=none).
      await page.locator('[data-video-time="19"]').click();
      await page.waitForFunction(()=>document.querySelector('video').currentTime>=19 && !document.querySelector('video').paused);
      await page.locator('video').evaluate(v=>v.pause());
      assert.equal(await page.locator('video').evaluate(v=>v.error),null);
      await page.waitForFunction(()=>[...document.querySelectorAll('track')].every(t=>t.readyState===2));
      assert.ok(await page.locator('video').evaluate(v=>v.textTracks[0].cues.length>=4));
      if(motion==='reduce') assert.equal(await page.locator('.ipdf-flow-path').evaluate(el=>getComputedStyle(el).animationName),'none');
      else {
        await page.locator('[data-demo-replay]').click();
        assert.equal(await page.locator('.ipdf-scanner').evaluate(el=>getComputedStyle(el).animationName),'ipdf-scan');
      }
    }
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+' overflow');
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    await page.screenshot({path:'output/hosting-verification/'+label+'.png',fullPage:true});
    assert.deepEqual(errors,[]);
    console.log(label+': checkboxes, layout, '+(js?'video, chapters, captions, motion':'no-JS fallback')+' passed');
    await context.close();
  }
} finally { await browser.close(); }
