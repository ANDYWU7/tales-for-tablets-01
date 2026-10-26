'use strict';

const $ = (selector) => document.querySelector(selector);
const chapters = [
  { name: 'Johnny watches Mars', title: 'Johnny watches <em>Mars</em>', text: 'One evening, Johnny spots Mars shining above his house and wonders what it would be like to visit. He points it out to Biscuit, who tilts his head as Johnny explains how they could build a rocket in the garage.', hint: 'Tap Mars to begin.' },
  { name: 'Gathering the supplies', title: 'Gathering the <em>supplies</em>', text: 'Johnny searches the house for things he can use to build his rocket. He finds a cardboard box, a kitchen funnel, and a roll of shiny tape, then brings out a crate to carry everything to the garage.', hint: 'Drag the supplies into the crate.' },
  { name: 'Building in the garage', title: 'Building from your <em>blueprint</em>', text: 'Johnny rolls out a blueprint and asks you to draw the body, nose cone, and fin for his rocket. After he cuts out your drawings, you can fit your parts together in the garage. Biscuit watches as the rocket begins to take shape.', hint: 'Draw the parts, then assemble your rocket.' },
  { name: 'Preparing for takeoff', title: 'Preparing for <em>takeoff</em>', text: 'Johnny checks that their helmets fit before helping Biscuit into the rocket. Once they are settled, he reaches for the red button beside his seat. A rumble begins beneath them as the rocket gets ready to leave the ground.', hint: 'Press the launch button when you’re ready.' },
  { name: 'Arriving on Mars', title: 'Arriving on <em>Mars</em>', text: 'As the rocket travels through space, Johnny watches Earth grow smaller through the window. Soon the red hills of Mars appear ahead of them. He looks for a clear patch of ground where he and Biscuit can land safely.', hint: 'Drag your rocket onto the landing spot.' },
  { name: 'Looking for a snack', title: 'Looking for a <em>snack</em>', text: 'After they step onto Mars, Johnny reaches into his pocket and realizes he forgot to pack their snacks. His tummy rumbles as Biscuit noses the backpack they brought along. Johnny kneels down to see what his friend has found.', hint: 'Open the backpack to see what Biscuit packed.' }
];
let page = 0;
let sound = true;
let speaking = false;
let completed = new Set();
let collected = new Set();
let rocketDesign = null;
let timers = [];
let launching = false;
let drag = null;
let keyboardDrag = null;
let swipe = null;
let suppressClick = false;
let toastTimer;
// Story state lives only in this document. Reloading always starts a fresh book.
const later = (fn, ms) => { const timer = setTimeout(fn, ms); timers.push(timer); return timer; };

