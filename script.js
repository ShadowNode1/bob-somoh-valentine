
// =========================================================
// Isekai Valentine Quest — ULTRA
// Vanilla HTML/CSS/JS + WebAudio chiptune
// =========================================================

let currentScreen = 1;
let noClickCount = 0;

// Countdown target (local time)
const TARGET_VALENTINE = new Date(2026, 1, 14, 16, 0, 0); // 2026/02/14 16:00 // 2026/02/14 16:00
const COUNTDOWN_DONE_KEY = 'bob_somoh_countdown_done';


const $ = (s, r=document) => r.querySelector(s);

const els = {
  s1: $("#screen1"),
  s2: $("#screen2"),
  s3: $("#screen3"),
  countdown: $("#countdown"),
  meterFill: $("#meterFill"),
  startBtn: $("#startBtn"),
  yesBtn: $("#yesBtn"),
  noBtn: $("#noBtn"),
  replayBtn: $("#replayBtn"),
  noCount: $("#noCount"),
  hpFill: $("#hpFill"),
  mpFill: $("#mpFill"),
  loveFill: $("#loveFill"),
  statusText: $("#statusText"),
  questText: $("#questText"),
  dialogText: $("#dialogText"),
  npc: $("#npc"),
  emote: $("#emote"),
  clock: $("#clock"),
  soundBtn: $("#soundBtn"),
  soundState: $("#soundState"),
  fx: $("#fx"),
};

function showScreen(n){
  [els.s1, els.s2, els.s3].forEach(x=>x.classList.remove("active"));
  (n===1?els.s1:n===2?els.s2:els.s3).classList.add("active");
  currentScreen = n;
  if (n === 3) loadEndGif();
}

function loadEndGif(){
  const img = document.getElementById("endGif");
  if (!img) return;
  fetch("assets/gif_end.gif", { cache: "no-store" })
    .then(r => { if(!r.ok) throw new Error("gif fetch failed"); return r.blob(); })
    .then(b => { img.src = URL.createObjectURL(b); })
    .catch(() => { img.src = "assets/gif_end.gif"; });
}

// ---------------------- CLOCK ----------------------
function pad2(n){ return String(n).padStart(2,"0"); }
function tickClock(){
  const d = new Date();
  els.clock.textContent = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}
setInterval(tickClock, 500);
tickClock();

// ---------------------- AUDIO (WebAudio) ----------------------
let soundEnabled = true;
let unlocked = false;
let ctx = null;
let master = null;
let musicTimer = null;
let musicStep = 0;

function ensureAudio(){
  if (!ctx){
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = AC ? new AC() : null;
    if (ctx){
      master = ctx.createGain();
      master.gain.value = 0.22; // overall volume
      master.connect(ctx.destination);
    }
  }
  return ctx;
}

function unlockAudio(){
  if (unlocked) return;
  unlocked = true;
  const c = ensureAudio();
  if (c && c.state === "suspended") c.resume();
  playSfx("intro");
  startMusic();
}


async function tryAutoStartAudio(){
  // Best-effort: some browsers block autoplay until user gesture.
  const c = ensureAudio();
  if (!c) return;
  try{
    if (c.state === "suspended") await c.resume();
    unlocked = true;
    playSfx("intro");
    startMusic();
  }catch(e){
    // Autoplay blocked — user gesture listener will handle unlock.
  }
}

function setSoundUI(){
  els.soundState.textContent = soundEnabled ? "ON" : "OFF";
}

function tone({freq=440, dur=0.09, type="square", gain=0.22, slide=null}={}){
  if (!soundEnabled) return;
  const c = ensureAudio();
  if (!c) return;

  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime);

  if (slide){
    o.frequency.exponentialRampToValueAtTime(slide, c.currentTime + dur);
  }

  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);

  o.connect(g);
  g.connect(master);

  o.start();
  o.stop(c.currentTime + dur);
}

function noise(dur=0.08, gain=0.10){
  if (!soundEnabled) return;
  const c = ensureAudio();
  if (!c) return;

  const bufferSize = Math.floor(c.sampleRate * dur);
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i=0;i<bufferSize;i++){
    data[i] = (Math.random()*2-1) * (1 - i/bufferSize);
  }

  const src = c.createBufferSource();
  const g = c.createGain();
  g.gain.value = gain;
  src.buffer = buffer;
  src.connect(g);
  g.connect(master);
  src.start();
}

