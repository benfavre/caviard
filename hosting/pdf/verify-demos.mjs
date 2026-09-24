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
    const menu = page.locator('.ipdf-nav-menu');
    await menu.locator('summary').click();
    assert.equal(await menu.getAttribute('open'), '');
    assert.ok(await menu.getByRole('link', {name:'Tous les outils'}).isVisible());
    if (js) {
      await page.keyboard.press('Escape');
      assert.equal(await menu.getAttribute('open'), null);
      assert.ok(await menu.locator('summary').evaluate(el => el === document.activeElement));
      await menu.locator('summary').click();
      await page.mouse.click(5, 120); // Outside the dropdown, including narrow screens.
      assert.equal(await menu.getAttribute('open'), null);
      if (width < 1050) {
        await menu.locator('summary').click();
        await menu.locator('a[href="#securite"]').click();
        assert.equal(await menu.getAttribute('open'), null);
      } else await page.locator('.ipdf-product-links a[href="#securite"]').click();
      await page.waitForFunction(() => document.querySelector('.ipdf-product-links a[href="#securite"]').getAttribute('aria-current') === 'location');
      await page.locator('[data-demo-undo]').click();
      assert.equal(await page.getByLabel('Nom', {exact:true}).isChecked(), false);
      await page.locator('[data-demo-redo]').click();
      assert.equal(await page.getByLabel('Nom', {exact:true}).isChecked(), true);
      await page.locator('[data-demo-clear]').click();
      assert.equal(await page.locator('.ipdf-demo-options input:checked').count(), 0);
      assert.ok((await page.locator('[data-demo-count]').innerText()).startsWith('0 zones'));
      await page.locator('[data-demo-undo]').click();
      assert.equal(await page.locator('.ipdf-demo-options input:checked').count(), 3);
      await page.locator('.hit-email').click();
      assert.equal(await page.getByLabel('E-mail', {exact:true}).isChecked(), false);
      await page.locator('[data-demo-undo]').click();
      assert.equal(await page.getByLabel('E-mail', {exact:true}).isChecked(), true);
      await page.locator('.ipdf-demo-assistant summary').click();
      assert.equal(await page.locator('.ipdf-demo-assistant').getAttribute('open'), null);
      await page.locator('.ipdf-demo-assistant summary').click();
    } else await menu.locator('summary').click();
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
    console.log(label+': navigation, '+(js?'selection history, ':'native checkboxes, ')+'layout, '+(js?'video, chapters, captions, motion':'no-JS fallback')+' passed');
    await context.close();
  }
} finally { await browser.close(); }
