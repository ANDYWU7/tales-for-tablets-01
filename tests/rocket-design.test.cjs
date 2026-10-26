const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Code-level fixtures exercise the real drawing handlers and story state without
// a browser, dependencies, or a build step.
function fixture(seed, oldStorage=null) {
  const elements = new Map();
  function element(key) {
    if (elements.has(key)) return elements.get(key);
    const value = {innerHTML:'',textContent:'',value:key === '#pen-width' ? '8' : '',hidden:false,disabled:false,
      dataset:{},style:{},attributes:{},events:{},children:[],scrollTop:0,offsetWidth:500,
      classList:{add(){},remove(){}},
      addEventListener(name,fn) { this.events[name] = fn; },
      setAttribute(name,content) { this.attributes[name] = content; },
      removeAttribute(name) { delete this.attributes[name]; },
      remove(){this.removed=true;}, focus(){}, prepend(child) { this.textContent = child.textContent + this.textContent; },
      showModal() { this.open = true; }, close() { this.open = false; this.events.close?.(); },
      setPointerCapture(id) { this.capturedPointer = id; },
      hasPointerCapture(id) { return this.capturedPointer === id; },
      releasePointerCapture() { this.capturedPointer = null; },
      getScreenCTM() { return {inverse:() => ({})}; },
      querySelector(){ return element('selected-progress'); },
      getBoundingClientRect(){ return this.rect || {top:90,left:90,right:110,bottom:110}; },
      insertAdjacentHTML(position,content){ this.innerHTML += content; }
    };
    elements.set(key,value); return value;
  }
  const document = {body:{style:{}},querySelector:selector => selector === 'dialog[open]' ? null : element(selector),
    querySelectorAll:selector => selector === '[data-drop-active]' ? [...elements.values()].filter(e=>e.attributes['data-drop-active']) : [],createElement:() => element('created-span'),addEventListener(){}};
  let storage=oldStorage, storageReads=0, storageWrites=0;
  const effects=[];
  const scheduled=[];
  const audio={play:kind=>effects.push(kind),stop(){},unlock(){},setEnabled(){}};
  const context = vm.createContext({document,window:{addEventListener(){}} , StoryAudio:audio,localStorage:{getItem:() => {storageReads++;return storage;},setItem:(key,value) => {storageWrites++;storage = value;}},
    setTimeout:(fn,delay) => {scheduled.push({fn,delay});return scheduled.length;}, clearTimeout(id){if(scheduled[id-1])scheduled[id-1].cancelled=true;},matchMedia:() => ({matches:true}),
    DOMPoint:class { constructor(x,y) {this.x=x;this.y=y;} matrixTransform() {return this;} }});
  for (const file of ['rocket-designer.js','script.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
    if (file === 'rocket-designer.js') context.RocketStudio = context.window.RocketStudio;
  }
  if(seed) {
    context.__seed=seed;
    vm.runInContext("page=__seed.page||0; sound=__seed.sound!==false; completed=new Set(__seed.completed||[]); rocketDesign=RocketStudio.cleanDesign(__seed.rocketDesign); collected=new Set(__seed.collected||[])",context);
    delete context.__seed;
  }
  return {effects, scheduled, storageUse:()=>({reads:storageReads,writes:storageWrites}), run:code => vm.runInContext(code,context),element,state:() => JSON.parse(vm.runInContext('JSON.stringify({page,sound,completed:[...completed],rocketDesign,collected:[...collected]})',context)),studio:context.RocketStudio};
}
const stroke = points => ({color:'#f3fbff',width:8,points});
const drawing = {name:'Comet & Friends',parts:{
  body:[stroke([[110,75],[250,75],[250,350],[110,350],[110,75]])],
  nose:[stroke([[80,330],[180,70],[280,330],[80,330]])],
  fin:[stroke([[250,80],[80,330],[250,280],[250,80]])]
},assembled:[]};
const assembledDrawing = {...drawing,assembled:['body','nose','fin','mirrored-fin']};
function keyDraw(f) {
  const board=f.element('#rocket-drawing');
  for (const key of [' ','ArrowUp','ArrowUp',' ']) board.events.keydown({key,preventDefault(){},repeat:false});
}
function drawAll(f,name='My Comet') {
  keyDraw(f); f.element('#next-part').events.click();
  keyDraw(f); f.element('#next-part').events.click();
  keyDraw(f); f.element('#rocket-name').events.input({target:{value:name}});
  f.element('#rocket-form').events.submit({preventDefault(){}});
}
function dragTo(f,action,type,{x=400,y=400,cancelled=false,moved=true}={}) {
  const target=f.element('#test-'+action);
  target.dataset={action,draggable:type}; target.closest=()=>target;
  f.element(`[data-drop="${type}"]`).rect={left:380,right:420,top:380,bottom:420};
  f.element('#book').events.pointerdown({button:0,target,pointerId:1,clientX:100,clientY:100});
  if (moved) f.element('#book').events.pointermove({pointerId:1,clientX:x,clientY:y});
  f.run('endPointer')({pointerId:1,clientX:x,clientY:y},cancelled);
}
function fit(f,key) { dragTo(f,'assemble-'+key,'assemble-'+key); }

test('visual guides follow unfinished supplies, parts, and landing actions',() => {
  const f=fixture({page:1,collected:['box']});
  const supplies=f.run('suppliesScene()');
  assert.ok(!supplies.includes('data-guide-for="box"'));
  for (const key of ['funnel','tape']) assert.ok(supplies.includes(`data-guide-for="${key}"`));
  assert.ok(supplies.includes('class="cue-outline"'));
  assert.ok(supplies.includes('data-drop="collect"'));
  assert.ok(supplies.includes('pointer-events="none"><path'));
  f.run('rocketDesign=RocketStudio.cleanDesign('+JSON.stringify({...drawing,assembled:['nose']})+')');
  const workshop=f.run('workshopScene()');
  assert.ok(!workshop.includes('data-guide-for="assemble-nose"'));
  for (const key of ['body','fin','mirrored-fin']) {
    assert.ok(workshop.includes(`data-guide-for="assemble-${key}"`));
    assert.ok(workshop.includes(`data-drop="assemble-${key}"`));
  }
  assert.ok(f.run('landingScene()').includes('data-guide-for="land"'));
  f.run('completed.add(4)');
  assert.ok(!f.run('landingScene()').includes('data-guide-for="land"'));
});

test('dragging highlights only the matching destination and cancellation clears it',() => {
  const f=fixture({page:1});
  const target=f.element('#moving-supply');
  target.dataset={action:'box',draggable:'collect'}; target.closest=()=>target;
  const destination=f.element('[data-drop="collect"]');
  f.element('#book').events.pointerdown({button:0,target,pointerId:5,clientX:100,clientY:100});
  assert.equal(destination.attributes['data-drop-active'],'true');
  assert.equal(f.element('[data-drop="land"]').attributes['data-drop-active'],undefined);
  f.run('endPointer')({pointerId:5,clientX:100,clientY:100},true);
  assert.equal(destination.attributes['data-drop-active'],undefined);
  assert.deepEqual(f.state().collected,[]);
});

test('success clears guidance without showing another instruction',() => {
  const f=fixture({page:1,collected:['box','funnel']});
  f.run('render()'); dragTo(f,'tape','collect');
  assert.equal(f.element('[data-guide-for="tape"]').removed,true);
  assert.equal(f.element('#crate').attributes['data-inactive'],'true');
  assert.equal(f.element('#activity-card').hidden,true);
  assert.equal(f.element('#scene-toast').textContent,'');
  f.run('page=0; render()');
  assert.equal(f.element('#activity-card').hidden,false);
  assert.equal(f.element('#activity-instruction').hidden,false);
});

test('all three drawings and a name are required, and assembly is a separate condition',() => {
  const {studio}=fixture();
  assert.equal(studio.isReady(studio.cleanDesign({name:'Rocket',parts:{}})),false);
  assert.equal(studio.isReady(studio.cleanDesign({...drawing,name:'   '})),false);
  assert.equal(studio.isReady(studio.cleanDesign(drawing)),true);
  assert.equal(studio.isAssembled(studio.cleanDesign(drawing)),false);
  assert.equal(studio.isAssembled(studio.cleanDesign(assembledDrawing)),true);
  assert.equal(studio.isAssembled(studio.cleanDesign({...drawing,assembled:['body','nose','fin']})),false);
  assert.equal(studio.isReady(studio.cleanDesign({...drawing,parts:{...drawing.parts,fin:[]}})),false);
});

test('invalid drawing data is discarded while unordered placed parts are preserved',() => {
  const {studio}=fixture();
  const cleaned=studio.cleanDesign({...drawing,name:'  Explorer  ',parts:{...drawing.parts,body:[
    {color:'url(evil)',width:8,points:[[1,2],[3,4]]},
    stroke([[Infinity,2],[-10,900],[100,10]])
  ]},assembled:['nose','fin']});
  assert.equal(cleaned.name,'Explorer');
  assert.equal(cleaned.parts.body.length,1);
  assert.equal(cleaned.parts.body[0].points[0][0],0);
  assert.equal(cleaned.parts.body[0].points[0][1],420);
  assert.equal(cleaned.assembled.length,2);
  assert.ok(cleaned.assembled.includes('nose'));
  assert.ok(cleaned.assembled.includes('fin'));
});

test('assembled rocket contains the actual three part drawings and escapes names',() => {
  const {studio}=fixture();
  const svg=studio.renderRocket({...assembledDrawing,name:'<script>&"'},0,0);
  assert.ok(!svg.includes('<script>'));
  assert.ok(svg.includes('&lt;script&gt;&amp;&quot;'));
  for (const key of ['body','nose','fin','mirrored-fin']) assert.ok(svg.includes('data-rocket-part="'+key+'"'));
  assert.ok(svg.includes('M110 75 L250 75 L250 350 L110 350 L110 75'));
});

test('blueprint stages cannot be skipped and undo or clear affects only the current part',() => {
  const f=fixture({page:2,completed:[0,1],sound:false});
  f.element('#open-book').events.click(); f.element('#design-rocket').events.click();
  f.element('#next-part').events.click();
  assert.ok(f.element('#blueprint-instruction').textContent.startsWith('Draw the body'));
  keyDraw(f); f.element('#next-part').events.click();
  assert.ok(f.element('#blueprint-instruction').textContent.startsWith('Draw the nose cone'));
  keyDraw(f); f.element('#undo-drawing').events.click();
  assert.equal(f.element('#next-part').disabled,true);
  keyDraw(f); f.element('#clear-drawing').events.click();
  assert.equal(f.element('#next-part').disabled,true);
  keyDraw(f); f.element('#next-part').events.click(); keyDraw(f);
  assert.equal(f.element('#save-rocket').disabled,true);
  f.element('#rocket-name').events.input({target:{value:'Stage Rocket'}});
  assert.equal(f.element('#save-rocket').disabled,false);
  f.element('#rocket-form').events.submit({preventDefault(){}});
  assert.equal(f.state().rocketDesign.parts.body.length,1);
  assert.equal(f.state().rocketDesign.parts.nose.length,1);
  assert.equal(f.state().rocketDesign.parts.fin.length,1);
});

test('saving a blueprint does not unlock launch; the reader must fit all their parts',() => {
  const f=fixture({page:2,completed:[0,1],sound:false});
  f.element('#open-book').events.click(); f.element('#design-rocket').events.click();
  drawAll(f);
  assert.equal(f.run('completed.has(2)'),false);
  f.run('turn(1)'); assert.equal(f.run('page'),2);
  fit(f,'mirrored-fin'); assert.equal(f.run('rocketDesign.assembled.length'),1);
  fit(f,'nose'); assert.equal(f.run('rocketDesign.assembled.length'),2);
  fit(f,'fin'); assert.equal(f.run('rocketDesign.assembled.length'),3);
  fit(f,'nose'); assert.equal(f.run('rocketDesign.assembled.length'),3);
  assert.equal(f.run('completed.has(2)'),false);
  f.run('turn(1)'); assert.equal(f.run('page'),2);
  fit(f,'body'); assert.equal(f.run('completed.has(2)'),true);
  f.run('turn(1)'); assert.equal(f.run('page'),3);
  const svg=f.element('#scene').innerHTML;
  assert.ok(svg.includes('My Comet'));
  for (const key of ['body','nose','fin','mirrored-fin']) assert.ok(svg.includes('data-rocket-part="'+key+'"'));
  assert.ok(f.element('#story-text').textContent.includes('My Comet'));
});

test('unordered partial assembly survives page changes and accepts any remaining part',() => {
  const f=fixture({page:2,completed:[0,1],sound:false,rocketDesign:{...drawing,assembled:['mirrored-fin','body']}});
  f.element('#open-book').events.click();
  assert.ok(f.element('#activity-instruction').textContent.includes('outlined spaces'));
  assert.ok(!f.element('#scene').innerHTML.includes('data-action="assemble-body"'));
  assert.ok(!f.element('#scene').innerHTML.includes('data-action="assemble-mirrored-fin"'));
  fit(f,'fin'); fit(f,'nose');
  assert.equal(f.state().completed.includes(2),true);
});

test('saved parts appear in landing and Mars scenes, and restart clears the blueprint',() => {
  const f=fixture({page:4,completed:[0,1,2,3],sound:false,rocketDesign:assembledDrawing});
  f.element('#open-book').events.click(); assert.equal(f.run('page'),4);
  for (const key of ['body','nose','fin']) assert.ok(f.element('#scene').innerHTML.includes('data-rocket-part="'+key+'"'));
  f.run('page=5; render()'); assert.ok(f.element('#scene').innerHTML.includes('Comet &amp; Friends'));
  f.run('restartBook()'); assert.equal(f.run('page'),0); assert.equal(f.run('completed.size'),0);
  assert.equal(f.state().rocketDesign,null);
});

test('refresh starts fresh and ignores previous browser storage',() => {
  const old=JSON.stringify({page:5,completed:[0,1,2,3,4,5],collected:['box','funnel','tape'],sound:false,rocketDesign:assembledDrawing});
  const f=fixture(undefined,old);
  assert.equal(f.run('page'),0); assert.equal(f.run('completed.size'),0);
  assert.equal(f.run('collected.size'),0); assert.equal(f.run('rocketDesign'),null);
  assert.deepEqual(f.storageUse(),{reads:0,writes:0});
});

test('pointer drawing handles empty coalesced events and ignores a second finger',() => {
  const f=fixture({page:2,completed:[0,1],sound:false});
  f.element('#open-book').events.click(); f.element('#design-rocket').events.click();
  const board=f.element('#rocket-drawing');
  const pointer=(id,x,y,type)=>({pointerId:id,clientX:x,clientY:y,button:0,type,preventDefault(){},getCoalescedEvents:()=>[]});
  board.events.pointerdown(pointer(7,100,50,'pointerdown'));
  board.events.pointerdown(pointer(8,300,300,'pointerdown'));
  board.events.pointermove(pointer(7,160,150,'pointermove'));
  board.events.pointerup(pointer(7,200,250,'pointerup'));
  f.element('#next-part').events.click(); keyDraw(f);
  f.element('#next-part').events.click(); keyDraw(f);
  f.element('#rocket-name').events.input({target:{value:'Touch Rocket'}});
  f.element('#rocket-form').events.submit({preventDefault(){}});
  const body=f.state().rocketDesign.parts.body;
  assert.equal(body.length,1);
  assert.deepEqual(body[0].points,[[100,50],[160,150],[200,250]]);
  assert.equal(board.capturedPointer,null);
});

test('closing retains draft edits without changing the assembled rocket until confirmation',() => {
  const f=fixture({page:2,completed:[0,1,2,3,4],sound:false,rocketDesign:assembledDrawing});
  f.element('#open-book').events.click(); f.element('#design-rocket').events.click();
  f.element('#clear-drawing').events.click();
  f.element('#close-designer').events.click();
  assert.equal(f.run('rocketDesign.parts.body.length'),1);
  assert.equal(f.run('rocketDesign.assembled.length'),4);
  f.element('#design-rocket').events.click();
  assert.equal(f.element('#next-part').disabled,true);
  keyDraw(f);
  f.element('#next-part').events.click(); f.element('#next-part').events.click();
  f.element('#rocket-name').events.input({target:{value:'Renamed Rocket'}});
  f.element('#rocket-form').events.submit({preventDefault(){}});
  assert.equal(f.run('rocketDesign.assembled.length'),0);
  assert.equal(f.run('completed.has(2)'),false);
  assert.equal(f.run('completed.has(4)'),false);
});

test('the second fin reuses the original drawing with horizontal reflection',() => {
  const {studio}=fixture();
  const mirrored=studio.renderPart(drawing,'mirrored-fin');
  assert.ok(mirrored.includes('translate(102 0) scale(-1 1)'));
  assert.ok(mirrored.includes('M250 80 L80 330 L250 280 L250 80'));
  assert.deepEqual(Object.keys(studio.cleanDesign(drawing).parts),['body','nose','fin']);
});

test('page changes preserve the placed parts and the remaining fin',() => {
  const f=fixture({page:2,completed:[0,1],sound:false,rocketDesign:{...drawing,assembled:['body','nose','fin']}});
  f.element('#open-book').events.click();
  f.run('turn(-1); turn(1)');
  assert.equal(f.run('page'),2);
  assert.ok(f.element('#activity-instruction').textContent.includes('outlined spaces'));
  assert.ok(f.element('#scene').innerHTML.includes('data-action="assemble-mirrored-fin"'));
  assert.ok(!f.element('#scene').innerHTML.includes('data-action="assemble-fin"'));
  fit(f,'mirrored-fin');
  assert.equal(f.run('completed.has(2)'),true);
});

test('supplies require valid drops; taps, wrong destinations, and cancellation do not collect',() => {
  const f=fixture({page:1,completed:[0],sound:false});
  f.element('#open-book').events.click();
  const box=f.element('#test-box'); box.dataset={action:'box',draggable:'collect'}; box.closest=()=>box;
  f.element('#scene').events.click({target:box});
  assert.equal(f.run('collected.size'),0);
  dragTo(f,'box','collect',{x:600,y:100}); assert.equal(f.run('collected.size'),0);
  dragTo(f,'box','collect',{cancelled:true}); assert.equal(f.run('collected.size'),0);
  dragTo(f,'box','collect',{moved:false}); assert.equal(f.run('collected.size'),0);
  dragTo(f,'box','collect'); assert.equal(f.run('collected.size'),1);
  dragTo(f,'funnel','collect'); assert.equal(f.run('completed.has(1)'),false);
  dragTo(f,'tape','collect'); assert.equal(f.run('completed.has(1)'),true);
});

test('both garage fins are labeled Fin and neither moves on a tap',() => {
  const f=fixture({page:2,completed:[0,1],sound:false,rocketDesign:drawing});
  f.element('#open-book').events.click();
  const svg=f.element('#scene').innerHTML;
  assert.equal((svg.match(/>Fin<\/text>/g)||[]).length,2);
  assert.ok(!svg.includes('mirrored fin'));
  f.run("interact('assemble-fin', document.querySelector('#test-part'))");
  f.run("interact('assemble-mirrored-fin', document.querySelector('#test-part'))");
  assert.equal(f.run('rocketDesign.assembled.length'),0);
  dragTo(f,'assemble-mirrored-fin','assemble-mirrored-fin',{x:600,y:100});
  assert.equal(f.run('rocketDesign.assembled.length'),0);
  fit(f,'mirrored-fin'); assert.equal(f.run('rocketDesign.assembled.length'),1);
});

test('the landing rocket has a full transparent grab area and still requires a valid drop',() => {
  const f=fixture({page:4,completed:[0,1,2,3],sound:false,rocketDesign:assembledDrawing});
  f.element('#open-book').events.click();
  const svg=f.element('#scene').innerHTML;
  assert.ok(svg.includes('class="rocket-hitbox"'));
  assert.ok(svg.includes('width="188" height="304"'));
  assert.ok(svg.includes('fill="transparent" pointer-events="all"'));
  f.run("interact('land', document.querySelector('#test-land'))");
  assert.equal(f.run('completed.has(4)'),false);
  dragTo(f,'land','land',{x:600,y:100}); assert.equal(f.run('completed.has(4)'),false);
  dragTo(f,'land','land'); assert.equal(f.run('completed.has(4)'),true);
});

test('keyboard dragging requires movement and dropping at the destination',() => {
  const f=fixture({page:1,completed:[0],sound:false});
  f.element('#open-book').events.click();
  const target=f.element('#keyboard-box'); target.dataset={action:'box',draggable:'collect'}; target.closest=()=>target;
  f.element('[data-drop="collect"]').rect={left:380,right:420,top:380,bottom:420};
  const key=value=>f.element('#scene').events.keydown({target,key:value,shiftKey:true,preventDefault(){},stopPropagation(){}});
  key('Enter'); key('Enter'); assert.equal(f.run('collected.size'),0);
  key(' '); key('ArrowRight'); key('Escape'); assert.equal(f.run('collected.size'),0);
  assert.equal(target.style.transform,'');
  key(' ');
  for(let i=0;i<8;i++) { key('ArrowRight'); key('ArrowDown'); }
  assert.equal(f.run('page'),1);
  key('Enter'); assert.equal(f.run('collected.size'),1);
});

test('each packed supply remains packed when readers flip back and return',() => {
  const f=fixture({page:1,completed:[0],sound:false});
  f.element('#open-book').events.click(); dragTo(f,'box','collect');
  f.run('turn(-1); turn(1)');
  assert.equal(f.run('collected.size'),1);
  const svg=f.element('#scene').innerHTML;
  assert.match(svg,/data-action="box"[^>]*data-used="true"/);
  assert.ok(svg.includes('>1 / 3</text>'));
  dragTo(f,'funnel','collect'); dragTo(f,'tape','collect');
  assert.equal(f.run('completed.has(1)'),true);
});

test('body and nose drawings and the current blueprint step survive closing and page flips',() => {
  const f=fixture({page:2,completed:[0,1],sound:false});
  f.element('#open-book').events.click(); f.element('#design-rocket').events.click();
  keyDraw(f); f.element('#next-part').events.click(); keyDraw(f);
  f.element('#close-designer').events.click();
  f.run('turn(-1); turn(1)'); f.element('#design-rocket').events.click();
  assert.ok(f.element('#blueprint-instruction').textContent.startsWith('Draw the nose cone'));
  assert.equal(f.element('#next-part').disabled,false);
  f.element('#next-part').events.click(); keyDraw(f);
  f.element('#rocket-name').events.input({target:{value:'Remember Me'}});
  f.element('#close-designer').events.click(); f.element('#design-rocket').events.click();
  assert.equal(f.element('#rocket-name').value,'Remember Me');
  f.element('#rocket-form').events.submit({preventDefault(){}});
  for(const key of ['body','nose','fin']) assert.equal(f.state().rocketDesign.parts[key].length,1);
});

test('leaving during countdown remembers launch without starting another countdown',() => {
  const f=fixture({page:3,completed:[0,1,2],sound:false,rocketDesign:assembledDrawing});
  f.element('#open-book').events.click(); f.run("interact('launch',document.querySelector('#test-launch'))");
  assert.equal(f.run('completed.has(3)'),true);
  f.run('turn(-1); turn(1)');
  assert.equal(f.element('#launch-rocket').style.visibility,'hidden');
  assert.equal(f.element('#countdown').textContent,'The rocket has launched.');
  assert.ok(f.scheduled.filter(t=>t.delay===2550).every(t=>t.cancelled));
});

test('landing and the backpack reveal remain completed on revisiting their chapters',() => {
  const f=fixture({page:4,completed:[0,1,2,3],sound:false,rocketDesign:assembledDrawing});
  f.element('#open-book').events.click(); dragTo(f,'land','land');
  f.run('turn(-1); turn(1)');
  assert.equal(f.element('#landing-rocket').style.transform,'translate(108px, 133px)');
  assert.match(f.element('#scene').innerHTML,/data-action="land"[^>]*data-used="true"/);
  f.run("turn(1); interact('snacks',document.querySelector('#test-bag'))");
  f.run('turn(-1); turn(1)');
  assert.ok(f.element('#story-text').textContent.includes('Inside the backpack'));
  assert.ok(f.element('#snack-surprise').innerHTML.includes('path'));
  assert.match(f.element('#scene').innerHTML,/data-action="snacks"[^>]*data-used="true"/);
});

test('restart clears an unfinished blueprint as well as chapter actions',() => {
  const f=fixture({page:2,completed:[0,1],collected:['box'],sound:false});
  f.element('#open-book').events.click(); f.element('#design-rocket').events.click(); keyDraw(f);
  f.element('#close-designer').events.click(); f.run('restartBook()');
  f.run('page=2; render()'); f.element('#design-rocket').events.click();
  assert.equal(f.element('#next-part').disabled,true);
  assert.equal(f.element('#drawing-placeholder').hidden,false);
  assert.equal(f.run('collected.size'),0);
  assert.deepEqual(f.storageUse(),{reads:0,writes:0});
});

test('dog clicks bark once, parts clank, and launch triggers exhaust audio',() => {
  const f=fixture({page:2,completed:[0,1],rocketDesign:drawing});
  f.element('#open-book').events.click();
  const dog=f.element('#test-dog'); dog.dataset={action:'dog'}; dog.closest=()=>dog;
  f.element('#book').events.pointerdown({button:0,target:dog});
  f.element('#scene').events.click({target:dog});
  assert.equal(f.effects.filter(kind=>kind==='dog').length,1);
  assert.ok(f.element('#scene-toast').textContent.includes('enough tape'));
  fit(f,'fin'); assert.ok(f.effects.includes('assemble'));
  f.run("page=3;render();interact('launch',document.querySelector('#test-launch'))");
  f.scheduled.find(t=>t.delay===2550 && !t.cancelled).fn();
  assert.ok(f.effects.includes('launch'));
});

test('Biscuit responds to menu clicks and keyboard activation without opening the book',()=>{
  const f=fixture();f.element('#reader').hidden=true;
  const dog=f.element('#menu-biscuit');dog.dataset={action:'dog'};dog.closest=()=>dog;
  const illustration=f.element('#menu-art').innerHTML;
  assert.ok(illustration.includes('data-action="dog"'));
  assert.ok(!illustration.includes('data-action="mars"'));
  assert.ok(!illustration.includes('data-action="star"'));
  f.element('#menu-art').events.click({target:dog});
  assert.equal(f.effects.filter(kind=>kind==='dog').length,1);
  assert.equal(f.element('#menu-dog-response').hidden,false);
  assert.ok(f.element('#menu-dog-response').textContent.includes('Can I come to Mars'));
  assert.equal(f.element('#reader').hidden,true);
  f.element('#menu-art').events.keydown({target:dog,key:'Enter',preventDefault(){}});
  assert.equal(f.effects.filter(kind=>kind==='dog').length,2);
  f.element('#open-book').events.click();
  assert.equal(f.element('#menu-dog-response').hidden,true);
});

test('Biscuit keeps his dialogue when sound is muted and responds in each dog scene',()=>{
  const f=fixture({sound:false});f.element('#reader').hidden=false;
  const dog=f.element('#biscuit');dog.dataset={action:'dog'};dog.closest=()=>dog;
  for(const chapter of [0,2,5]){
    f.run(`page=${chapter};render()`);
    f.element('#scene').events.click({target:dog});
    assert.ok(f.element('#scene-toast').textContent.includes('Biscuit'));
  }
  assert.equal(f.effects.filter(kind=>kind==='dog').length,0);
});