function playSfx(id){
  // SFX presets (8-bit)
  switch(id){
    case "intro":
      tone({freq:784, dur:.08, gain:.20}); setTimeout(()=>tone({freq:988, dur:.10, gain:.18}), 90);
      break;
    case "countdown":
      tone({freq:880, dur:.10, gain:.22}); break;
    case "start":
      tone({freq:659, dur:.08, gain:.22}); setTimeout(()=>tone({freq:988, dur:.12, gain:.20}), 90);
      break;
    case "no":
      tone({freq:220, dur:.12, gain:.22, slide:160}); noise(.06,.06); break;
    case "angry":
      tone({freq:140, dur:.10, gain:.22}); setTimeout(()=>tone({freq:120, dur:.12, gain:.22}), 90);
      break;
    case "destroy":
      noise(.14,.10); tone({freq:260, dur:.10, gain:.18, slide:90}); break;
    case "yes":
      tone({freq:740, dur:.10, gain:.22}); setTimeout(()=>tone({freq:988, dur:.14, gain:.20}), 90);
      break;
    case "end":
      tone({freq:392, dur:.12, gain:.20}); setTimeout(()=>tone({freq:523, dur:.12, gain:.18}), 120); setTimeout(()=>tone({freq:784, dur:.16, gain:.18}), 240);
      break;
  }
}

function startMusic(){
  if (musicTimer || !soundEnabled) return;
  // chiptune loop: melody + bass + soft percussion
  const melody = [784, 740, 659, 740, 784, 988, 880, 784, 740, 659, 587, 659, 740, 659, 587, 523];
  const bass   = [196, 196, 220, 220, 246, 246, 220, 220, 196, 196, 174, 174, 196, 196, 174, 174];
  musicStep = 0;

  musicTimer = setInterval(()=>{
    if (!soundEnabled) return;

    // melody (square)
    tone({freq: melody[musicStep % melody.length], dur:.09, gain:.10, type:"square"});
    // bass (triangle)
    tone({freq: bass[musicStep % bass.length], dur:.12, gain:.06, type:"triangle"});

    // percussion every 4 steps
    if (musicStep % 4 === 0) noise(.03,.04);

    musicStep++;
  }, 160);
}

function stopMusic(){
  if (musicTimer){ clearInterval(musicTimer); musicTimer = null; }
}

els.soundBtn.addEventListener("click", (e)=>{
  e.stopPropagation();
  soundEnabled = !soundEnabled;
  setSoundUI();
  if (!soundEnabled) stopMusic();
  else if (unlocked) startMusic();
});

setSoundUI();

window.addEventListener("pointerdown", unlockAudio, { once:true });
window.addEventListener("keydown", unlockAudio, { once:true });

// ---------------------- COUNTDOWN ----------------------
let countdownTimer = null;

function startCountdown(){
  // ✅ Production: use time only (no localStorage)
  const TEST_MODE = false;   // true = test seconds, false = real date
  const TEST_SECONDS = 10;

  // clear any old timers
  if (countdownTimer){
    try { clearTimeout(countdownTimer); } catch(e){}
    try { clearInterval(countdownTimer); } catch(e){}
    countdownTimer = null;
  }

  els.startBtn.classList.add("hidden");

  const pad = (n)=>String(n).padStart(2,"0");

  const playGo = () => {
    els.countdown.textContent = "GO!";
    playSfx("start");
    if (els.meterFill) els.meterFill.style.width = "100%";
    setTimeout(()=> els.startBtn.classList.remove("hidden"), 450);
  };

  const classic321 = () => {
    let n = 3;

    const step = () => {
      playSfx("countdown");
      els.countdown.textContent = String(n);

      // ✅ 33% -> 66% -> 100%
      if (els.meterFill) els.meterFill.style.width = `${((4 - n) / 3) * 100}%`;

      if (n === 1){
        setTimeout(playGo, 650);
        return;
      }
      n--;
      countdownTimer = setTimeout(step, 1000);
    };

    els.countdown.textContent = "3";
    if (els.meterFill) els.meterFill.style.width = "0%";
    countdownTimer = setTimeout(step, 350);
  };

  // Decide end time
  const endAt = TEST_MODE
    ? new Date(Date.now() + TEST_SECONDS * 1000)
    : TARGET_VALENTINE;

  // If already past target -> classic 3-2-1-GO
  if (!TEST_MODE && Date.now() >= endAt.getTime()){
    classic321();
    return;
  }

  // hh:mm:ss countdown
  const tick = () => {
    const diff = Math.max(0, endAt.getTime() - Date.now());
    const totalSec = Math.floor(diff / 1000);

    const hh = Math.floor(totalSec / 3600);
    const mm = Math.floor((totalSec % 3600) / 60);
    const ss = totalSec % 60;

    els.countdown.textContent = `${pad(hh)}:${pad(mm)}:${pad(ss)}`;

    // meter
    if (els.meterFill){
      let pct = 0;
      if (TEST_MODE){
        pct = (1 - (totalSec / TEST_SECONDS)) * 100;
      } else {
        // smooth wave while waiting (no need full duration)
        const wave = (Math.sin(Date.now()/900) + 1) / 2;
        pct = 15 + wave * 85;
      }
      els.meterFill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
    }

    if (diff > 0) playSfx("countdown");

    if (diff <= 0){
      playGo();
      return;
    }

    countdownTimer = setTimeout(tick, 1000);
  };

  tick();
}