// All art is drawn here with native SVG, with no external files or libraries.
const action = (name, label, extra = '') => {
  const packed=['box','funnel','tape'].includes(name) && collected.has(name);
  const used=packed || (name==='launch' && completed.has(3)) || (name==='land' && completed.has(4)) || (name==='snacks' && completed.has(5));
  return `data-action="${name}" role="button" tabindex="${used ? -1 : 0}" aria-label="${label}" ${used ? 'data-used="true" aria-disabled="true"' : ''} ${packed ? 'style="opacity:.22"' : ''} ${extra}`;
};
const cueOutline = (x,y,width,height,radius=12) => `<rect class="cue-outline" x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" aria-hidden="true"/>`;
const guideArrow = (name,d) => `<g class="drag-guide" data-guide-for="${name}" aria-hidden="true" pointer-events="none"><path d="${d}" marker-end="url(#drag-arrow)"/></g>`;
function partGuide(key,source,destination) {
  const [x,y,w,h]=source,[tx,ty,tw,th]=destination;
  const sx=x+w/2,sy=y+h/2,ex=280+tx+tw/2,ey=300+ty+th/2;
  const length=Math.hypot(ex-sx,ey-sy),ux=(ex-sx)/length,uy=(ey-sy)/length;
  const offset=Math.min(Math.max(w,h)/2+20,length*.4);
  const startX=sx+ux*offset,startY=sy+uy*offset,endX=ex-ux*18,endY=ey-uy*18;
  return guideArrow('assemble-'+key,`M${startX} ${startY} Q${(startX+endX)/2} ${(startY+endY)/2-18} ${endX} ${endY}`);
}
const star = (x, y, size = 4, color = '#fff2ad') => `<path d="M${x} ${y-size} Q${x+1} ${y-1} ${x+size} ${y} Q${x+1} ${y+1} ${x} ${y+size} Q${x-1} ${y+1} ${x-size} ${y} Q${x-1} ${y-1} ${x} ${y-size}" fill="${color}"/>`;
function sky() {
  let result = '<rect width="560" height="600" fill="url(#sky)"/>';
  for (let i = 0; i < 67; i++) { const x = (i * 137 + 23) % 540 + 10; const y = (i * 83 + 19) % 430 + 10; result += `<circle cx="${x}" cy="${y}" r="${i % 4 === 0 ? 1.6 : .8}" fill="${i % 3 ? '#b5deff' : '#ffeb9d'}" opacity="${.25 + i % 5 * .13}"/>`; }
  [[59,89,6],[270,57,5],[458,205,6],[104,248,5],[361,324,4],[506,75,4],[208,162,3]].forEach(([x,y,s],i) => { result += `<g class="twinkle" style="animation-delay:${i*.6}s" ${action('star', 'Make a star twinkle')}>${cueOutline(x-12,y-12,24,24,12)}${star(x,y,s)}<circle cx="${x}" cy="${y}" r="19" fill="transparent"/></g>`; });
  return result;
}
function johnny(x, y, scale = 1, astronaut = false) {
  return `<g transform="translate(${x} ${y}) scale(${scale})" stroke="#192e37" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M-25 91L-30 132 -7 135 2 99 13 136 35 132 26 88" fill="${astronaut ? '#e2dfc9' : '#3989d7'}"/><path d="M-30 126q-19 6-15 16l35 1 4-14M14 130l2 14 37-2q1-12-21-14" fill="#b46e43"/>
    <path d="M-20 37q-20 6-29 35l13 10 17-23M22 38q20-16 31-46l12 4q-5 45-32 62" fill="${astronaut ? '#eae4cc' : '#ffce39'}"/><path d="M52-10q-3-9 3-15l3 10q6-18 10-12l-2 13q11-8 12-2L65 0" fill="#e9ac75"/>
    <path d="M-22 34Q0 25 25 35L32 94Q4 106-30 92Z" fill="${astronaut ? '#eee7ce' : '#ffcf3c'}"/><path d="M-20 47L-18 85M19 48L23 83" stroke="#d99b20" stroke-width="2"/>
    ${astronaut ? '<rect x="-13" y="52" width="27" height="21" rx="4" fill="#668c8d"/><circle cx="-4" cy="61" r="3" fill="#eab253"/><path d="M4 61h5" stroke="#f6ebd3"/>' : '<path d="M-8 34l8 13 11-14" fill="#fff2b8"/><path d="M-11 77h20" stroke="#e7ab23"/>'}
    <path d="M-8 16v19q8 8 17-1V14" fill="#d99563"/><ellipse cx="0" cy="-14" rx="31" ry="38" fill="#edb781"/><path d="M-29-13q-16-20 2-38l-4-8 20 2 8-11 12 12 14-2q22 14 11 36L22-32 9-25 4-38-8-25-20-30Z" fill="#433730"/>
    <path d="M-28-10q-14-7-12 7t14 9" fill="#edb781"/><path d="M11-16q5-4 9 0" fill="none"/><ellipse cx="16" cy="-9" rx="2" ry="3" fill="#192e37" stroke="none"/><path d="M24-7l6 9-9 2M13 11q7 6 14-1" fill="none" stroke-width="2.3"/><ellipse cx="4" cy="4" rx="7" ry="4" fill="#e5966b" stroke="none"/>
    ${astronaut ? '<circle cx="0" cy="-13" r="48" fill="#b6e4e916" stroke="#e3e6ce" stroke-width="6"/><path d="M-34-35q6-16 24-18" fill="none" stroke="#ffffed" stroke-width="4"/><path d="M-30 26q30 11 58-1" fill="none" stroke="#54787d" stroke-width="7"/>' : ''}
  </g>`;
}
function dog(x, y, scale = 1, helmet = false) {
  return `<g transform="translate(${x} ${y}) scale(${scale})"><g ${action('dog','Say hello to Biscuit the dog')} stroke="#24323a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${cueOutline(-65,-46,120,130,22)}<path d="M-25 46q-33-3-32-27 11 18 31 9" fill="#bd8557"/><path d="M-27 20q-10 34 4 50l45-1q10-14-1-44" fill="#cb9768"/><path d="M-19 50l-4 24h18l6-25M11 50l2 24h17q1-8-9-8" fill="#dfb37c"/><path d="M-24-19q23-20 46 3l4 39q-9 19-35 11l-20-17Z" fill="#dbaf79"/><path d="M-24-20q-22 2-20 29 7 16 20 1l5-24M18-18q24 5 18 32-8 11-17-4" fill="#976443"/><path d="M-10 13q20-10 36 4l-6 17q-26 12-34-5Z" fill="#f1d8a5"/><ellipse cx="21" cy="14" rx="9" ry="6" fill="#263940"/><path d="M14 25q-8 5-13 0" fill="none"/><path d="M-13-3l8-2M9-4l8 2" fill="none"/><circle cx="-7" cy="3" r="2" fill="#24323a"/><circle cx="13" cy="4" r="2" fill="#24323a"/><path d="M-14 38l32 1" stroke="#d96641" stroke-width="7"/><circle cx="5" cy="42" r="5" fill="#eec46b" stroke-width="2"/>${helmet ? '<circle cx="0" cy="7" r="48" fill="#b6e4e910" stroke="#e7e5c9" stroke-width="4"/><path d="M-32-17q8-12 20-14" stroke="#fff5d7" fill="none"/>' : ''}</g></g>`;
}
function rocket(x,y,scale=1,parts=true) {
  if (RocketStudio.isReady(rocketDesign)) return RocketStudio.renderRocket(rocketDesign,x,y,scale);
  return `<g transform="translate(${x} ${y}) scale(${scale})" stroke="#24323b" stroke-width="3.5" stroke-linejoin="round"><path d="M-25 105L-37 130 38 130 26 105" fill="#467eb6"/>${parts ? '<path d="M-38 40L-66 88-64 123-31 101M38 40L66 88 64 123 31 101" fill="#ff6645"/>' : ''}<path d="M-36-34Q-43 40-32 109L33 109Q43 34 36-34" fill="#ffdf84"/><path d="M8-33l6 140h19q10-71 3-140" fill="#f5b942" stroke="none"/>${parts ? '<path d="M-37-32Q-28-72 0-96 28-72 37-32Z" fill="#ff6040"/><path d="M0-91q22 27 29 54" fill="none" stroke="#ffaf6b" stroke-width="3"/>' : ''}<path d="M-39-25h78M-37 82h73" stroke="#25b8d0" stroke-width="13"/><circle cy="19" r="27" fill="#54d9e2"/><circle cy="19" r="19" fill="#1951a4"/><path d="M-10 12l11-8M-9 22l18-14" stroke="#b6f5ff" stroke-width="3"/><path d="M-17 59l34-1" stroke="#b59b70" stroke-width="2"/><text x="0" y="75" font-size="10" font-family="monospace" text-anchor="middle" fill="#726b51" stroke="none">J-01</text></g>`;
}
const defs = `<defs><marker id="drag-arrow" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto"><path d="M3 2L9 6L3 10" fill="none" stroke="#fff4c3" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></marker><linearGradient id="sky" x2="0.3" y2="1"><stop stop-color="#183bad"/><stop offset="1" stop-color="#178edb"/></linearGradient><radialGradient id="mars"><stop stop-color="#ffb13b"/><stop offset=".72" stop-color="#ff7838"/><stop offset="1" stop-color="#f34d30"/></radialGradient><radialGradient id="glow"><stop stop-color="#ebbb7360"/><stop offset="1" stop-color="#ebbb7300"/></radialGradient><pattern id="grain" width="7" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="3" r=".5" fill="#fff" opacity=".09"/><circle cx="6" cy="7" r=".5" fill="#000" opacity=".08"/></pattern></defs>`;
const ground = `<path d="M0 446Q130 393 280 441T560 439V600H0Z" fill="#138d86"/><path d="M0 487Q170 445 323 478T560 476V600H0Z" fill="#25b67b"/><path d="M0 531Q190 488 560 540V600H0Z" fill="#74d65d"/>`;
const marsGround = `<path d="M0 422Q170 392 310 432T560 417V600H0Z" fill="#ed633e"/><path d="M0 489Q220 424 560 476V600H0Z" fill="#ff9d4e"/><ellipse cx="447" cy="492" rx="68" ry="15" fill="#d95731"/><ellipse cx="97" cy="544" rx="48" ry="10" fill="#eb7933"/><path d="M37 469l20-8 16 12M350 539l13-8 24 7" fill="none" stroke="#c6512d" stroke-width="4"/>`;
function coverScene() {
  return `${sky()}<circle cx="376" cy="164" r="151" fill="url(#glow)"/><g class="float"><g ${action('mars','Tap Mars to imagine the adventure')}>${cueOutline(293,78,166,166,83)}<circle cx="376" cy="161" r="76" fill="url(#mars)" stroke="#c9482b" stroke-width="2"/><path d="M312 122q40 2 50-21M305 155q28-15 53 5t62-1M327 204q26-23 62-4t43-8" fill="none" stroke="#df532e" stroke-width="13" opacity=".4"/><ellipse cx="400" cy="117" rx="17" ry="10" fill="#ffcc77" opacity=".65"/><ellipse cx="351" cy="185" rx="13" ry="8" fill="#d64e2d" opacity=".5"/><circle cx="409" cy="185" r="7" fill="#dd5129"/><circle cx="345" cy="133" r="6" fill="#ffda84" opacity=".7"/></g></g><path d="M291 226Q243 238 225 292" fill="none" stroke="#d8d3a0" stroke-width="1.5" stroke-dasharray="4 7" opacity=".65"/><path d="M279 268q-24 2-43 16m0 0 4-10m-4 10 11-2" fill="none" stroke="#d8d3a0" stroke-width="1.2"/>${ground}<path d="M30 405V349l64-50 67 50v68" fill="#3b9de4" stroke="#223c44" stroke-width="3"/><path d="M18 352l77-62 79 62" fill="none" stroke="#203842" stroke-width="8"/><path d="M116 309v-30h18v44" fill="#3266b3"/><rect x="51" y="359" width="26" height="34" rx="2" fill="#ffe86a" stroke="#223c44" stroke-width="3"/><path d="M64 360v31m-12-17h24" stroke="#496063" stroke-width="3"/><rect x="112" y="355" width="26" height="60" fill="#204c99"/><path d="M0 441l179-6" stroke="#8de294" stroke-width="3"/><ellipse cx="291" cy="513" rx="106" ry="15" fill="#314e4660"/>${johnny(281,367,1.02)}${dog(405,438,.85)}<path d="M181 515l-5-21m7 21 7-15M477 515l1-19m4 20 8-11M56 517l-3-13" stroke="#314e46" stroke-width="3" fill="none"/><g transform="translate(103 460) rotate(-18)"><path d="M-27-8l59 4 17 18-62 7Z" fill="#dfcf9b" stroke="#334943" stroke-width="2"/><path d="M-5-3l7 18m14-18 6 17" stroke="#b8a77d" stroke-width="2"/><path d="M2 1l10 3-6 8Z" fill="#ab6a47"/></g><path d="M208 353l-13-5m17-5-8-12" stroke="#e8d598" stroke-width="2"/>`;
}
function suppliesScene() {
  const items = [
    ['box','cardboard box',95,276,'<path d="M-42-25l42-18 46 18-4 57-41 18-42-22Z" fill="#e4a34f"/><path d="M-42-25L0-6l46-19M0-6v56M-20-35l43 20" fill="none"/><path d="M-8-9l15 0v22H-8" fill="#e4c383" stroke="none"/>'],
    ['funnel','kitchen funnel',283,211,'<path d="M-39-27h78L10 9v35H-5V9Z" fill="#58d0ea"/><ellipse cy="-27" rx="39" ry="10" fill="#c8f6ff"/><path d="M-20-18L1 5" stroke="#d9dfca" stroke-width="5"/>'],
    ['tape','shiny tape',446,293,'<ellipse rx="33" ry="37" fill="#53d2e8"/><ellipse rx="17" ry="23" fill="#246baa"/><path d="M23 20l24 17 3 25-22-4" fill="#86e4ef"/>']
  ];
  return `${sky()}<path d="M0 363h560v237H0" fill="#f6b95d"/><path d="M0 382h560M0 470h560M0 560h560" stroke="#cb8d45" stroke-width="3"/><path d="M90 383v87m310 0v90m-170-1v41" stroke="#cb8d45" stroke-width="2"/><path d="M60 145H500" stroke="#a5b3a1" stroke-width="1" opacity=".3"/>${[['box','M145 318 Q192 372 250 410'],['funnel','M282 270 Q260 342 278 404'],['tape','M420 360 Q380 401 320 416']].filter(([key])=>!collected.has(key)).map(([key,d])=>guideArrow(key,d)).join('')}${items.map(([id,label,x,y,art]) => `<g transform="translate(${x} ${y})"><g ${action(id,`Collect the ${label}`, 'data-draggable="collect"')} stroke="#243941" stroke-width="3" stroke-linejoin="round">${cueOutline(-54,-56,112,124)}${art}<text y="82" text-anchor="middle" font-size="14" font-family="Georgia,serif" fill="#fff3cd" stroke="none">${label}</text></g></g>`).join('')}<g id="crate" data-drop="collect" data-inactive="${collected.size===3}" transform="translate(280 443)" stroke="#3d4136" stroke-width="3"><rect x="-107" y="-51" width="214" height="147" fill="transparent" pointer-events="all"/>${cueOutline(-107,-51,214,147)}<ellipse cy="-15" rx="97" ry="27" fill="#554d3b"/><path d="M-95-14l15 100H81L95-14Q0 18-95-14Z" fill="#eaa044"/><path d="M-88 18h176M-83 53H83M-62 0l7 85M57 0l-4 85" fill="none" stroke="#8a633f"/><rect x="-47" y="22" width="94" height="35" rx="2" fill="#fff1b7" stroke="none"/><text id="crate-count" y="45" text-anchor="middle" fill="#645b46" stroke="none" font-size="14" font-family="monospace">${collected.size} / 3</text></g>`;
}
function workshopScene() {
  const ready = RocketStudio.isReady(rocketDesign);
  const background = `<rect width="560" height="600" fill="#20a8c0"/><path d="M0 70h560M0 140h560M0 210h560M0 280h560M0 350h560M0 420h560" stroke="#52c5d4" stroke-width="2"/><path d="M0 442h560v158H0" fill="#ffc566"/><path d="M0 442h560" stroke="#283d3e" stroke-width="5"/>`;
  if (!ready) return `${background}<g ${action('design','Open the rocket blueprint')}>${cueOutline(88,118,384,284)}<rect x="95" y="125" width="370" height="270" rx="10" fill="#174f9c" stroke="#d3efff" stroke-width="3"/><path d="M120 150h320M120 190h320M120 230h320M120 270h320M120 310h320M120 350h320M150 145v225M200 145v225M250 145v225M300 145v225M350 145v225M400 145v225" stroke="#73b3e5" stroke-opacity=".4"/><rect x="140" y="285" width="280" height="48" rx="16" fill="#fffbed"/><text x="280" y="315" text-anchor="middle" fill="#16336b" font-size="16" font-family="Trebuchet MS,Arial,sans-serif">Open the blueprint</text></g>${dog(455,455,.8)}`;
  const trays = {body:[45,155,82,145],nose:[405,145,95,90],fin:[55,365,50,90], 'mirrored-fin':[430,310,50,90]};
  const targets = RocketStudio.assemblyKeys.map(key => {
    if (rocketDesign.assembled.includes(key)) return '';
    const [x,y,w,h] = RocketStudio.partFrames[key];
    return `<g data-drop="assemble-${key}" transform="translate(280 300)"><rect class="cue-outline drop-outline" x="${x-8}" y="${y-8}" width="${w+16}" height="${h+16}" rx="5" fill="#fffbed22" stroke="#fff1ad" stroke-width="2" stroke-dasharray="5 5"/></g>`;
  }).join('');
  const looseParts = RocketStudio.assemblyKeys.filter(key=>!rocketDesign.assembled.includes(key)).map(key => {
    const [x,y,w,h] = trays[key];
    return `<g ${action('assemble-'+key,'Fit your '+RocketStudio.partNames[key],'data-draggable="assemble-'+key+'"')}><rect class="cue-outline" x="${x-12}" y="${y-12}" width="${w+24}" height="${h+46}" rx="12" fill="#fffbed33" stroke="#fffbed88"/>${RocketStudio.renderPart(rocketDesign,key,trays[key])}<text x="${x+w/2}" y="${y+h+23}" text-anchor="middle" fill="#16336b" font-size="13" font-family="Trebuchet MS,Arial,sans-serif">${RocketStudio.partNames[key].replace(/^./,letter=>letter.toUpperCase())}</text></g>`;
  }).join('');
  return `${background}${RocketStudio.assemblyKeys.filter(key=>!rocketDesign.assembled.includes(key)).map(key=>partGuide(key,trays[key],RocketStudio.partFrames[key])).join('')}${targets}${RocketStudio.renderRocket(rocketDesign,280,300,1,rocketDesign.assembled)}${looseParts}${dog(455,475,.65)}`;
}
function launchScene() {
  return `${sky()}${ground}<path d="M280 240V65" stroke="#a6beb1" stroke-width="2" stroke-dasharray="5 10" opacity=".3"/><g id="launch-rocket"><path id="flame" d="M248 438Q257 520 280 551 306 509 312 438Z" fill="#ff8b28" opacity="0"/><path d="M264 437Q275 490 282 503 298 464 298 437Z" fill="#ffe34c" opacity=".7"/>${rocket(280,300,1.08)}</g><g ${action('launch','Start the rocket countdown')} transform="translate(435 469)">${cueOutline(-62,-43,124,103)}<rect x="-54" y="-35" width="108" height="86" rx="12" fill="#e2d4a8" stroke="#253d42" stroke-width="4"/><circle r="25" fill="#d73137" stroke="#763e35" stroke-width="4"/><circle cy="-4" r="22" fill="#ff4b40"/><text y="40" fill="#384a43" font-size="10" font-family="monospace" text-anchor="middle">Launch</text></g><text id="countdown" x="280" y="145" text-anchor="middle" font-family="Georgia,serif" font-size="74" fill="#fff1a0"></text><path d="M60 480q63-47 149 2" stroke="#7a8a71" stroke-width="6" fill="none"/><g id="smoke"></g>`;
}
function landingScene() {
  return `${sky()}<circle cx="87" cy="93" r="24" fill="#40c2ed"/><path d="M71 76l16 5 4 13-12 9 9 11m5-42 8 15" stroke="#b5f277" stroke-width="7" fill="none"/>${marsGround}${completed.has(4) ? '' : guideArrow('land','M300 300 Q380 360 350 431')}<g id="landing-target" data-drop="land" data-inactive="${completed.has(4)}"><ellipse class="cue-outline" cx="328" cy="470" rx="98" ry="32"/><ellipse cx="328" cy="470" rx="91" ry="26" fill="#f9d58b22" stroke="#f8d993" stroke-width="2" stroke-dasharray="7 7"/><ellipse cx="328" cy="470" rx="58" ry="14" fill="#f9d58b22"/><path d="M328 450v39m-20-20h40" stroke="#f8d993" stroke-width="2"/></g><g id="landing-rocket" ${action('land','Land the rocket on Mars','data-draggable="land"')}>${cueOutline(147,138,147,238,18)}<g transform="translate(220 230) scale(.78)"><rect class="rocket-hitbox" x="-94" y="-118" width="188" height="304" rx="18" fill="transparent" pointer-events="all" aria-hidden="true"/></g>${rocket(220,230,.78)}</g>`;
}
function snackScene() {
  return `${sky()}${marsGround}${rocket(98,319,.55)}<path d="M432 270v177" stroke="#dfd6ac" stroke-width="4"/><path d="M434 272q29-12 65 1v49q-35-12-65 0Z" fill="#ffdb3e" stroke="#3d3f36" stroke-width="2"/><path d="M454 295l12-12 13 12-13 11Z" fill="#ff6f37"/>${johnny(257,340,.85,true)}${dog(384,433,.78,true)}<g transform="translate(154 487)"><g ${action('snacks','Open the backpack')}>${cueOutline(-48,-53,96,108)}<path d="M-22-31v-9q23-19 43 0v9" fill="none" stroke="#31483e" stroke-width="7"/><rect x="-40" y="-34" width="80" height="80" rx="15" fill="#12b7a3" stroke="#283f3b" stroke-width="4"/><path d="M-40-15q40 23 80 0v-13q-40-15-80 0Z" fill="#63e1ad" stroke="#283f3b" stroke-width="3"/><rect x="-9" y="-12" width="18" height="20" rx="3" fill="#ffdd49" stroke="#34483c" stroke-width="2"/><path d="M-24 23h49" stroke="#394f41" stroke-width="3"/></g></g><g id="snack-surprise"></g>`;
}
const scenes = [coverScene,suppliesScene,workshopScene,launchScene,landingScene,snackScene];

