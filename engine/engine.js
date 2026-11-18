/* NUR 114 shared engine — loaded by every module after its content script.
   Each module defines: QUIZ, CASES, FLASH, MATCH, RESCUE, its unit consts, and
   const MODULE = {num, units, colors, topicGroups?, timed?, dailyExclude?, badgeUnits?, badges?, examName?}. */
const UNITS = MODULE.units;

const UNIT_COLORS = MODULE.colors;
function unitIndexOf(id){
  for(let i=0;i<UNITS.length;i++){ if(UNITS[i].lessons.some(l=>l.id===id)) return i; }
  return 0;
}

const L = {}; const ORDER = [];
UNITS.forEach(u => u.lessons.forEach(x => { L[x.id] = x; ORDER.push(x.id); }));


const S = { view:"home", id:null, i:0, pick:null, multi:[], submitted:false, textAnswer:"", fitbCorrect:false, activeTab:0,
  clickPoint:null, hotspotCorrect:false, ddSel:null, ddPlace:{}, orderArr:null, matrixSel:{}, bowtie:{condition:null, actions:[], params:[]}, lastPoints:0,
  shuffledBank:null, clozeSel:{}, gtpalVals:["","","","",""],
  score:0, wrong:[], best:{}, openGroups:{}, openUnits:{} };
const app = document.getElementById("app");
const back = document.getElementById("back");
back.onclick = () => nav("home");
function nav(v, o){ Object.assign(S, {view:v, pick:null, multi:[], submitted:false, textAnswer:"", fitbCorrect:false, activeTab:0,
  clickPoint:null, hotspotCorrect:false, ddSel:null, ddPlace:{}, orderArr:null, matrixSel:{}, bowtie:{condition:null, actions:[], params:[]}, lastPoints:0, shuffledBank:null, clozeSel:{}, gtpalVals:["","","","",""]}, o||{}); draw(); scrollTo(0,0); }