// ---------------------- FX CANVAS (Hearts + Flowers + Sparkles) ----------------------
const fx = els.fx;
const fxc = fx.getContext("2d");
let W=0,H=0,DPR=1;
const parts=[];

function resizeFx(){
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = fx.clientWidth; H = fx.clientHeight;
  fx.width = Math.floor(W*DPR); fx.height = Math.floor(H*DPR);
  fxc.setTransform(DPR,0,0,DPR,0,0);
}
window.addEventListener("resize", resizeFx);

function rand(a,b){ return a + Math.random()*(b-a); }

function spawn(type){
  return {
    type,
    x: rand(0,W),
    y: rand(H*0.35, H+40),
    vx: rand(-14,14)/60,
    vy: rand(18,42)/60,
    s: rand(0.7, 1.6),
    r: rand(0, Math.PI*2),
    vr: rand(-0.03, 0.03),
    a: rand(0.55, 0.95)
  };
}

function drawHeart(p){
  const x=p.x,y=p.y,s=p.s;
  fxc.save();
  fxc.translate(x,y);
  fxc.rotate(p.r);
  fxc.globalAlpha=p.a;
  fxc.scale(s,s);
  fxc.fillStyle="#ff4fa6";
  fxc.fillRect(-6,-4,4,4);
  fxc.fillRect(2,-4,4,4);
  fxc.fillRect(-8,0,16,6);
  fxc.fillRect(-6,6,12,4);
  fxc.fillRect(-4,10,8,4);
  fxc.fillRect(-2,14,4,4);
  fxc.fillStyle="rgba(255,255,255,.35)";
  fxc.fillRect(-6,-2,2,2);
  fxc.restore();
}

function drawFlower(p){
  const x=p.x,y=p.y,s=p.s;
  fxc.save();
  fxc.translate(x,y);
  fxc.rotate(p.r);
  fxc.globalAlpha=p.a;
  fxc.scale(s,s);
  fxc.fillStyle="#5ad6ff";
  fxc.fillRect(-2,-8,4,4);
  fxc.fillRect(-8,-2,4,4);
  fxc.fillRect(4,-2,4,4);
  fxc.fillRect(-2,4,4,4);
  fxc.fillStyle="#ffffff";
  fxc.fillRect(-2,-2,4,4);
  fxc.restore();
}

function drawSpark(p){
  const x=p.x,y=p.y,s=p.s;
  fxc.save();
  fxc.translate(x,y);
  fxc.globalAlpha=p.a*0.8;
  fxc.scale(s,s);
  fxc.fillStyle="rgba(255,255,255,.9)";
  fxc.fillRect(-1,-1,2,2);
  fxc.restore();
}

function burst(kind, count){
  for(let i=0;i<count;i++){
    parts.push(spawn(kind));
    parts[parts.length-1].x = rand(W*0.2, W*0.8);
    parts[parts.length-1].y = rand(H*0.25, H*0.75);
    parts[parts.length-1].vy = rand(50,90)/60;
    parts[parts.length-1].vx = rand(-50,50)/60;
  }
}

function stepFx(){
  fxc.clearRect(0,0,W,H);
  const t = performance.now()/1000;
  const sway = Math.sin(t*0.7)*10;

  for(let i=parts.length-1;i>=0;i--){
    const p = parts[i];
    p.y -= p.vy*60;
    p.x += p.vx*60 + sway*0.002;
    p.r += p.vr;

    if (p.type==="heart") drawHeart(p);
    else if (p.type==="flower") drawFlower(p);
    else drawSpark(p);

    if (p.y < -80 || p.x < -120 || p.x > W+120){
      parts.splice(i,1);
    }
  }

  // keep ambient density (not empty)
  while(parts.length < 70){
    const r = Math.random();
    parts.push(spawn(r < 0.55 ? "heart" : (r < 0.9 ? "flower" : "spark")));
  }

  requestAnimationFrame(stepFx);
}