function tone(kind = 'tap') { if (sound) StoryAudio.play(kind); }
function toast(message, duration = 3200) { clearTimeout(toastTimer); $('#scene-toast').textContent = message; $('#scene-toast').classList.add('visible'); toastTimer = later(() => { $('#scene-toast').classList.remove('visible'); $('#scene-toast').textContent = ''; },duration); }
function showCompletedActivity() {
  $('#activity-card').classList.add('completed');
  $('#activity-card').hidden = page !== 2 && page !== chapters.length - 1;
  $('#activity-label').textContent = 'Activity complete';
  $('#activity-instruction').hidden = true;
  $('#restart-button').hidden = page !== chapters.length - 1;
}
function complete() { completed.add(page); showCompletedActivity(); updateProgress(); tone('success'); }
function updateProgress() {
  $('#progress-dots').innerHTML = chapters.map((chapter,i) => {
    const available = i === 0 || i <= page || completed.has(i) || completed.has(i-1);
    return `<button class="progress-dot ${page === i ? 'active' : ''} ${completed.has(i) ? 'done' : ''}" data-page="${i}" aria-label="Page ${i+1}: ${chapter.name}${completed.has(i) ? ', activity completed' : available ? '' : ', complete the previous activity first'}" ${page === i ? 'aria-current="page"' : ''} ${available ? '' : 'disabled'}></button>`;
  }).join('');
}
function stopReading() { if ('speechSynthesis' in window) speechSynthesis.cancel(); speaking = false; $('#read-label').textContent = 'Read to me'; }
function render(animate = false) {
  cancelKeyboardDrag();
  timers.forEach(clearTimeout); timers = []; stopReading(); StoryAudio.stop(); launching = false; drag = null; swipe = null;
  const chapter = chapters[page];
  $('#chapter-kicker').textContent = `Chapter ${page+1} of ${chapters.length}`;
  $('#story-title').innerHTML = chapter.title; $('#story-text').innerHTML = chapter.text;
  if (page >= 3 && RocketStudio.isReady(rocketDesign)) {
    $('#story-text').textContent = chapter.text.replace(/the rocket/i, () => rocketDesign.name);
  }
  $('#activity-instruction').textContent = chapter.hint; $('#activity-label').textContent = 'How you can help'; $('#activity-check').textContent = '↗'; $('#activity-card').classList.remove('completed'); $('#restart-button').hidden = true;
  $('#activity-card').hidden = false; $('#activity-instruction').hidden = false;
  $('#scene').innerHTML = `<svg viewBox="0 0 560 600" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-label="${chapter.name}, interactive illustration">${defs}${scenes[page]()}<rect width="560" height="600" fill="url(#grain)" pointer-events="none"/></svg>`;
  // Keep every object visible in both portrait and landscape layouts.
  $('#scene-toast').classList.remove('visible'); $('#scene-toast').textContent = ''; $('#book').style.transform = ''; $('#previous').disabled = page === 0; $('#next').disabled = false; $('#next').setAttribute('aria-label',page === 5 ? 'Read again from the beginning' : 'Next page'); $('#next').textContent = page === 5 ? '↺' : '→';
  $('#page-count').textContent = `${page+1} of ${chapters.length}`; $('#page-name').textContent = chapter.name; updateProgress();
  $('#design-rocket').hidden = page !== 2;
  if (page === 2 && !RocketStudio.isReady(rocketDesign)) $('#activity-instruction').hidden = true;
  $('#design-rocket').textContent = RocketStudio.isReady(rocketDesign) ? 'Edit your blueprint and rocket name' : 'Open the rocket blueprint';
  if (page===2 && RocketStudio.isReady(rocketDesign) && !RocketStudio.isAssembled(rocketDesign)) {
    $('#activity-instruction').textContent = 'Fit your parts into the outlined spaces.';
  }
  if (completed.has(page)) {
    showCompletedActivity();
  }
  if (page===5 && completed.has(5)) showSnackEnding();
  if (page===3 && completed.has(3)) {
    $('#launch-rocket').style.visibility='hidden';
    $('#countdown').textContent='The rocket has launched.';
    $('#countdown').setAttribute('font-size','28');
  }
  if (page===4 && completed.has(4)) {
    $('#landing-rocket').style.transform='translate(108px, 133px)';
    $('#landing-target').setAttribute('opacity','.4');
  }
  $('#page-announcement').textContent = `Page ${page+1} of 6. ${chapter.name}. ${chapter.hint}`;
  if (animate) {
    $('#book').classList.remove('page-enter'); void $('#book').offsetWidth; $('#book').classList.add('page-enter');
    $('#story-page').scrollTop = 0;
  }
}
function turn(delta) {
  if (delta < 0 && page === 0) return;
  if (delta > 0 && page === chapters.length - 1 && completed.has(page)) {
    restartBook();
    return;
  }
  if (delta > 0 && !completed.has(page)) {
    tone('tap');
    toast('Finish this activity to turn the page.', 2600);
    $('#activity-card').animate?.([{transform:'translateX(0)'},{transform:'translateX(-5px)'},{transform:'translateX(5px)'},{transform:'translateX(0)'}], {duration:280});
    return;
  }
  page = (page + delta + chapters.length) % chapters.length; render(true); tone('page');
}
function pop(element) { element.classList.remove('pop'); void element.getBoundingClientRect(); element.classList.add('pop'); }
function interact(name, element, successfulDrop = false) {
  if (!element || element.dataset.used === 'true') return;
  if ((['box','funnel','tape','land'].includes(name) || name.startsWith('assemble-')) && !successfulDrop) {
    toast('Drag this object where the arrow points.');
    return;
  }
  if (name === 'design') { stopReading(); rocketStudio.open(); return; }
  if (name.startsWith('assemble-') && page===2 && RocketStudio.isReady(rocketDesign)) {
    const key=name.slice('assemble-'.length);
    if (!RocketStudio.assemblyKeys.includes(key) || rocketDesign.assembled.includes(key)) return;
    rocketDesign.assembled.push(key); render(); tone('assemble');
    if (RocketStudio.isAssembled(rocketDesign)) complete();
    return;
  }
  if (name === 'star') { tone('star'); pop(element); return; }
  if (name === 'dog') {
    StoryAudio.unlock(); tone('dog'); pop(element);
    const message = page === 2 && !$('#reader').hidden ? 'Biscuit tilts his head. “Are you sure that rocket has enough tape?”' : page === 5 && !$('#reader').hidden ? 'Biscuit wags his tail. “I remembered to pack my biscuit!”' : 'Biscuit gives a happy bark. “Can I come to Mars with you?”';
    if ($('#reader').hidden) {
      const response = $('#menu-dog-response'); response.textContent = message; response.hidden = false;
      clearTimeout(toastTimer); toastTimer = later(() => { response.hidden = true; },4000);
    } else toast(message,4000);
    return;
  }
  if (name === 'mars') { pop(element); complete(); }
  if (['box','funnel','tape'].includes(name)) {
    collected.add(name); element.dataset.used = 'true'; element.style.opacity = '.22'; element.setAttribute('aria-disabled','true'); element.removeAttribute('tabindex'); $('#crate-count').textContent = `${collected.size} / 3`; tone(name); pop($('#crate'));
    document.querySelector(`[data-guide-for="${name}"]`)?.remove();
    if (collected.size === 3) { $('#crate').setAttribute('data-inactive','true'); complete(); }
  }
  if (name === 'launch' && !launching) {
    launching = true; element.dataset.used='true'; element.setAttribute('aria-disabled','true'); element.removeAttribute('tabindex');
    // Pressing launch is the action; leaving mid-countdown must not erase it.
    completed.add(3); updateProgress();
    [3,2,1].forEach((n,i) => later(() => { $('#countdown').textContent = n; tone('countdown'); },i*850));
    later(() => { $('#countdown').textContent = 'The rocket is flying!'; $('#countdown').setAttribute('font-size','32'); $('#flame').setAttribute('opacity','1'); $('#launch-rocket').classList.add('rocket-launch'); tone('launch'); $('#smoke').innerHTML = [0,1,2,3,4].map((n) => `<circle cx="${200+n*40}" cy="${475+(n%2)*14}" r="${28+n*3}" fill="#eee1bd" opacity=".8"/>`).join(''); complete(); },2550);
  }
  if (name === 'land') {
    tone('land');
    element.dataset.used = 'true'; element.classList.add('landing'); element.setAttribute('aria-disabled','true'); element.removeAttribute('tabindex'); element.style.transform = 'translate(108px, 133px)'; $('#landing-target').setAttribute('opacity','.4'); $('#landing-target').setAttribute('data-inactive','true'); document.querySelector('[data-guide-for="land"]')?.remove(); complete();
  }
  if (name === 'snacks') {
    element.dataset.used = 'true'; element.setAttribute('aria-disabled','true'); element.removeAttribute('tabindex'); pop(element);
    tone('snacks'); showSnackEnding();
    complete();
  }
}