function shuffleExam(bank){
  const caseBlock = bank.filter(q=>q.caseId);
  const others = bank.filter(q=>!q.caseId).slice();
  for(let i=others.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [others[i],others[j]] = [others[j],others[i]];
  }
  const insertAt = Math.floor(Math.random()*(others.length+1));
  return others.slice(0,insertAt).concat(caseBlock, others.slice(insertAt));
}
function curBank(){ if(!S.shuffledBank && S.id==="game-daily") S.shuffledBank = buildBank("game-daily"); return S.shuffledBank || QUIZ[S.id]; }
function isExamId(id){ return !!id && id.startsWith("exam"); }
function shuffleIdx(n){ const a=[...Array(n).keys()]; for(let i=n-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function shuffleOpts(q){
  if(!q.options || q.noShuffle || (q.type && q.type!=="sata")) return q;
  const idx = shuffleIdx(q.options.length), opts = idx.map(i=>q.options[i]);
  if(q.type==="sata") return Object.assign({}, q, {options:opts, answers:q.answers.map(a=>idx.indexOf(a))});
  return Object.assign({}, q, {options:opts, answer:idx.indexOf(q.answer)});
}
const TIMED = MODULE.timed || {};
function isTimed(id){ return !!TIMED[id]; }
function isEndReview(id){ return isExamId(id) || isTimed(id); }
function isGame(id){ return !!id && (id.startsWith("game-") || id.startsWith("drill-")); }
function shuffled(arr){ const idx = shuffleIdx(arr.length); return idx.map(i=>arr[i]); }
function dailyFive(){
  const pool = [];
  Object.entries(QUIZ).forEach(([k,qs])=>{ if(isExamId(k) || isGame(k) || (MODULE.dailyExclude||[]).indexOf(k)>=0) return; qs.forEach(q=>{ if(!q.caseId) pool.push(Object.assign({ref:k}, q)); }); });
  return shuffled(pool).slice(0,5);
}
function buildBank(id){
  let base;
  if(id === "game-daily") base = dailyFive();
  else if(isExamId(id)) base = shuffleExam(QUIZ[id]);
  else if(isTimed(id)) base = shuffled(QUIZ[id]);
  else base = QUIZ[id].slice();
  return base.map(shuffleOpts);
}
const LETTERS = ["A","B","C","D","E","F"];
function correctTextOf(q){
  const A = LETTERS;
  if(q.type === "sata") return q.answers.slice().sort((a,b)=>a-b).map(idx=>A[idx]+". "+q.options[idx]).join("; ");
  if(q.type === "fitb") return String(q.answer);
  if(q.type === "cloze") return q.blanks.map(b=>b.options[b.correct]).join(" · ");
  if(q.type === "gtpal") return ["G","T","P","A","L"].map((l,idx)=>l+q.answers[idx]).join(" ");
  if(q.type === "hotspot") return "See the outlined region in the lesson/question image.";
  if(q.type === "dragdrop") return q.items.map((it,idx)=>it+" → "+q.bins[q.correctBin[idx]]).join("; ");
  if(q.type === "ordering") return q.items.join(" → ");
  if(q.type === "matrix") return q.rows.map((r,idx)=>r+" → "+q.cols[q.correct[idx]]).join("; ");
  if(q.type === "bowtie") return "Condition: "+q.conditionOptions[q.correctCondition]+" · Actions: "+q.correctActions.map(idx=>q.actionOptions[idx]).join(", ")+" · Parameters: "+q.correctParams.map(idx=>q.paramOptions[idx]).join(", ");
  return A[q.answer]+". "+q.options[q.answer];
}
function userTextOf(q){
  const A = LETTERS, none = "(no answer)";
  if(q.type === "sata") return S.multi.length ? S.multi.slice().sort((a,b)=>a-b).map(i=>A[i]+". "+q.options[i]).join("; ") : none;
  if(q.type === "fitb") return S.textAnswer || none;
  if(q.type === "cloze") return q.blanks.map((b,i)=>S.clozeSel[i]!==undefined ? b.options[S.clozeSel[i]] : "—").join(" · ");
  if(q.type === "dragdrop") return q.items.map((it,i)=>it+" → "+(S.ddPlace[i]!==undefined ? q.bins[S.ddPlace[i]] : "—")).join("; ");
  if(q.type === "ordering") return S.orderArr ? S.orderArr.map(i=>q.items[i]).join(" → ") : none;
  if(q.type === "matrix") return q.rows.map((r,i)=>r+" → "+(S.matrixSel[i]!==undefined ? q.cols[S.matrixSel[i]] : "—")).join("; ");
  if(q.type === "bowtie") return "Condition: "+(S.bowtie.condition!==null ? q.conditionOptions[S.bowtie.condition] : "—")+" · Actions: "+(S.bowtie.actions.map(i=>q.actionOptions[i]).join(", ")||"—")+" · Parameters: "+(S.bowtie.params.map(i=>q.paramOptions[i]).join(", ")||"—");
  if(q.type === "gtpal") return S.gtpalVals.join(" ");
  if(q.type === "hotspot") return S.clickPoint ? "Clicked a point" : none;
  return S.pick!==null ? A[S.pick]+". "+q.options[S.pick] : none;
}
let TIMER = null;
function startTimer(){
  if(TIMER) clearInterval(TIMER);
  TIMER = setInterval(()=>{
    if(S.view!=="quiz" || !isTimed(S.id)){ clearInterval(TIMER); TIMER=null; return; }
    const left = Math.max(0, Math.ceil((S.deadline - Date.now())/1000));
    const el = document.getElementById("gmTimer");
    if(el){ el.textContent = left+"s"; el.classList.toggle("low", left<=10); }
    if(left<=0){ clearInterval(TIMER); TIMER=null; finishTimed(); }
  }, 250);
}
function finishTimed(){
  const b = S.best[S.id];
  if(b === undefined || S.score > b) S.best[S.id] = S.score;
  nav("result",{shuffledBank:S.shuffledBank, answered:S.i});
}
function goNext(){
  const bank = curBank();
  if(S.i < bank.length-1){
    S.i++; S.pick = null; S.multi = []; S.submitted = false; S.textAnswer = ""; S.fitbCorrect = false; S.activeTab = 0;
    S.clickPoint = null; S.hotspotCorrect = false; S.ddSel = null; S.ddPlace = {}; S.orderArr = null; S.matrixSel = {};
    S.bowtie = {condition:null, actions:[], params:[]}; S.lastPoints = 0; S.clozeSel = {}; S.gtpalVals = ["","","","",""];
    S.qStartScore = S.score; S.streakDone = false;
    draw(); if(!isTimed(S.id)) scrollTo(0,0); return;
  }
  const b = S.best[S.id];
  if(b === undefined || S.score > b) S.best[S.id] = S.score;
  nav("result",{shuffledBank:S.shuffledBank, answered:bank.length});
}


function renderCaseTabs(caseId){
  const c = CASES[caseId];
  let h = '<div class="case-box"><div class="case-title">'+c.title+'</div><div class="case-tabs">';
  c.tabs.forEach((t,i)=>{
    h += '<button class="case-tab'+(S.activeTab===i?" active":"")+'" data-tab="'+i+'">'+t.label+"</button>";
  });
  h += '</div><div class="case-panel">';
  c.tabs[S.activeTab].blocks.forEach(b => h += blk(b));
  h += "</div></div>";
  return h;
}

// let long slash-joined words ("fruit/vegetables/flowers") wrap on phones without breaking words mid-word
function wbrSlash(c){ return String(c).replace(/(<[^>]*>)|\/(?=\S)/g, function(m, tag){ return tag ? tag : "/<wbr>"; }); }
function blk(b){
  if(b.h) return "<h4>"+b.h+"</h4>";
  if(b.p) return "<p>"+b.p+"</p>";
  if(b.list) return "<ul>"+b.list.map(i=>"<li>"+i+"</li>").join("")+"</ul>";
  if(b.hook) return '<div class="hook">'+b.hook+"</div>";
  if(b.img) return '<figure class="figure"><img src="'+b.img+'" alt="'+(b.caption||"")+'" loading="lazy">'+(b.caption?'<figcaption>'+b.caption+"</figcaption>":"")+"</figure>";
  if(b.table) return '<div class="tbl-wrap"><table class="'+(b.table.head.length>=3?'stack':'')+'"><thead><tr>'+b.table.head.map(x=>"<th>"+x+"</th>").join("")+
    "</tr></thead><tbody>"+b.table.rows.map(r=>"<tr>"+r.map((c,i)=>'<td data-label="'+String(b.table.head[i]||"").replace(/<[^>]+>/g,"").replace(/"/g,"&quot;")+'">'+wbrSlash(c)+"</td>").join("")+"</tr>").join("")+
    "</tbody></table></div>";
  return "";
}

function qHTML(q, label){
  const A = ["A","B","C","D","E","F"], p = S.pick, sub = S.submitted;
  let h = '<div class="q">'+(label?'<div class="lbl">'+label+"</div>":"")+'<p class="stem">'+q.stem+"</p>";
  q.options.forEach((o,i)=>{
    let c = "opt";
    if(sub){ if(i===q.answer) c+=" right"; else if(i===p) c+=" mine"; }
    else if(i===p) c+=" picked";
    h += '<button class="'+c+'" data-p="'+i+'"'+(sub?" disabled":"")+"><b>"+A[i]+"</b>  "+o+"</button>";
  });
  if(!sub){
    if(!(S.view==="quiz" && isTimed(S.id))) h += '<div class="acts"><button data-submit-mc="1"'+(p===null?" disabled":"")+'>Submit answer</button></div>';
  } else {
    const ok = p === q.answer;
    h += '<p class="verdict '+(ok?"y":"n")+'">'+(ok?"Correct":"Answer: "+A[q.answer])+"</p><p>"+q.why+"</p>";
  }
  return h+"</div>";
}

function sataHTML(q){
  const A = ["A","B","C","D","E","F"], sel = S.multi, sub = S.submitted;
  let h = '<div class="q"><div class="sata-note">Select all that apply</div><p class="stem">'+q.stem+"</p>";
  q.options.forEach((o,i)=>{
    let c = "opt sata", isSel = sel.includes(i), isCorrect = q.answers.includes(i);
    if(sub){
      if(isCorrect && isSel) c+=" right";
      else if(isCorrect && !isSel) c+=" missed";
      else if(!isCorrect && isSel) c+=" mine";
    } else if(isSel) c+=" picked";
    h += '<button class="'+c+'" data-t="'+i+'"'+(sub?" disabled":"")+"><b>"+(isSel?"\u2611":"\u2610")+"</b>  "+o+"</button>";
  });
  if(!sub){
    h += '<div class="acts"><button data-submit="1">Submit answer</button></div>';
  } else {
    const ok = sel.slice().sort((a,b)=>a-b).join(",") === q.answers.slice().sort((a,b)=>a-b).join(",");
    const ansText = q.answers.map(i=>A[i]).join(", ");
    h += '<p class="verdict '+(ok?"y":"n")+'">'+(ok?"Correct":"Answer: "+ansText)+"</p><p>"+q.why+"</p>";
  }
  return h+"</div>";
}

function fitbHTML(q){
  const sub = S.submitted;
  let h = '<div class="q"><div class="sata-note">Fill in the blank</div><p class="stem">'+q.stem+"</p>";
  if(!sub){
    h += '<input type="text" inputmode="decimal" class="fitb-input" id="fitbInput" placeholder="Your answer" value="'+S.textAnswer+'">';
    h += '<div class="acts"><button data-submit-fitb="1">Submit answer</button></div>';
  } else {
    const ok = S.fitbCorrect;
    h += '<input type="text" class="fitb-input" value="'+S.textAnswer+'" disabled>';
    h += '<p class="verdict '+(ok?"y":"n")+'">'+(ok?"Correct":"Correct answer: "+q.answer)+"</p><p>"+q.why+"</p>";
  }
  return h+"</div>";
}

function gtpalHTML(q){
  const sub = S.submitted;
  const letters = ["G","T","P","A","L"];
  let h = '<div class="q"><div class="sata-note">Fill in the blank — GTPAL</div><p class="stem">'+q.stem+"</p>";
  h += '<div class="gtpal-inputs">';
  letters.forEach((letter,i)=>{
    const val = sub ? (S.gtpalVals[i]||"") : "";
    h += '<label class="gtpal-field"><span class="gtpal-letter">'+letter+'</span><input type="text" inputmode="numeric" class="gtpal-input" id="gtpalInput'+i+'" placeholder="—" value="'+val+'"'+(sub?" disabled":"")+"></label>";
  });
  h += "</div>";
  if(!sub){
    h += '<div class="acts"><button data-submit-gtpal="1">Submit answer</button></div>';
  } else {
    const ok = letters.every((_,i)=>parseInt(S.gtpalVals[i]) === q.answers[i]);
    const correctStr = letters.map((l,i)=>l+q.answers[i]).join(" ");
    h += '<p class="verdict '+(ok?"y":"n")+'">'+(ok?"Correct":"Correct answer: "+correctStr)+"</p><p>"+q.why+"</p>";
  }
  return h+"</div>";
}

function clozeHTML(q){
  const sub = S.submitted;
  let text = q.template;
  q.blanks.forEach((b,i)=>{
    const selVal = S.clozeSel[i];
    let opts = '<option value="">choose…</option>'+b.options.map((o,oi)=>'<option value="'+oi+'"'+(selVal===oi?" selected":"")+'>'+o+"</option>").join("");
    let cls = "blank-select";
    if(sub) cls += selVal===b.correct ? " right" : " wrong";
    text = text.replace("{"+i+"}", '<select class="'+cls+'" data-cloze-blank="'+i+'"'+(sub?" disabled":"")+'>'+opts+"</select>");
  });
  let h = '<div class="q"><div class="sata-note">Drop-Down (Cloze) — choose the correct word for each blank</div><p class="cloze-text">'+text+"</p>";
  const allAnswered = q.blanks.every((_,i)=>S.clozeSel[i]!==undefined);
  if(!sub){
    h += '<div class="acts"><button data-submit-cloze="1"'+(!allAnswered?" disabled":"")+'>Submit answer</button></div>';
  } else {
    const correctCount = q.blanks.filter((b,i)=>S.clozeSel[i]===b.correct).length;
    const ok = correctCount === q.blanks.length;
    h += '<p class="verdict '+(ok?"y":"n")+'">'+correctCount+" of "+q.blanks.length+" blanks correct — "+S.lastPoints.toFixed(2)+" pt (partial credit)</p><p>"+q.why+"</p>";
  }
  return h+"</div>";
}

function hotspotHTML(q){
  const sub = S.submitted;
  let h = '<div class="q"><div class="sata-note">Hot Spot — click the image</div><p class="stem">'+q.stem+"</p>";
  h += '<div class="hotspot-wrap" id="hotspotWrap">';
  h += '<img src="'+q.image+'" class="hotspot-img" draggable="false">';
  if(S.clickPoint) h += '<div class="hotspot-marker" style="left:'+S.clickPoint.x+'%;top:'+S.clickPoint.y+'%"></div>';
  if(sub){
    const r = q.region;
    h += '<div class="hotspot-region" style="left:'+r.x+'%;top:'+r.y+'%;width:'+r.w+'%;height:'+r.h+'%"></div>';
  }
  h += "</div>";
  if(!sub){
    h += '<div class="acts"><button data-submit-hotspot="1"'+(!S.clickPoint?" disabled":"")+'>Submit answer</button></div>';
  } else {
    const ok = S.hotspotCorrect;
    h += '<p class="verdict '+(ok?"y":"n")+'">'+(ok?"Correct — 1/1 pt":"Not quite — 0/1 pt. The correct area is outlined above")+"</p><p>"+q.why+"</p>";
  }
  return h+"</div>";
}

function dragdropHTML(q){
  const sub = S.submitted;
  let h = '<div class="q"><div class="sata-note">Drag and Drop — tap an item, then tap its category</div><p class="stem">'+q.stem+"</p>";
  const unplaced = q.items.map((_,idx)=>idx).filter(idx => S.ddPlace[idx] === undefined);
  h += '<div class="dd-pool">';
  unplaced.forEach(idx=>{
    h += '<button class="dd-chip'+(S.ddSel===idx?" sel":"")+'" data-dd-pick="'+idx+'"'+(sub?" disabled":"")+'>'+q.items[idx]+"</button>";
  });
  if(!unplaced.length) h += '<span style="color:var(--dim);font-size:13px">All items placed</span>';
  h += "</div>";
  h += '<div class="dd-bins">';
  q.bins.forEach((bin,binIdx)=>{
    h += '<div class="dd-bin" data-dd-bin="'+binIdx+'"><div class="dd-bin-label">'+bin+"</div>";
    q.items.forEach((item,idx)=>{
      if(S.ddPlace[idx] !== binIdx) return;
      let c = "dd-chip";
      if(sub){ c += q.correctBin[idx] === binIdx ? " right" : " wrong"; }
      h += '<button class="'+c+'" data-dd-unplace="'+idx+'"'+(sub?" disabled":"")+'>'+item+"</button>";
    });
    h += "</div>";
  });
  h += "</div>";
  const allPlaced = q.items.every((_,idx)=>S.ddPlace[idx] !== undefined);
  if(!sub){
    h += '<div class="acts"><button data-submit-dd="1"'+(!allPlaced?" disabled":"")+'>Submit answer</button></div>';
  } else {
    const correctCount = q.items.filter((_,idx)=>S.ddPlace[idx]===q.correctBin[idx]).length;
    const ok = correctCount === q.items.length;
    h += '<p class="verdict '+(ok?"y":"n")+'">'+correctCount+" of "+q.items.length+" placed correctly — "+S.lastPoints.toFixed(2)+" pt (partial credit)</p><p>"+q.why+"</p>";
  }
  return h+"</div>";
}

function orderingHTML(q){
  const sub = S.submitted;
  if(!S.orderArr){
    S.orderArr = q.items.map((_,i)=>i);
    for(let i=S.orderArr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [S.orderArr[i],S.orderArr[j]]=[S.orderArr[j],S.orderArr[i]]; }
  }
  let h = '<div class="q"><div class="sata-note">Ordering — arrange in the correct sequence</div><p class="stem">'+q.stem+"</p>";
  h += '<ul class="order-list">';
  S.orderArr.forEach((itemIdx,pos)=>{
    let c = "order-item";
    if(sub) c += itemIdx === pos ? " right" : " wrong";
    h += '<li class="'+c+'"><span class="num">'+(pos+1)+".</span><span class=\"txt\">"+q.items[itemIdx]+'</span>';
    if(!sub){
      h += '<span class="order-btns">'+
        (pos>0?'<button data-order-up="'+pos+'">↑</button>':"")+
        (pos<S.orderArr.length-1?'<button data-order-down="'+pos+'">↓</button>':"")+
        "</span>";
    }
    h += "</li>";
  });
  h += "</ul>";
  if(!sub){
    h += '<div class="acts"><button data-submit-order="1">Submit answer</button></div>';
  } else {
    const correctCount = S.orderArr.filter((itemIdx,pos)=>itemIdx===pos).length;
    const ok = correctCount === S.orderArr.length;
    h += '<p class="verdict '+(ok?"y":"n")+'">'+correctCount+" of "+S.orderArr.length+" in the correct position — "+S.lastPoints.toFixed(2)+" pt (partial credit)</p><p>"+q.why+"</p>";
  }
  return h+"</div>";
}

function matrixHTML(q){
  const sub = S.submitted;
  let h = '<div class="q"><div class="sata-note">Matrix/Grid — one answer per row</div><p class="stem">'+q.stem+"</p>";
  h += '<table class="matrix-table"><thead><tr><th></th>'+q.cols.map(c=>"<th>"+c+"</th>").join("")+"</tr></thead><tbody>";
  q.rows.forEach((row,rIdx)=>{
    let rc = "";
    if(sub) rc = S.matrixSel[rIdx]===q.correct[rIdx] ? " matrix-row-right" : " matrix-row-wrong";
    h += '<tr class="'+rc+'"><td>'+row+"</td>";
    q.cols.forEach((_,cIdx)=>{
      const checked = S.matrixSel[rIdx]===cIdx;
      h += '<td><input type="radio" name="mrow'+rIdx+'" data-matrix-row="'+rIdx+'" data-matrix-col="'+cIdx+'"'+(checked?" checked":"")+(sub?" disabled":"")+"></td>";
    });
    h += "</tr>";
  });
  h += "</tbody></table>";
  const allAnswered = q.rows.every((_,rIdx)=>S.matrixSel[rIdx]!==undefined);
  if(!sub){
    h += '<div class="acts"><button data-submit-matrix="1"'+(!allAnswered?" disabled":"")+'>Submit answer</button></div>';
  } else {
    const correctCount = q.rows.filter((_,rIdx)=>S.matrixSel[rIdx]===q.correct[rIdx]).length;
    const ok = correctCount === q.rows.length;
    h += '<p class="verdict '+(ok?"y":"n")+'">'+correctCount+" of "+q.rows.length+" rows correct — "+S.lastPoints.toFixed(2)+" pt (partial credit)</p><p>"+q.why+"</p>";
  }
  return h+"</div>";
}

function bowtieHTML(q){
  const sub = S.submitted;
  let h = '<div class="q"><div class="sata-note">Bowtie — pick actions, the condition, and parameters</div><p class="stem">'+q.stem+"</p>";
  h += '<div class="bowtie-wrap">';
  h += '<div class="bowtie-col"><div class="bowtie-col-label">Actions to Take (choose '+q.correctActions.length+')</div>';
  q.actionOptions.forEach((opt,idx)=>{
    let c = "bowtie-opt";
    const sel = S.bowtie.actions.includes(idx);
    if(sub){ c += q.correctActions.includes(idx) ? " right" : (sel ? " wrong" : ""); }
    else if(sel) c += " sel";
    h += '<button class="'+c+'" data-bt-action="'+idx+'"'+(sub?" disabled":"")+'>'+opt+"</button>";
  });
  h += '</div><div class="bowtie-col"><div class="bowtie-col-label">Condition</div>';
  q.conditionOptions.forEach((opt,idx)=>{
    let c = "bowtie-opt";
    const sel = S.bowtie.condition===idx;
    if(sub){ c += idx===q.correctCondition ? " right" : (sel ? " wrong" : ""); }
    else if(sel) c += " sel";
    h += '<button class="'+c+'" data-bt-condition="'+idx+'"'+(sub?" disabled":"")+'>'+opt+"</button>";
  });
  h += '</div><div class="bowtie-col"><div class="bowtie-col-label">Parameters to Monitor (choose '+q.correctParams.length+')</div>';
  q.paramOptions.forEach((opt,idx)=>{
    let c = "bowtie-opt";
    const sel = S.bowtie.params.includes(idx);
    if(sub){ c += q.correctParams.includes(idx) ? " right" : (sel ? " wrong" : ""); }
    else if(sel) c += " sel";
    h += '<button class="'+c+'" data-bt-param="'+idx+'"'+(sub?" disabled":"")+'>'+opt+"</button>";
  });
  h += "</div></div>";
  const ready = S.bowtie.condition!==null && S.bowtie.actions.length && S.bowtie.params.length;
  if(!sub){
    h += '<div class="acts"><button data-submit-bowtie="1"'+(!ready?" disabled":"")+'>Submit answer</button></div>';
  } else {
    const totalSlots = 1 + q.correctActions.length + q.correctParams.length;
    const ok = S.lastPoints === 1;
    h += '<p class="verdict '+(ok?"y":"n")+'">'+Math.round(S.lastPoints*totalSlots)+" of "+totalSlots+" correct — "+S.lastPoints.toFixed(2)+" pt (partial credit)</p><p>"+q.why+"</p>";
  }
  return h+"</div>";
}

function anyQHTML(q, label){
  if(q.type === "sata") return sataHTML(q);
  if(q.type === "fitb") return fitbHTML(q);
  if(q.type === "gtpal") return gtpalHTML(q);
  if(q.type === "cloze") return clozeHTML(q);
  if(q.type === "hotspot") return hotspotHTML(q);
  if(q.type === "dragdrop") return dragdropHTML(q);
  if(q.type === "ordering") return orderingHTML(q);
  if(q.type === "matrix") return matrixHTML(q);
  if(q.type === "bowtie") return bowtieHTML(q);
  return qHTML(q, label);
}

const TOPIC_GROUPS = MODULE.topicGroups || [];

function unitSectionHTML(u, ui){
  const color = UNIT_COLORS[ui] || "#333";
  let h = '<section class="unit"><h2><span class="unit-chip" style="background:'+color+'"></span>'+u.title+"</h2>"+(u.sub?"<p>"+u.sub+"</p>":"");
  u.lessons.forEach(x=>{
    const hasQuiz = !!QUIZ[x.id];
    const b = S.best[x.id];
    h += '<button class="row" data-l="'+x.id+'"><span class="t">'+x.title+"</span>"+
      (hasQuiz && b!==undefined ? '<span class="s">'+fmtScore(b)+"/"+QUIZ[x.id].length+"</span>" : "")+
      (hasQuiz ? '<span class="qz" data-q="'+x.id+'">Quiz</span>' : "")+
      "</button>";
  });
  h += "</section>";
  return h;
}

function unitSectionCollapsibleHTML(u, ui){
  const isOpen = !!S.openUnits[ui];
  const color = UNIT_COLORS[ui] || "#333";
  let h = '<section class="topic-group'+(isOpen?" open":"")+'"><button class="topic-toggle" data-unittoggle="'+ui+'"><span class="topic-toggle-label">'+(u.noChip?'':'<span class="unit-chip" style="background:'+color+'"></span>')+u.title+'</span><span class="topic-toggle-icon">'+(isOpen?"−":"+")+'</span></button>';
  if(isOpen){
    h += '<div class="topic-body">';
    if(u.sub) h += "<p>"+u.sub+"</p>";
    u.lessons.forEach(x=>{
      const hasQuiz = !!QUIZ[x.id];
      const b = S.best[x.id];
      h += '<button class="row" data-l="'+x.id+'"><span class="t">'+x.title+"</span>"+
        (hasQuiz && b!==undefined ? '<span class="s">'+fmtScore(b)+"/"+QUIZ[x.id].length+"</span>" : "")+
        (hasQuiz ? '<span class="qz" data-q="'+x.id+'">Quiz</span>' : "")+
        "</button>";
    });
    h += '</div>';
  }
  h += '</section>';
  return h;
}

function home(){
  let h = '<p class="lede"><strong>How to use this:</strong> Each topic features a lesson ending with one review question. Many topics also include a standalone 5-question quiz (including select-all-that-apply items) — tap a title to read, or Quiz where available to jump straight to the questions. The colored dot next to each unit carries through to that unit\'s lessons and quizzes.</p>';

  const anyOpen = UNITS.some((u,ui)=> u.group ? S.openGroups[u.group] : S.openUnits[ui]);
  const allOpen = UNITS.every((u,ui)=> u.group ? S.openGroups[u.group] : S.openUnits[ui]);
  h += '<div class="xc-bar"><button type="button" class="xc-btn" data-expandall="1"'+(allOpen?' disabled':'')+'>Expand all</button><button type="button" class="xc-btn" data-collapseall="1"'+(anyOpen?'':' disabled')+'>Collapse all</button></div>';
  const doneGroups = {};
  UNITS.forEach((u,ui)=>{
    if(!u.group){ h += unitSectionCollapsibleHTML(u, ui); return; }
    if(doneGroups[u.group]) return;
    doneGroups[u.group] = true;
    const g = TOPIC_GROUPS.find(x=>x.key===u.group);
    const groupUnits = [];
    UNITS.forEach((uu,uj)=>{ if(uu.group === u.group) groupUnits.push({u:uu,ui:uj}); });
    const isOpen = !!S.openGroups[g.key];
    h += '<section class="topic-group'+(isOpen?" open":"")+'"><button class="topic-toggle" data-grouptoggle="'+g.key+'"><span class="topic-toggle-label">'+g.label+'</span><span class="topic-toggle-icon">'+(isOpen?"\u2212":"+")+'</span></button>';
    if(isOpen){
      h += '<div class="topic-body">';
      groupUnits.forEach(({u,ui}) => h += unitSectionHTML(u, ui));
      h += '</div>';
    }
    h += '</section>';
  });

  return h;
}

function lesson(){
  const x = L[S.id];
  const ui = unitIndexOf(S.id);
  let h = '<div class="unit-banner" style="background:'+UNIT_COLORS[ui]+'">'+UNITS[ui].title+"</div>";
  h += '<h3 class="title">'+x.title+"</h3>"+(x.kicker?'<p class="kick">'+x.kicker+"</p>":"");
  x.blocks.forEach(b => h += blk(b));
  const decks = x.id==="game-flash" ? [FLASH,"flash",d=>d.cards.length+" cards"] : x.id==="game-match" ? [MATCH,"match",d=>d.left+" ↔ "+d.right+" · "+d.pairs.length+" pairs"] : x.id==="game-rescue" ? [RESCUE,"rescue",d=>d.intro||""] : null;
  if(decks){
    const keys = Object.keys(decks[0]);
    h += keys.length ? '<div class="deck-list">'+keys.map(k=>'<button class="deck-btn" data-'+decks[1]+'="'+k+'"><strong>'+decks[0][k].title+'</strong><small>'+decks[2](decks[0][k])+'</small></button>').join("")+'</div>' : '<p><em>Coming soon.</em></p>';
  }
  const n = ORDER.indexOf(x.id);
  if(x.check){
    h += qHTML(x.check, "Check your understanding");
    h += '<div class="acts">';
    if(S.submitted) h += '<button data-q="'+x.id+'">Quiz me on this</button>';
    if(n > 0) h += '<button data-l="'+ORDER[n-1]+'">Previous: '+L[ORDER[n-1]].title+"</button>";
    if(n < ORDER.length-1) h += '<button data-l="'+ORDER[n+1]+'">Next: '+L[ORDER[n+1]].title+"</button>";
    h += '<button data-home="1">All topics</button></div>';
  } else {
    h += '<div class="acts">';
    if(QUIZ[x.id]) h += '<button data-q="'+x.id+'">'+(isExamId(x.id)?"Start the exam":isGame(x.id)?"Play":"Quiz")+'</button>';
    if(n > 0) h += '<button data-l="'+ORDER[n-1]+'">Previous: '+L[ORDER[n-1]].title+"</button>";
    if(n < ORDER.length-1) h += '<button data-l="'+ORDER[n+1]+'">Next: '+L[ORDER[n+1]].title+"</button>";
    h += '<button data-home="1">All topics</button></div>';
  }
  return h;
}

function fmtScore(n){ return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/,"").replace(/\.$/,""); }
function quiz(){
  const bank = curBank();
  const q = bank[S.i];
  const ui = unitIndexOf(S.id);
  let h = '<div class="unit-banner" style="background:'+UNIT_COLORS[ui]+'">'+UNITS[ui].title+"</div>";
  h += '<h3 class="title">'+L[S.id].title+'</h3>';
  if(isTimed(S.id)){
    const left = Math.max(0, Math.ceil((S.deadline - Date.now())/1000));
    h += '<div class="gm-bar"><span class="gm-timer'+(left<=10?" low":"")+'" id="gmTimer">'+left+'s</span><span>Answered '+S.i+' · correct '+fmtScore(S.score)+'</span><span>Streak '+(S.streak||0)+'</span></div><p class="count">Tap an answer — it locks in right away.</p>';
  } else {
    h += '<p class="count">Question '+(S.i+1)+" of "+bank.length+(isExamId(S.id) ? " · rationales appear at the end" : " · score "+fmtScore(S.score))+(isGame(S.id) ? " · streak "+(S.streak||0)+(S.bestStreak?" (best "+S.bestStreak+")":"") : "")+"</p>";
  }
  if(q.caseId) h += renderCaseTabs(q.caseId);
  h += anyQHTML(q, "");
  const answered = S.submitted;
  if(answered) h += '<div class="acts"><button data-next="1">'+(S.i<bank.length-1?"Next question":"See results")+"</button></div>";
  return h;
}

function result(){
  const bank = curBank();
  const exam = isEndReview(S.id), timed = isTimed(S.id);
  const n = timed ? (S.answered||0) : bank.length;
  const pct = n ? Math.round(S.score/n*100) : 0;
  let h = '<p class="count">'+L[S.id].title+'</p><p class="big">'+fmtScore(S.score)+"/"+n+(exam?' <span style="font-size:.5em">('+pct+'%)</span>':'')+"</p>";
  if(timed) h += '<p>'+fmtScore(S.score)+' correct out of '+n+' answered in '+TIMED[S.id]+' seconds'+(S.bestStreak?' · best streak '+S.bestStreak:'')+'.</p>';
  if(isGame(S.id) && !timed && S.bestStreak) h += '<p>Best streak this round: '+S.bestStreak+'</p>';
  const link = q => (q.ref && L[q.ref]) ? '<a class="reviewlink" href="#'+q.ref+'" target="_blank" rel="noopener">Review in: '+L[q.ref].title+" ↗</a>" : "";
  if(exam){
    const missed = bank.slice(0,n).filter((q,i)=>!(S.log[i] && S.log[i].pts>=1)).length;
    h += '<div class="rev"><p><strong>Answer key &amp; rationales</strong> — '+missed+' question'+(missed===1?'':'s')+' missed or partially correct. Links open the lesson in a new tab.</p>';
    bank.slice(0,n).forEach((q,i)=>{
      const r = S.log[i] || {pts:0, resp:"(no answer)"};
      const full = r.pts >= 1, partial = r.pts > 0 && r.pts < 1;
      const mark = full ? '<span style="color:#1e8449;font-weight:700">✓ Correct</span>' : partial ? '<span style="color:#d68910;font-weight:700">◐ Partial ('+fmtScore(r.pts)+' pt)</span>' : '<span style="color:#c0392b;font-weight:700">✗ Incorrect</span>';
      h += '<h5>'+(i+1)+'. '+q.stem+'</h5><p>'+mark+'</p>';
      if(!full) h += '<p><em>Your answer:</em> '+r.resp+'</p>';
      h += '<p><strong>'+correctTextOf(q)+'</strong></p><p>'+q.why+'</p>'+link(q);
    });
    h += "</div>";
  } else if(S.wrong.length){
    h += '<div class="rev"><p>Review these:</p>';
    S.wrong.forEach(i=>{ const q = bank[i];
      h += "<h5>"+q.stem+"</h5><p><strong>"+correctTextOf(q)+"</strong></p><p>"+q.why+"</p>"+link(q);
    });
    h += "</div>";
  } else h += "<p>All correct.</p>";
  h += '<div class="acts"><button data-q="'+S.id+'">Retake</button><button data-l="'+S.id+'">'+(isExamId(S.id)?"Back to exam overview":isGame(S.id)?"Back to the game page":"Reread the lesson")+'</button><button data-home="1">All topics</button></div>';
  return h;
}

function flashView(){
  const d = FLASH[S.deck], card = S.fq[0];
  let h = '<div class="unit-banner" style="background:'+UNIT_COLORS[unitIndexOf("game-flash")]+'">Games · Flashcards</div><h3 class="title">'+d.title+'</h3>';
  if(!card){
    h += '<p class="big">Deck complete</p><p>'+d.cards.length+' cards · '+S.fAgain+' review'+(S.fAgain===1?'':'s')+' needed along the way.</p>';
    return h+'<div class="acts"><button data-flash="'+S.deck+'">Shuffle and restart</button><button data-l="game-flash">All decks</button><button data-home="1">All topics</button></div>';
  }
  h += '<div class="gm-bar"><span>Got it: '+S.fDone+'</span><span>Left this round: '+S.fq.length+' of '+d.cards.length+'</span><span>Round '+(S.fRound||1)+'</span></div>';
  h += '<div class="flashcard'+(S.flip?' back':'')+'" data-fflip="1"><div><span class="side">'+(S.flip?'Back':'Front · tap to flip')+'</span>'+(S.flip?card.b:card.f)+'</div></div>';
  h += S.flip ? '<div class="acts"><button data-fgot="1">Got it</button><button data-fagain="1">Review again</button></div>' : '<div class="acts"><button data-fflip="1">Flip</button></div>';
  return h+'<div class="acts"><button data-l="game-flash">All decks</button></div>';
}
function matchRound(key){
  const d = MATCH[key], pairs = shuffled(d.pairs).slice(0,6);
  return {pairs, left:shuffled(pairs.map((p,i)=>i)), right:shuffled(pairs.map((p,i)=>i)), done:[], sel:null, bad:null, misses:0};
}
function matchView(){
  const d = MATCH[S.deck], m = S.m;
  let h = '<div class="unit-banner" style="background:'+UNIT_COLORS[unitIndexOf("game-match")]+'">Games · Matching Board</div><h3 class="title">'+d.title+'</h3>';
  h += '<div class="gm-bar"><span>Matched '+m.done.length+' of '+m.pairs.length+'</span><span>Misses '+m.misses+'</span><span>Round '+S.mRound+'</span></div>';
  if(m.done.length === m.pairs.length){
    h += '<p class="big">Board cleared</p><p>'+(m.misses===0?'Perfect — no misses.':m.misses+' miss'+(m.misses===1?'':'es')+'.')+'</p>';
    return h+'<div class="acts"><button data-mnext="1">New board</button><button data-l="game-match">All boards</button><button data-home="1">All topics</button></div>';
  }
  const card = (side,i)=>{ const done = m.done.includes(i), sel = m.sel && m.sel.side===side && m.sel.i===i, bad = m.bad && m.bad[side]===i;
    return '<button class="mcard'+(done?' done':sel?' sel':bad?' bad':'')+'" data-mside="'+side+'" data-mi="'+i+'"'+(done?' disabled':'')+'>'+m.pairs[i][side==="L"?0:1]+'</button>'; };
  h += '<p class="count">Tap an item on the left, then its match on the right.</p><div class="match-grid"><div class="match-col"><h6>'+d.left+'</h6>'+m.left.map(i=>card("L",i)).join("")+'</div><div class="match-col"><h6>'+d.right+'</h6>'+m.right.map(i=>card("R",i)).join("")+'</div></div>';
  return h+'<div class="acts"><button data-mnext="1">New board</button><button data-l="game-match">All boards</button></div>';
}
function rescueView(){
  const sc = RESCUE[S.deck], node = sc.nodes[S.node];
  let h = '<div class="unit-banner" style="background:'+UNIT_COLORS[unitIndexOf("game-rescue")]+'">Games · Rescue the Patient</div><h3 class="title">'+sc.title+'</h3>';
  if(S.rfb) h += '<div class="rs-fb '+(S.rfb.good===true?'good':S.rfb.good===false?'bad':'')+'"><strong>'+(S.rfb.good===true?'Good call. ':S.rfb.good===false?'Not the best choice. ':'')+'</strong>'+S.rfb.fb+'</div>';
  h += '<div class="rs-box">'+node.text+'</div>';
  if(node.end){
    const lbl = {good:"The client is stabilized.", ok:"The client survived — with complications.", bad:"The client deteriorated."}[node.end];
    h += '<p class="big" style="font-size:22px">'+lbl+'</p><p>Decisions: '+S.rGood+' strong · '+S.rBad+' weak.</p>';
    return h+'<div class="acts"><button data-rescue="'+S.deck+'">Play again</button><button data-l="game-rescue">All scenarios</button><button data-home="1">All topics</button></div>';
  }
  h += '<p class="count">What do you do?</p>'+node.choices.map((c,i)=>'<button class="opt" data-rchoice="'+i+'">'+c.t+'</button>').join("");
  return h+'<div class="acts"><button data-l="game-rescue">All scenarios</button></div>';
}

function draw(){
  if(S.view==="quiz" && S.submitted && isGame(S.id) && !S.streakDone){
    S.streakDone = true;
    const got = Math.round((S.score - (S.qStartScore||0))*100)/100;
    S.streak = got >= 1 ? (S.streak||0) + 1 : 0;
    S.bestStreak = Math.max(S.bestStreak||0, S.streak);
  }
  if(S.view==="quiz" && S.submitted && isEndReview(S.id)){
    const q = curBank()[S.i];
    S.log = S.log || [];
    S.log[S.i] = {pts: Math.round((S.score - (S.qStartScore||0))*100)/100, resp: userTextOf(q)};
    return goNext();
  }
  back.hidden = S.view === "home";
  app.innerHTML = S.view==="home"?home():S.view==="lesson"?lesson():S.view==="quiz"?quiz():S.view==="flash"?flashView():S.view==="match"?matchView():S.view==="rescue"?rescueView():result();
}

app.addEventListener("change", e=>{
  const sel = e.target.closest("select[data-cloze-blank]");
  if(sel && !S.submitted){
    S.clozeSel[+sel.dataset.clozeBlank] = sel.value===""?undefined:+sel.value;
    return draw();
  }
});

app.addEventListener("click", e=>{
  const q0 = e.target.closest("[data-q]");
  if(q0){
    e.stopPropagation();
    const qid = q0.dataset.q;
    nav("quiz",{id:qid, answered:undefined, i:0, score:0, wrong:[], shuffledBank:buildBank(qid), log:[], qStartScore:0, streak:0, streakDone:false, deadline: isTimed(qid) ? Date.now()+TIMED[qid]*1000 : 0});
    if(isTimed(qid)) startTimer();
    return;
  }
  const hw = e.target.closest(".hotspot-wrap");
  if(hw && !S.submitted && S.view==="quiz" && curBank() && curBank()[S.i] && curBank()[S.i].type==="hotspot"){
    const rect = hw.getBoundingClientRect();
    const x = Math.max(0,Math.min(100, ((e.clientX-rect.left)/rect.width)*100));
    const y = Math.max(0,Math.min(100, ((e.clientY-rect.top)/rect.height)*100));
    S.clickPoint = {x,y};
    return draw();
  }
  const mr = e.target.closest("input[type=radio][data-matrix-row]");
  if(mr && !S.submitted){
    S.matrixSel[+mr.dataset.matrixRow] = +mr.dataset.matrixCol;
    return draw();
  }
  const fc = e.target.closest(".flashcard");
  if(fc && S.view==="flash"){ S.flip = !S.flip; return draw(); }
  const t = e.target.closest("button");
  if(t && (t.dataset.expandall || t.dataset.collapseall)){ const on = !!t.dataset.expandall; UNITS.forEach((u,ui)=>{ if(u.group) S.openGroups[u.group] = on; else S.openUnits[ui] = on; }); return draw(); }
  if(t && t.dataset.grouptoggle){ S.openGroups[t.dataset.grouptoggle] = !S.openGroups[t.dataset.grouptoggle]; return draw(); }
  if(t && t.dataset.unittoggle){ S.openUnits[t.dataset.unittoggle] = !S.openUnits[t.dataset.unittoggle]; return draw(); }
  if(!t){
    const ddBinEl = e.target.closest(".dd-bin");
    if(ddBinEl && !S.submitted && S.ddSel !== null){
      S.ddPlace[S.ddSel] = +ddBinEl.dataset.ddBin;
      S.ddSel = null;
      return draw();
    }
    return;
  }
  if(t.dataset.flash) return nav("flash",{deck:t.dataset.flash, fq:shuffled(FLASH[t.dataset.flash].cards), flip:false, fDone:0, fAgain:0, fRound:1});
  if(t.dataset.fflip){ S.flip = !S.flip; return draw(); }
  if(t.dataset.fgot){ S.fq.shift(); S.fDone++; S.flip=false; if(!S.fq.length){ S.fq = shuffled(FLASH[S.deck].cards); S.fRound = (S.fRound||1)+1; } return draw(); }
  if(t.dataset.fagain){ S.fq.push(S.fq.shift()); S.fAgain++; S.flip=false; return draw(); }
  if(t.dataset.match) return nav("match",{deck:t.dataset.match, m:matchRound(t.dataset.match), mRound:1});
  if(t.dataset.mnext){ S.m = matchRound(S.deck); S.mRound++; return draw(); }
  if(t.dataset.mside){
    const m = S.m, side = t.dataset.mside, i = +t.dataset.mi;
    m.bad = null;
    if(!m.sel || m.sel.side === side){ m.sel = {side, i}; return draw(); }
    const li = side==="L" ? i : m.sel.i, ri = side==="R" ? i : m.sel.i;
    if(li === ri){ m.done.push(li); m.sel = null; }
    else { m.misses++; m.bad = {L:li, R:ri}; m.sel = null; }
    return draw();
  }
  if(t.dataset.rescue){ const sc = RESCUE[t.dataset.rescue]; return nav("rescue",{deck:t.dataset.rescue, node:sc.start, rfb:null, rGood:0, rBad:0}); }
  if(t.dataset.rchoice !== undefined){
    const c = RESCUE[S.deck].nodes[S.node].choices[+t.dataset.rchoice];
    if(c.good === true) S.rGood++; else if(c.good === false) S.rBad++;
    S.rfb = {fb:c.fb, good:c.good}; S.node = c.next;
    draw(); scrollTo(0,0); return;
  }
  if(t.dataset.l) return nav("lesson",{id:t.dataset.l});
  if(t.dataset.home) return nav("home");
  if(t.dataset.tab !== undefined){
    S.activeTab = +t.dataset.tab;
    return draw();
  }
  if(t.dataset.t !== undefined){
    if(S.submitted) return;
    const idx = +t.dataset.t, pos = S.multi.indexOf(idx);
    if(pos === -1) S.multi.push(idx); else S.multi.splice(pos,1);
    return draw();
  }
  if(t.dataset.submit !== undefined){
    S.submitted = true;
    const q = curBank()[S.i];
    const ok = S.multi.slice().sort((a,b)=>a-b).join(",") === q.answers.slice().sort((a,b)=>a-b).join(",");
    if(S.view === "quiz"){ if(ok) S.score++; else S.wrong.push(S.i); }
    return draw();
  }
  if(t.dataset.submitFitb !== undefined){
    const inputEl = document.getElementById("fitbInput");
    const val = inputEl ? inputEl.value.trim() : "";
    S.textAnswer = val;
    const q = curBank()[S.i];
    const userNum = parseFloat(val);
    const target = parseFloat(q.answer);
    const ok = !isNaN(userNum) && Math.abs(userNum - target) < 0.05;
    S.fitbCorrect = ok;
    S.submitted = true;
    if(S.view === "quiz"){ if(ok) S.score++; else S.wrong.push(S.i); }
    return draw();
  }
  if(t.dataset.submitGtpal !== undefined){
    const q = curBank()[S.i];
    const vals = [0,1,2,3,4].map(i=>{
      const el = document.getElementById("gtpalInput"+i);
      return el ? el.value.trim() : "";
    });
    S.gtpalVals = vals;
    const ok = vals.every((v,i)=> parseInt(v) === q.answers[i]);
    S.submitted = true;
    if(S.view === "quiz"){ if(ok) S.score++; else S.wrong.push(S.i); }
    return draw();
  }
  if(t.dataset.submitCloze !== undefined){
    const q = curBank()[S.i];
    const correctCount = q.blanks.filter((b,i)=>S.clozeSel[i]===b.correct).length;
    const pts = Math.round((correctCount/q.blanks.length)*100)/100;
    S.submitted = true;
    S.lastPoints = pts;
    if(S.view === "quiz"){ S.score += pts; if(pts < 1) S.wrong.push(S.i); }
    return draw();
  }
  if(t.dataset.submitHotspot !== undefined){
    const q = curBank()[S.i];
    const pt = S.clickPoint, r = q.region;
    const ok = !!pt && pt.x>=r.x && pt.x<=r.x+r.w && pt.y>=r.y && pt.y<=r.y+r.h;
    const pts = ok ? 1 : 0;
    S.hotspotCorrect = ok;
    S.submitted = true;
    S.lastPoints = pts;
    if(S.view === "quiz"){ S.score += pts; if(pts < 1) S.wrong.push(S.i); }
    return draw();
  }
  if(t.dataset.ddPick !== undefined){
    S.ddSel = S.ddSel === +t.dataset.ddPick ? null : +t.dataset.ddPick;
    return draw();
  }
  if(t.dataset.ddUnplace !== undefined){
    if(S.submitted) return;
    delete S.ddPlace[+t.dataset.ddUnplace];
    return draw();
  }
  if(t.dataset.submitDd !== undefined){
    const q = curBank()[S.i];
    const correctCount = q.items.filter((_,idx)=>S.ddPlace[idx]===q.correctBin[idx]).length;
    const pts = Math.round((correctCount/q.items.length)*100)/100;
    S.submitted = true;
    S.lastPoints = pts;
    if(S.view === "quiz"){ S.score += pts; if(pts < 1) S.wrong.push(S.i); }
    return draw();
  }
  if(t.dataset.orderUp !== undefined){
    const pos = +t.dataset.orderUp;
    if(pos>0){ [S.orderArr[pos-1],S.orderArr[pos]] = [S.orderArr[pos],S.orderArr[pos-1]]; }
    return draw();
  }
  if(t.dataset.orderDown !== undefined){
    const pos = +t.dataset.orderDown;
    if(pos<S.orderArr.length-1){ [S.orderArr[pos+1],S.orderArr[pos]] = [S.orderArr[pos],S.orderArr[pos+1]]; }
    return draw();
  }
  if(t.dataset.submitOrder !== undefined){
    const correctCount = S.orderArr.filter((itemIdx,pos)=>itemIdx===pos).length;
    const pts = Math.round((correctCount/S.orderArr.length)*100)/100;
    S.submitted = true;
    S.lastPoints = pts;
    if(S.view === "quiz"){ S.score += pts; if(pts < 1) S.wrong.push(S.i); }
    return draw();
  }
  if(t.dataset.submitMatrix !== undefined){
    const q = curBank()[S.i];
    const correctCount = q.rows.filter((_,rIdx)=>S.matrixSel[rIdx]===q.correct[rIdx]).length;
    const pts = Math.round((correctCount/q.rows.length)*100)/100;
    S.submitted = true;
    S.lastPoints = pts;
    if(S.view === "quiz"){ S.score += pts; if(pts < 1) S.wrong.push(S.i); }
    return draw();
  }
  if(t.dataset.btAction !== undefined){
    if(S.submitted) return;
    const q = curBank()[S.i];
    const idx = +t.dataset.btAction, pos = S.bowtie.actions.indexOf(idx);
    if(pos===-1){ if(S.bowtie.actions.length < q.correctActions.length) S.bowtie.actions.push(idx); }
    else S.bowtie.actions.splice(pos,1);
    return draw();
  }
  if(t.dataset.btCondition !== undefined){
    if(S.submitted) return;
    S.bowtie.condition = +t.dataset.btCondition;
    return draw();
  }
  if(t.dataset.btParam !== undefined){
    if(S.submitted) return;
    const q = curBank()[S.i];
    const idx = +t.dataset.btParam, pos = S.bowtie.params.indexOf(idx);
    if(pos===-1){ if(S.bowtie.params.length < q.correctParams.length) S.bowtie.params.push(idx); }
    else S.bowtie.params.splice(pos,1);
    return draw();
  }
  if(t.dataset.submitBowtie !== undefined){
    const q = curBank()[S.i];
    const totalSlots = 1 + q.correctActions.length + q.correctParams.length;
    const conditionPts = S.bowtie.condition===q.correctCondition ? 1 : 0;
    const actionsPts = S.bowtie.actions.filter(a=>q.correctActions.includes(a)).length;
    const paramsPts = S.bowtie.params.filter(a=>q.correctParams.includes(a)).length;
    const pts = Math.round(((conditionPts+actionsPts+paramsPts)/totalSlots)*100)/100;
    S.submitted = true;
    S.lastPoints = pts;
    if(S.view === "quiz"){ S.score += pts; if(pts < 1) S.wrong.push(S.i); }
    return draw();
  }
  if(t.dataset.p !== undefined){
    if(S.submitted) return;
    S.pick = +t.dataset.p;
    if(S.view==="quiz" && isTimed(S.id)){
      S.submitted = true;
      if(S.pick === curBank()[S.i].answer) S.score++; else S.wrong.push(S.i);
    }
    return draw();
  }
  if(t.dataset.submitMc !== undefined){
    if(S.pick === null) return;
    S.submitted = true;
    if(S.view === "quiz"){
      if(S.pick === curBank()[S.i].answer) S.score++; else S.wrong.push(S.i);
    }
    return draw();
  }
  if(t.dataset.next) return goNext();
});

const initialHash = location.hash.slice(1);
if(initialHash && L[initialHash]){
  nav("lesson", {id: initialHash});
} else {
  draw();
}

/* ---- tap-to-zoom figures ---- */
document.body.insertAdjacentHTML('beforeend', '<div id="zoomov" role="dialog" aria-label="Enlarged image"><div class="zbar"><span class="zhint">Drag to look around · tap the dark area to close</span><button type="button" class="zx" aria-label="Close enlarged image">✕ Close</button></div><img alt=""></div>');
(function(){var ov=document.getElementById('zoomov'),im=ov.querySelector('img');
document.addEventListener('click',function(e){var t=e.target;if(t.tagName==='IMG'&&t.closest&&t.closest('.figure')){im.src=t.src;ov.style.display='block';ov.scrollTop=0;ov.scrollLeft=0;e.preventDefault();return;}if(ov.style.display==='block'&&(t===ov||(t.closest&&t.closest('.zx')))){ov.style.display='none';}},true);document.addEventListener('keydown',function(e){if(e.key==='Escape'&&ov.style.display==='block')ov.style.display='none';});})();

/* ---- offline helper ---- */
if("serviceWorker" in navigator){window.addEventListener("load",function(){navigator.serviceWorker.register("sw.js").catch(function(){});});}