// ---------------------- GAME LOGIC ----------------------
function updateBars(){
  // HP always full (cute), MP full, LOVE reduces by NO clicks
  els.hpFill.style.width = "100%";
  els.mpFill.style.width = "100%";
  const love = Math.max(0, 100 - noClickCount*22);
  els.loveFill.style.width = `${love}%`;
  els.noCount.textContent = String(noClickCount);
}

function setStatus(text){ els.statusText.textContent = text; }

function handleNoClick(){
  noClickCount++;
  updateBars();

  playSfx("no");
  els.npc.classList.add("angry");
  els.emote.textContent = "💢";
  setStatus("ANGRY");

  playSfx("angry");
  burst("spark", 14);
  burst("heart", 10);

  // YES grows
  const scale = 1 + Math.min(0.75, noClickCount*0.12);
  els.yesBtn.style.transform = `scale(${scale.toFixed(2)})`;

  // Update dialog flavor
  const lines = [
    "SOMOH… are you sure? 😤",
    "BOB took critical damage… 💔",
    "NO button is nerfed! 😡",
    "Patch note: NO removed."
  ];
  els.dialogText.textContent = lines[Math.min(lines.length-1, noClickCount-1)];

  setTimeout(()=>{
    els.npc.classList.remove("angry");
    els.emote.textContent = "💗";
    if (noClickCount < 4) setStatus("CALM");
  }, 650);

  if (noClickCount >= 4 && els.noBtn){
    playSfx("destroy");
    els.noBtn.classList.add("destroy");
    setStatus("BOB MODE");
    setTimeout(()=>{
      els.noBtn.remove();
      els.yesBtn.textContent = "YES ❤️";
      els.yesBtn.style.transform = "scale(1.35)";
      burst("spark", 18);
      burst("heart", 16);
      els.dialogText.textContent = "Only YES remains, SOMOH… choose it ❤️";
    }, 560);
  }
}

function handleYesClick(){
  playSfx("yes");
  burst("heart", 26);
  burst("spark", 18);
  showScreen(3);
  playSfx("end");
}

function resetGame(){
  // restore NO if missing
  if (!$("#noBtn")){
    const b = document.createElement("button");
    b.id = "noBtn";
    b.className = "btn btn-no";
    b.type = "button";
    b.textContent = "NO";
    document.querySelector(".actions").appendChild(b);
    els.noBtn = b;
    els.noBtn.addEventListener("click", ()=>{ unlockAudio(); handleNoClick(); });
  }else{
    els.noBtn.classList.remove("destroy");
    els.noBtn.style.transform = "";
    els.noBtn.style.opacity = "";
  }

  noClickCount = 0;
  els.yesBtn.textContent = "YES";
  els.yesBtn.style.transform = "scale(1)";
  els.dialogText.textContent = "SOMOH… will you be my Valentine?";
  els.questText.textContent = "Ask the NPC for a Valentine promise.";
  setStatus("CALM");
  updateBars();
}

function wire(){
  els.startBtn.addEventListener("click", ()=>{
    unlockAudio();
    playSfx("start");
    showScreen(2);
  });

  els.yesBtn.addEventListener("click", ()=>{
    unlockAudio();
    handleYesClick();
  });

  els.noBtn.addEventListener("click", ()=>{
    unlockAudio();
    handleNoClick();
  });

  els.replayBtn.addEventListener("click", ()=>{
    resetGame();
    showScreen(1);
    startCountdown();
  });
}

document.addEventListener("DOMContentLoaded", ()=>{
  loadEndGif();
  tryAutoStartAudio();
  resizeFx();
  // seed particles
  for(let i=0;i<70;i++){
    const r = Math.random();
    parts.push(spawn(r < 0.55 ? "heart" : (r < 0.9 ? "flower" : "spark")));
  }
  stepFx();

  updateBars();
  setStatus("CALM");
  wire();
  startCountdown();

  // unlock on first gesture
  window.addEventListener("pointerdown", unlockAudio, { once:true });
  window.addEventListener("keydown", unlockAudio, { once:true });
});

// ===== CUSTOM GAME LOGIC START =====
// Add future Valentine game logic here
// ===== CUSTOM GAME LOGIC END =====
