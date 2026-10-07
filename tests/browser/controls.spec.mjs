import { test, expect } from '@playwright/test';
test.beforeEach(async ({page})=>{
 // Exercise the promised CSS fallback in a real browser, without GPU timing noise.
 await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:original.call(this,type,...args);};});
 await page.goto('/');
});
test('tabs without a default select the first enabled tab and remain keyboard reachable',async({page})=>{
 await page.getByRole('button',{name:'Before tabs'}).focus(); await page.keyboard.press('Tab');
 await expect(page.getByRole('tab',{name:'One',exact:true})).toBeFocused();
 await expect(page.getByRole('tab',{name:'One',exact:true})).toHaveAttribute('aria-selected','true');
 await page.keyboard.press('ArrowRight');await expect(page.getByRole('tab',{name:'Two',exact:true})).toBeFocused();
 await page.keyboard.press('ArrowRight');await expect(page.getByRole('tab',{name:'One',exact:true})).toBeFocused();
});
test('distinct tab values have distinct accessible relationships',async({page})=>{
 const ids=await page.getByRole('tablist',{name:'Distinct IDs'}).getByRole('tab').evaluateAll(els=>els.map(el=>el.getAttribute('aria-controls')));
 expect(new Set(ids).size).toBe(2);
 for(const id of ids) expect(await page.locator('[id]').evaluateAll((els,id)=>els.filter(el=>el.id===id).length,id)).toBe(1);
});
test('nested accordion keyboard navigation stays in its own group',async({page})=>{
 await page.getByRole('button',{name:'Outer',exact:true}).focus();await page.keyboard.press('ArrowDown');
 await expect(page.getByRole('button',{name:'Last outer',exact:true})).toBeFocused();
 await page.getByRole('button',{name:'Other inner',exact:true}).focus();await page.keyboard.press('ArrowDown');
 await expect(page.getByRole('button',{name:'Inner',exact:true})).toBeFocused();
});
test('slider thumb matches the browser step-normalized value',async({page})=>{
 const slider=page.getByRole('slider',{name:'Stepped'});
 await expect(slider).toHaveValue('30');
 expect(await slider.evaluate(el=>Number(el.parentElement.style.getPropertyValue('--plasma-slider-frac')))).toBe(.3);
 await slider.focus();await page.keyboard.press('ArrowRight');await expect(slider).toHaveValue('40');
});
test('switch labels, controlled updates, disabled states and reduced motion work',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.getByText('Controlled',{exact:true}).click();
 await expect(page.getByRole('switch',{name:'Controlled'})).toHaveAttribute('aria-checked','true');
 await expect(page.getByRole('status')).toHaveText('On');
 await page.getByRole('switch',{name:'Controlled'}).press('Space');
 await expect(page.getByRole('status')).toHaveText('Off');
 await expect(page.getByRole('switch',{name:'Disabled switch'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Disabled button'})).toBeDisabled();
 expect(await page.locator('.plasma-switch-knob').first().evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');
});

test('closing an accordion immediately removes its content from keyboard navigation',async({page})=>{
 const trigger=page.getByRole('button',{name:'Last outer',exact:true});
 await trigger.click();await expect(page.getByRole('link',{name:'Last body link'})).toBeVisible();
 await trigger.click();await page.keyboard.press('Tab');
 await expect(page.getByRole('slider',{name:'Stepped'})).toBeFocused();
});
