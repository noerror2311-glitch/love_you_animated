(function(){
  const stage = document.getElementById('stage');
  const cv = document.getElementById('c');
  const ctx = cv.getContext('2d');
  const hand = document.getElementById('hand');
  const music = document.getElementById('music');
  const soundBtn = document.getElementById('sound');
  let W, H, DPR;

  /* ---------- sound ---------- */
  music.volume = 1;
  function startMusic(){
    music.play().then(()=>soundBtn.classList.add('playing')).catch(()=>{});
  }
  function stopMusic(){ music.pause(); soundBtn.classList.remove('playing'); }
  let userMuted = false;
  soundBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (music.paused){ userMuted = false; startMusic(); }
    else { userMuted = true; stopMusic(); }
  });
  // browsers block autoplay, so start on the first tap/click anywhere
  function firstTap(){
    if (!userMuted && music.paused) startMusic();
    window.removeEventListener('pointerdown', firstTap);
    window.removeEventListener('touchstart', firstTap);
  }
  window.addEventListener('pointerdown', firstTap);
  window.addEventListener('touchstart', firstTap, {passive:true});
  startMusic(); // works if the browser allows autoplay

  /* ---------- pointer / hand ---------- */
  const mouse = {x:-999, y:-999, active:false};
  function setPointer(cx, cy){
    hand.style.transform = `translate(${cx-9}px,${cy-3}px)`;
    const r = cv.getBoundingClientRect();
    mouse.x = cx - r.left; mouse.y = cy - r.top; mouse.active = true;
  }
  window.addEventListener('mousemove', e => setPointer(e.clientX, e.clientY));
  window.addEventListener('touchstart', e => setPointer(e.touches[0].clientX, e.touches[0].clientY), {passive:true});
  window.addEventListener('touchmove',  e => setPointer(e.touches[0].clientX, e.touches[0].clientY), {passive:true});
  window.addEventListener('touchend', () => { mouse.active=false; });

  /* ---------- matrix rain (letters + hearts) ---------- */
  const LETTERS = 'ABCEFIORVX01';
  let cols = [], colW = 17, fontSize = 11;
  function initRain(){
    cols = [];
    const n = Math.floor(W / colW);
    for (let i=0;i<n;i++){
      cols.push({
        x: i*colW + colW/2 + (W - n*colW)/2,
        y: -Math.random()*H*1.5,
        speed: 0.5 + Math.random()*1.3,
        len: 6 + Math.floor(Math.random()*14),
        head: LETTERS[Math.floor(Math.random()*LETTERS.length)],
        heartLead: Math.random() < .35,
        dim: .3 + Math.random()*.7
      });
    }
  }
  function drawRain(){
    ctx.textAlign = 'center';
    for (const c of cols){
      c.y += c.speed;
      const step = 13;
      for (let k=0;k<c.len;k++){
        const y = c.y - k*step;
        if (y < -10 || y > H+10) continue;
        const a = (1 - k/c.len) * c.dim;
        if (k === 0){
          ctx.fillStyle = `rgba(255,255,255,${.95*c.dim+.05})`;
          if (c.heartLead){ ctx.font = (fontSize+1)+'px serif'; ctx.fillText('♥', c.x, y); }
          else { ctx.font = fontSize+'px "Courier New",monospace'; ctx.fillText(c.head, c.x, y); }
        } else {
          ctx.fillStyle = `rgba(214,28,96,${a*.85})`;
          ctx.font = (fontSize-1)+'px serif';
          ctx.fillText('♥', c.x, y);
        }
      }
      if (c.y - c.len*13 > H){
        c.y = -Math.random()*120;
        c.speed = 0.5 + Math.random()*1.3;
        c.len = 6 + Math.floor(Math.random()*14);
        c.head = LETTERS[Math.floor(Math.random()*LETTERS.length)];
        c.heartLead = Math.random() < .35;
      }
    }
  }

  /* ---------- particle text (LED dot grid) ---------- */
  let STEP = 4;               // dot spacing
  const off = document.createElement('canvas');
  const octx = off.getContext('2d', {willReadFrequently:true});

  function sampleText(text){
    off.width = W; off.height = H;
    octx.clearRect(0,0,W,H);
    let size = Math.min(H*0.5, W*0.34, 260);
    octx.textAlign = 'center'; octx.textBaseline = 'middle';
    octx.fillStyle = '#fff';
    const font = s => `800 ${s}px "Arial Black","Trebuchet MS",Impact,sans-serif`;
    octx.font = font(size);
    while (octx.measureText(text).width > W*0.86 && size > 10){ size -= 2; octx.font = font(size); }
    octx.fillText(text, W/2, H/2);
    const data = octx.getImageData(0,0,W,H).data;
    const pts = [];
    for (let y=0;y<H;y+=STEP){
      for (let x=0;x<W;x+=STEP){
        if (data[(y*W+x)*4+3] > 128) pts.push({x:x+STEP/2,y:y+STEP/2});
      }
    }
    return pts;
  }

  let particles = [];
  function ensureParticles(n){
    while (particles.length < n){
      particles.push({
        x: Math.random()*W, y: Math.random()*H,
        vx:0, vy:0, tx:null, ty:null, a:0,
        r: 1.1 + Math.random()*.6,
        phase: Math.random()*Math.PI*2
      });
    }
  }

  let mode = 'scatter', targets = [];
  function formText(text){
    targets = sampleText(text);
    ensureParticles(targets.length);
    // shuffle so nearby particles don't all map to nearby targets (gives the swirl)
    const idx = particles.map((_,i)=>i).sort(()=>Math.random()-.5);
    for (let i=0;i<particles.length;i++){
      const p = particles[idx[i]];
      if (i < targets.length){ p.tx = targets[i].x; p.ty = targets[i].y; }
      else { p.tx = null; p.ty = null; }
    }
    mode = 'text';
  }
  function scatter(){
    mode = 'scatter';
    for (const p of particles){
      p.tx = null; p.ty = null;
      const ang = Math.random()*Math.PI*2, f = 2 + Math.random()*5;
      p.vx += Math.cos(ang)*f; p.vy += Math.sin(ang)*f;
    }
  }
  function drawParticles(){
    for (const p of particles){
      // pointer repel
      if (mouse.active){
        const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx*dx+dy*dy;
        if (d2 < 55*55 && d2 > 0.01){
          const d = Math.sqrt(d2), f = (55-d)/55*3.2;
          p.vx += dx/d*f; p.vy += dy/d*f;
        }
      }
      if (p.tx !== null){
        p.vx += (p.tx - p.x)*0.06;
        p.vy += (p.ty - p.y)*0.06;
        p.vx *= 0.80; p.vy *= 0.80;
        p.a += (1 - p.a)*0.15;
      } else {
        p.phase += .03;
        p.vx += Math.cos(p.phase)*0.05; p.vy += Math.sin(p.phase)*0.05 + 0.01;
        p.vx *= 0.96; p.vy *= 0.96;
        p.a += ((mode==='scatter' ? .6 : 0) - p.a)*0.05;
      }
      p.x += p.vx; p.y += p.vy;
      if (p.x < -10) p.x = W+10; if (p.x > W+10) p.x = -10;
      if (p.y < -10) p.y = H+10; if (p.y > H+10) p.y = -10;

      if (p.a < .03) continue;
      const settled = p.tx !== null && Math.abs(p.tx-p.x) < 1.5 && Math.abs(p.ty-p.y) < 1.5;
      ctx.beginPath();
      ctx.fillStyle = settled ? `rgba(246,240,224,${p.a})` : `rgba(235,235,235,${p.a*.85})`;
      ctx.arc(p.x, p.y, settled ? 1.35 : p.r, 0, Math.PI*2);
      ctx.fill();
    }
  }

  /* ---------- timeline ---------- */
  const SEQ = [
    ['3', 1300], ['2', 1300], ['1', 2800],
    ['I', 1800], ['love', 2100], ['you', 2300],
    ['Sweetheart', 4200]
  ];
  const GAP = 800;   // scatter time between words
  let seqTimer = null;
  function run(i){
    if (i >= SEQ.length){
      scatter();
      seqTimer = setTimeout(()=>run(0), 2200);
      return;
    }
    scatter();
    seqTimer = setTimeout(()=>{
      formText(SEQ[i][0]);
      seqTimer = setTimeout(()=>run(i+1), SEQ[i][1]);
    }, i === 0 ? 700 : GAP);
  }

  /* ---------- loop ---------- */
  function resize(){
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    const r = stage.getBoundingClientRect();
    W = Math.floor(r.width); H = Math.floor(r.height);
    cv.width = W*DPR; cv.height = H*DPR;
    ctx.setTransform(DPR,0,0,DPR,0,0);
    STEP = W > 700 ? 6 : 4;
    initRain();
    ensureParticles(500);
    if (mode === 'text' && seqTimer) { /* keep current word aligned after rotate */ }
  }
  window.addEventListener('resize', resize);

  function frame(){
    ctx.fillStyle = 'rgba(3,3,8,1)';
    ctx.fillRect(0,0,W,H);
    drawRain();
    drawParticles();
    requestAnimationFrame(frame);
  }

  resize();
  ctx.fillStyle = '#030308'; ctx.fillRect(0,0,W,H);
  run(0);
  frame();
})();