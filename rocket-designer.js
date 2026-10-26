'use strict';

// The same vector strokes are used by the drawing area and every story scene.
window.RocketStudio = (() => {
  const colors = ['#f3fbff', '#ec541d', '#e8ac09', '#119a79', '#9e44ce', '#16336b'];
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const partKeys = ['body', 'nose', 'fin'];
  const assemblyKeys = ['body', 'nose', 'fin', 'mirrored-fin'];
  const partNames = {body:'body', nose:'nose cone', fin:'fin', 'mirrored-fin':'fin'};
  const partFrames = {body:[-35,-25,70,130], nose:[-37,-96,74,71], fin:[-70,35,38,85], 'mirrored-fin':[32,35,38,85]};
  const emptyDesign = () => ({name:'', parts:{body:[],nose:[],fin:[]}, assembled:[]});
  function cleanStrokes(value) {
    return (Array.isArray(value) ? value : []).slice(0,100).flatMap(stroke => {
      if (!stroke || !colors.includes(stroke.color) || ![4,8,14].includes(stroke.width) || !Array.isArray(stroke.points)) return [];
      const points = stroke.points.slice(0,1500).filter(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))
        .map(([x,y]) => [Math.round(Math.max(0,Math.min(360,x))),Math.round(Math.max(0,Math.min(420,y)))]);
      return points.length ? [{color:stroke.color,width:stroke.width,points}] : [];
    });
  }
  function hasDrawing(strokes) {
    return Array.isArray(strokes) && strokes.some(stroke => stroke.points.some(p => Math.hypot(p[0]-stroke.points[0][0],p[1]-stroke.points[0][1]) >= 8));
  }
  const isReady = design => !!design?.name.trim() && partKeys.every(key => hasDrawing(design.parts?.[key]));
  const isAssembled = design => isReady(design) && assemblyKeys.every(key => design.assembled.includes(key));
  function cleanDesign(value) {
    if (!value || typeof value !== 'object') return null;
    const design = emptyDesign();
    design.name = typeof value.name === 'string' ? value.name.trim().slice(0,28) : '';
    partKeys.forEach(key => { design.parts[key] = cleanStrokes(value.parts?.[key]); });
    // Keep valid, distinct placed parts regardless of the order they were fitted.
    if (isReady(design) && Array.isArray(value.assembled)) {
      design.assembled = assemblyKeys.filter(key => value.assembled.includes(key));
    }
    return design;
  }
  function strokePath(stroke, halo = false) {
    const d = stroke.points.map(([x,y],i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ') + (stroke.points.length === 1 ? ' l0.01 0' : '');
    return `<path d="${d}" fill="none" stroke="${halo ? '#16336b' : stroke.color}" stroke-width="${stroke.width+(halo ? 6 : 0)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  function renderPart(design,key,frame=partFrames[key]) {
    const strokes = design.parts[key === 'mirrored-fin' ? 'fin' : key];
    if (!hasDrawing(strokes)) return '';
    let minX=360,minY=420,maxX=0,maxY=0;
    strokes.forEach(stroke => stroke.points.forEach(([x,y]) => {minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}));
    const width=Math.max(1,maxX-minX),height=Math.max(1,maxY-minY);
    const [x,y,targetWidth,targetHeight]=frame;
    if (key === 'mirrored-fin') {
      return `<g data-rocket-part="mirrored-fin" transform="translate(${2*x+targetWidth} 0) scale(-1 1)">${renderPart(design,'fin',frame)}</g>`;
    }
    // Each drawing becomes a separate cutout. The bounding boxes join exactly
    // at the blueprint's body/nose seam and at the side of the body for the fin.
    const sourceWidth=Math.max(20,width),sourceHeight=Math.max(20,height);
    const sx=targetWidth/sourceWidth,sy=targetHeight/sourceHeight;
    return `<g data-rocket-part="${key}" transform="translate(${x} ${y}) scale(${sx} ${sy}) translate(${(sourceWidth-width)/2-minX} ${(sourceHeight-height)/2-minY})">${strokes.map(s=>strokePath(s,true)).join('')}${strokes.map(s=>strokePath(s)).join('')}</g>`;
  }
  function renderRocket(design,x,y,size=1,parts=assemblyKeys) {
    return `<g class="reader-rocket" transform="translate(${x} ${y}) scale(${size})" aria-label="${escape(design.name)}">${parts.map(key=>renderPart(design,key)).join('')}<rect x="-82" y="143" width="164" height="23" rx="8" fill="#fffbed" stroke="#16336b" stroke-width="1.5"/><text x="0" y="159" text-anchor="middle" fill="#16336b" font-size="${design.name.length>18 ? 8 : 11}" font-family="Trebuchet MS,Arial,sans-serif">${escape(design.name)}</text></g>`;
  }
  function init({getDesign, onSave, onStroke=()=>{}}) {
    const find = selector => document.querySelector(selector);
    const dialog = find('#rocket-designer'), board = find('#rocket-drawing');
    let draft=null, step=0, pen = colors[0], activeStroke = null, activePointer = null, keyboardDown = false;
    let cursor = [180,210];
    const currentStrokes = () => draft.parts[partKeys[step]];
    function redraw() {
      const key = partKeys[step], strokes = currentStrokes();
      find('#drawing-strokes').innerHTML = strokes.map(s => strokePath(s)).join('');
      find('#drawing-placeholder').hidden = strokes.length > 0;
      find('#drawing-placeholder').textContent = `Draw the ${partNames[key]} here`;
      const guides = {body:'<rect x="105" y="65" width="150" height="290" rx="25"/><circle cx="180" cy="160" r="30"/>',nose:'<path d="M65 330Q105 120 180 70 255 120 295 330Z"/>',fin:'<path d="M260 80L85 275 90 350 260 290Z"/>'};
      find('#blueprint-guide').innerHTML = guides[key];
      find('#blueprint-instruction').textContent = `Draw the ${partNames[key]} using the guide or your own shape.`;
      find('#blueprint-steps').innerHTML = partKeys.map((part,i) => `<button type="button" data-drawing-step="${i}" ${i>step && !partKeys.slice(0,i).every(p=>hasDrawing(draft.parts[p])) ? 'disabled' : ''} ${i===step ? 'aria-current="step"' : ''}>${i+1}. ${partNames[part]}</button>`).join('');
      find('#next-part').hidden = step===2;
      find('#next-part').disabled = !hasDrawing(strokes);
      find('#next-part').textContent = `Continue to the ${partNames[partKeys[Math.min(2,step+1)]]}`;
      find('#rocket-naming').hidden = step!==2;
      find('#rocket-name').required = step===2;
      find('#save-rocket').hidden = step!==2;
      const ready = isReady(draft);
      find('#save-rocket').disabled = !ready;
      find('#undo-drawing').disabled = find('#clear-drawing').disabled = strokes.length === 0;
      const feedback = step<2 ? `Finish the ${partNames[key]} before moving to the next part.` : ready ? `Your drawings are ready for ${draft.name}.` : !hasDrawing(strokes) ? 'Draw the fin before continuing.' : 'Give your rocket a name before taking the parts to the garage.';
      if (find('#design-feedback').textContent !== feedback) find('#design-feedback').textContent = feedback;
    }
    function finishStroke() { activeStroke = null; activePointer = null; keyboardDown = false; board.classList.remove('pen-down'); }
    function begin(point) {
      if (currentStrokes().length >= 100) { find('#design-feedback').textContent = 'You can undo a line to make room for another.'; return; }
      activeStroke = {color:pen, width:Number(find('#pen-width').value), points:[point]};
      currentStrokes().push(activeStroke);
      onStroke();
    }
    function add(point) {
      if (!activeStroke || activeStroke.points.length >= 1500) return;
      const last = activeStroke.points.at(-1);
      if (Math.hypot(point[0]-last[0],point[1]-last[1]) >= 1) activeStroke.points.push(point);
    }
    function point(event) {
      const p = new DOMPoint(event.clientX,event.clientY).matrixTransform(board.getScreenCTM().inverse());
      return [Math.round(Math.max(0,Math.min(360,p.x))),Math.round(Math.max(0,Math.min(420,p.y)))];
    }
    board.addEventListener('pointerdown', event => {
      if (event.button !== 0 || activePointer !== null) return;
      event.preventDefault(); finishStroke(); board.focus({preventScroll:true});
      begin(point(event)); activePointer = event.pointerId; board.setPointerCapture(event.pointerId); redraw();
    });
    board.addEventListener('pointermove', event => {
      if (event.pointerId !== activePointer) return;
      const samples = event.getCoalescedEvents?.();
      (samples?.length ? samples : [event]).forEach(e => add(point(e)));
      redraw();
    });
    const end = event => {
      if (event.pointerId !== activePointer) return;
      if (event.type === 'pointerup') add(point(event));
      finishStroke();
      if (board.hasPointerCapture(event.pointerId)) board.releasePointerCapture(event.pointerId);
      redraw();
    };
    ['pointerup','pointercancel','lostpointercapture'].forEach(name => board.addEventListener(name,end));
    board.addEventListener('keydown', event => {
      if (event.key === ' ') {
        event.preventDefault();
        if (event.repeat) return;
        if (keyboardDown) finishStroke(); else { begin([...cursor]); keyboardDown = true; board.classList.add('pen-down'); }
        redraw();
      }
      const moves = {ArrowLeft:[-6,0],ArrowRight:[6,0],ArrowUp:[0,-6],ArrowDown:[0,6]};
      if (!moves[event.key]) return;
      event.preventDefault();
      cursor = [Math.max(0,Math.min(360,cursor[0]+moves[event.key][0])),Math.max(0,Math.min(420,cursor[1]+moves[event.key][1]))];
      find('#drawing-cursor').setAttribute('cx',cursor[0]); find('#drawing-cursor').setAttribute('cy',cursor[1]);
      if (keyboardDown) { add([...cursor]); redraw(); }
    });
    board.addEventListener('blur',finishStroke);
    find('.pen-colors').addEventListener('click',event => {
      const button = event.target.closest('[data-pen]'); if (!button) return;
      finishStroke(); pen = button.dataset.pen;
      document.querySelectorAll('[data-pen]').forEach(b => b.setAttribute('aria-pressed',String(b === button)));
    });
    find('#undo-drawing').addEventListener('click',() => { finishStroke(); currentStrokes().pop(); redraw(); });
    find('#clear-drawing').addEventListener('click',() => { finishStroke(); draft.parts[partKeys[step]] = []; redraw(); });
    function changeStep(next) {
      if (!Number.isInteger(next) || next<0 || next>2 || !partKeys.slice(0,next).every(key=>hasDrawing(draft.parts[key]))) return;
      finishStroke(); step=next; cursor=[180,210];
      find('#drawing-cursor').setAttribute('cx',180); find('#drawing-cursor').setAttribute('cy',210);
      redraw(); board.focus({preventScroll:true});
    }
    find('#next-part').addEventListener('click',() => changeStep(step+1));
    find('#blueprint-steps').addEventListener('click',event => {
      const button=event.target.closest('[data-drawing-step]');
      if (button && !button.disabled) changeStep(Number(button.dataset.drawingStep));
    });
    find('#rocket-name').addEventListener('input',event => { draft.name = event.target.value.trim().slice(0,28); redraw(); });
    find('#rocket-form').addEventListener('submit',event => {
      event.preventDefault(); finishStroke();
      const design = cleanDesign(draft); if (step!==2 || !isReady(design)) { redraw(); return; }
      design.assembled = [];
      dialog.close(); onSave(design);
    });
    find('#close-designer').addEventListener('click',() => dialog.close());
    dialog.addEventListener('close',finishStroke);
    return {open() {
      if (!draft) {
        draft = cleanDesign(getDesign()) || emptyDesign();
        step = Math.max(0,partKeys.findIndex(key=>!hasDrawing(draft.parts[key])));
      }
      find('#drawing-cursor').setAttribute('cx',cursor[0]); find('#drawing-cursor').setAttribute('cy',cursor[1]);
      find('#rocket-name').value = draft.name; finishStroke(); redraw(); dialog.showModal();
    },reset() {
      finishStroke();
      if (dialog.open) dialog.close();
      draft=null; step=0; cursor=[180,210];
    }};
  }
  return {cleanDesign, hasDrawing, isReady, isAssembled, renderRocket, renderPart, partKeys, assemblyKeys, partNames, partFrames, init};
})();