function showSnackEnding() {
  $('#snack-surprise').innerHTML = `<g transform="translate(157 387)" stroke="#634b35" stroke-width="2.5"><path d="M-30-5q-14-17-23-3-7 12 8 17-10 14 2 20 12 5 16-10l46-1q4 16 17 9 10-8-2-18 16-9 5-20-11-9-20 6Z" fill="#e2b76b"/>${star(-48,-35,6,'#ffe5a4')}${star(49,-26,7,'#ffe5a4')}</g>`;
  $('#story-text').textContent = 'Inside the backpack, Johnny finds the biscuit his friend saved before they left home. He laughs and gives it to Biscuit, who settles beside him on the warm red ground. “When we come back,” Johnny says, “I’ll remember to bring sandwiches.”';
}

$('#scene').addEventListener('click',event => { if (suppressClick) return; const target = event.target.closest('[data-action]'); if (target) interact(target.dataset.action,target); });
function cancelKeyboardDrag() {
  clearDropHighlights();
  if (!keyboardDrag) return;
  keyboardDrag.target.style.transform = '';
  keyboardDrag.target.classList.remove('dragging');
  keyboardDrag = null;
}
function clearDropHighlights() {
  document.querySelectorAll('[data-drop-active]').forEach(target => target.removeAttribute('data-drop-active'));
}
function highlightDrop(target) {
  clearDropHighlights();
  document.querySelector(`[data-drop="${target.dataset.draggable}"]`)?.setAttribute('data-drop-active','true');
}
function attemptDrop(target,moved,clientX,clientY) {
  if (!moved) return false;
  const drop=document.querySelector(`[data-drop="${target.dataset.draggable}"]`);
  if (!drop) return false;
  const rect=drop.getBoundingClientRect(),padding=35;
  if (clientX>=rect.left-padding && clientX<=rect.right+padding && clientY>=rect.top-padding && clientY<=rect.bottom+padding) {
    interact(target.dataset.action,target,true);
    return true;
  }
  toast(target.dataset.draggable==='collect' ? 'Drop the supply inside the crate.' : target.dataset.draggable.startsWith('assemble-') ? 'Drop this part onto its outline.' : 'Drop the rocket on the glowing oval.',2200);
  return false;
}
$('#scene').addEventListener('keydown',event => {
  StoryAudio.unlock();
  const target=event.target.closest('[data-action]');
  if (!target) return;
  if (!target.dataset.draggable) {
    if (event.key==='Enter' || event.key===' ') { event.preventDefault(); interact(target.dataset.action,target); }
    return;
  }
  if (event.key==='Tab') { cancelKeyboardDrag(); return; }
  if (!['Enter',' ','Escape','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
  event.preventDefault(); event.stopPropagation();
  if (target.dataset.used==='true') return;
  if (event.key==='Escape') { cancelKeyboardDrag(); return; }
  if (event.key==='Enter' || event.key===' ') {
    if (event.repeat) return;
    if (!keyboardDrag) {
      const rect=target.getBoundingClientRect();
      keyboardDrag={target,start:svgPoint({clientX:(rect.left+rect.right)/2,clientY:(rect.top+rect.bottom)/2}),dx:0,dy:0,moved:false};
      target.classList.add('dragging');
      highlightDrop(target);
      $('#page-announcement').textContent='Object picked up. Use the arrow keys to move, then press Space or Enter to drop. Escape cancels.';
    } else {
      const current=keyboardDrag;
      const screen=new DOMPoint(current.start.x+current.dx,current.start.y+current.dy).matrixTransform($('#scene svg').getScreenCTM());
      cancelKeyboardDrag();
      attemptDrop(target,current.moved,screen.x,screen.y);
    }
    return;
  }
  if (keyboardDrag?.target!==target) return;
  const amount=event.shiftKey ? 36 : 12;
  const moves={ArrowLeft:[-amount,0],ArrowRight:[amount,0],ArrowUp:[0,-amount],ArrowDown:[0,amount]};
  keyboardDrag.dx+=moves[event.key][0]; keyboardDrag.dy+=moves[event.key][1]; keyboardDrag.moved=true;
  target.style.transform=`translate(${keyboardDrag.dx}px,${keyboardDrag.dy}px)`;
});
$('#scene').addEventListener('focusout',event => { if (keyboardDrag && event.target===keyboardDrag.target && event.relatedTarget!==event.target) cancelKeyboardDrag(); });
function svgPoint(event) { const point = new DOMPoint(event.clientX,event.clientY); return point.matrixTransform($('#scene svg').getScreenCTM().inverse()); }
$('#book').addEventListener('pointerdown',event => {
  if (event.button !== 0) return;
  StoryAudio.unlock();
  cancelKeyboardDrag();
  const target = event.target.closest('[data-action]');
  if (target) {
    if (target.dataset.draggable && target.dataset.used!=='true') tone('pickup');
    if (target.dataset.draggable && target.dataset.used !== 'true') { drag = { target, start:svgPoint(event), x:event.clientX, y:event.clientY, moved:false, pointer:event.pointerId }; target.setPointerCapture(event.pointerId); highlightDrop(target); }
    return;
  }
  if (event.target.closest('button,a')) return;
  swipe = {x:event.clientX,y:event.clientY,pointer:event.pointerId};
});
$('#book').addEventListener('pointermove',event => {
  if (swipe && event.pointerId === swipe.pointer && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const dx = event.clientX-swipe.x; const dy = event.clientY-swipe.y;
    if (Math.abs(dx)>Math.abs(dy)*1.3 && Math.abs(dx)>8) $('#book').style.transform = `translateX(${Math.max(-18,Math.min(18,dx*.12))}px)`;
  }
  if (!drag || event.pointerId !== drag.pointer) return;
  const point = svgPoint(event); const dx = point.x-drag.start.x; const dy = point.y-drag.start.y;
  if (Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>8) drag.moved = true;
  if (drag.moved) { drag.target.classList.add('dragging'); drag.target.style.transform = `translate(${dx}px,${dy}px)`; }
});
function endPointer(event,cancelled=false) {
  if (drag && event.pointerId === drag.pointer) {
    clearDropHighlights();
    const {target,moved} = drag; target.classList.remove('dragging'); target.style.transform = '';
    if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
    if (moved) {
      suppressClick = true; setTimeout(() => suppressClick = false,0);
      if (!cancelled) {
        attemptDrop(target,moved,event.clientX,event.clientY);
      }
    }
    drag = null;
  }
  if (swipe && event.pointerId === swipe.pointer) { const dx = event.clientX-swipe.x; const dy = event.clientY-swipe.y; $('#book').style.transform = ''; if (!cancelled && Math.abs(dx)>65 && Math.abs(dx)>Math.abs(dy)*1.3) turn(dx<0 ? 1 : -1); swipe = null; }
}
window.addEventListener('pointerup',event => endPointer(event)); window.addEventListener('pointercancel',event => endPointer(event,true));
$('#previous').addEventListener('click',() => turn(-1)); $('#next').addEventListener('click',() => turn(1));
function restartBook() {
  stopReading();
  timers.forEach(clearTimeout); timers = [];
  completed.clear();
  collected.clear();
  rocketDesign = null;
  rocketStudio.reset();
  page = 0;
  render(true);
  $('#story-title').focus({preventScroll:true});
}
$('#restart-button').addEventListener('click', restartBook);
$('#progress-dots').addEventListener('click',event => { const button = event.target.closest('[data-page]'); if (button && !button.disabled) { page=Number(button.dataset.page); render(true); $('#progress-dots').querySelector(`[data-page="${page}"]`).focus(); } });
document.addEventListener('keydown',event => { if (event.defaultPrevented || $('#reader').hidden || document.querySelector('dialog[open]') || event.target.closest('input,textarea,select') || event.altKey || event.ctrlKey || event.metaKey) return; if (event.key === 'ArrowRight') { event.preventDefault(); turn(1); } if (event.key === 'ArrowLeft') { event.preventDefault(); turn(-1); } });
function updateSound() { $('#sound-button').setAttribute('aria-pressed',String(sound)); $('#sound-label').textContent = sound ? 'Sound on' : 'Sound off'; $('#sound-icon').textContent = sound ? '♫' : '♪'; }
$('#sound-button').addEventListener('click',() => { sound=!sound; StoryAudio.setEnabled(sound); if (!sound) stopReading(); else tone('star'); updateSound(); });
$('#read-button').addEventListener('click',() => {
  if (!('speechSynthesis' in window)) { toast('Read-aloud isn’t available in this browser. The full story is on the page.'); return; }
  if (speaking) { stopReading(); return; }
  const speech = new SpeechSynthesisUtterance(`${$('#story-title').textContent}. ${$('#story-text').textContent}`);
  speech.lang='en-US'; speech.rate=.87; speech.pitch=1.08;
  const voices = speechSynthesis.getVoices(); const voice = voices.find(v => v.lang.startsWith('en') && /Samantha|Jenny|Aria/.test(v.name)); if (voice) speech.voice=voice;
  speech.onend=() => { speaking=false; $('#read-label').textContent='Read to me'; }; speech.onerror=speech.onend;
  speaking=true; $('#read-label').textContent='Stop reading'; speechSynthesis.speak(speech);
});
document.querySelectorAll('#help-button, [data-help]').forEach(button => button.addEventListener('click',() => { stopReading(); $('#help-dialog').showModal(); }));
$('#close-help').addEventListener('click',() => $('#help-dialog').close()); $('#start-exploring').addEventListener('click',() => $('#help-dialog').close());
$('#help-dialog').addEventListener('click',event => { if (event.target === $('#help-dialog')) { const rect = event.target.getBoundingClientRect(); if (event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom) event.target.close(); } });
document.addEventListener('visibilitychange',() => { if (document.hidden) {stopReading();StoryAudio.stop();} });

function updateMenu() {
  $('#resume-note').textContent = page > 0 ? `Continue at chapter ${page+1}.` : '';
}
$('#open-book').addEventListener('click',() => {
  $('#menu-dog-response').hidden = true;
  $('#main-menu').hidden = true;
  $('#reader').hidden = false;
  document.body.style.overflow = 'hidden';
  render();
  $('#story-page').scrollTop = 0;
  $('#story-title').focus({preventScroll:true});
});
$('#back-to-menu').addEventListener('click',() => {
  cancelKeyboardDrag();
  stopReading();
  timers.forEach(clearTimeout); timers = [];
  StoryAudio.stop();
  $('#reader').hidden = true;
  $('#main-menu').hidden = false;
  document.body.style.overflow = '';
  $('#page-announcement').textContent = '';
  updateMenu();
  $('#open-book').focus({preventScroll:true});
});
// Biscuit responds on the menu too; the other cover art is decorative.
const menuIllustration = `${defs}${coverScene()}`
  .replace(/id="([^"]+)"/g, 'id="menu-$1"')
  .replace(/url\(#([^)]+)\)/g, 'url(#menu-$1)')
  .replace(/<g\b[^>]*data-action="([^"]+)"[^>]*>/g, (tag,name) => name === 'dog' ? tag : tag.replace(/ (data-action|role|tabindex|aria-label)="[^"]*"/g,''));
$('#menu-art').innerHTML = `<svg viewBox="0 0 560 600" xmlns="http://www.w3.org/2000/svg" focusable="false">${menuIllustration}</svg>`;
$('#menu-art').addEventListener('click',event => { const target=event.target.closest('[data-action="dog"]'); if(target)interact('dog',target); });
$('#menu-art').addEventListener('keydown',event => { if(event.key!=='Enter' && event.key!==' ')return;const target=event.target.closest('[data-action="dog"]');if(target){event.preventDefault();interact('dog',target);} });
const rocketStudio = RocketStudio.init({
  getDesign: () => rocketDesign,
  onStroke: () => {StoryAudio.unlock();tone('pencil');},
  onSave: design => {
    rocketDesign = design;
    // A changed blueprint requires assembling its new parts before flying.
    for (let i=2; i<chapters.length; i++) completed.delete(i);
    render();
    $('#design-rocket').focus({preventScroll:true});
  }
});
$('#design-rocket').addEventListener('click',() => { stopReading(); rocketStudio.open(); });
updateSound(); updateMenu();
