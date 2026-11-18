/* ===== Shared engine extras =====
   Search · saved progress · Review My Misses · long-lesson navigation · move progress between devices.
   Loaded after the main engine script; wraps draw/lesson/blk/buildBank (all global function bindings).

   Saved-progress schema (one localStorage key per module, read by a future "Final" page):
     key  "nur114-m4:progress"
     {v:1, module:4,
      best:{quizId: score},            // best score per quiz (same numbers the menu shows, out of QUIZ[quizId].length)
      attempts:{quizId: timestampMs},  // last finished attempt per quiz
      read:[lessonId, ...],            // lessons marked read
      last:"lessonId",                 // last lesson opened ("" if none)
      misses:{"quizId#origIndex": {n:0, t:timestampMs, h:"stemHash"}}}
                                       // question = QUIZ[quizId][origIndex]; n = correct answers in review (cleared at 2);
                                       // h = optional fingerprint used to re-find the question if a rebuild reorders it

   Display settings live in a SEPARATE key (device preferences, never exported/imported, kept by "Reset my progress"):
     key  "nur114-m4:settings"
     {v:1,
      examOnly:true|false,             // home menu "★ Exam focus only" filter
      fs:0.9|1|1.1|1.2|1.3,            // text size (CSS zoom on #app via --fz)
      theme:"dark"|"light"}            // absent = follow the device's prefers-color-scheme
   early.js (injected in <head>) applies theme + size before first paint; this file owns the rest.

   Need-to-know badges: one table (BADGE_UNITS + BADGES below); section chips are added at render time in blk().
*/
(function(){
"use strict";
var MOD = +MODULE.num, NS = "nur114-m" + MOD + ":", PKEY = NS + "progress", MISS_ID = "game-misses", CLEAR_AT = 2;
var hasOwn = function(o,k){ return Object.prototype.hasOwnProperty.call(o,k); };

/* ---------- storage (every access guarded: private mode / blocked storage must never break the app) ---------- */
function storeOK(){ try{ var k = NS + "__t"; localStorage.setItem(k, "1"); localStorage.removeItem(k); return true; }catch(e){ return false; } }
var STORE_OK = storeOK();
function readRaw(){ try{ var v = localStorage.getItem(PKEY); return v ? JSON.parse(v) : null; }catch(e){ return null; } }
function writeRaw(o){ try{ localStorage.setItem(PKEY, JSON.stringify(o)); return true; }catch(e){ return false; } }
var SKEY = NS + "settings";   // display preferences survive a progress reset
function clearAll(){ try{ var ks = []; for(var i = 0; i < localStorage.length; i++){ var k = localStorage.key(i); if(k && k.indexOf(NS) === 0 && k !== SKEY) ks.push(k); } ks.forEach(function(k){ localStorage.removeItem(k); }); }catch(e){} }

/* ---------- question identity: "quizId#origIndex" on the original QUIZ objects (copies inherit it) ---------- */
function fnv(s){ var h = 0x811c9dc5; for(var i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); }
function qsig(q){ var o = q.options || q.items || q.rows || q.blanks || q.actionOptions || ""; return fnv((q.type||"mc") + "|" + (q.stem || q.template || "") + "|" + JSON.stringify(o)); }
var SRC = {};   // "k#i" -> {k, i, q, h}
Object.keys(QUIZ).forEach(function(k){
  if(k === MISS_ID || !Array.isArray(QUIZ[k])) return;
  QUIZ[k].forEach(function(q, i){
    if(!q || typeof q !== "object") return;
    var id = k + "#" + i;
    SRC[id] = {k:k, i:i, q:q, h:null};
    if(!q._src) q._src = id;          // first quiz that owns the object wins
  });
});
function hashOf(id){ var s = SRC[id]; if(!s) return null; if(s.h === null) s.h = qsig(s.q); return s.h; }
function resolveMissKey(key, h){      // validate a stored key; relocate by fingerprint if the quiz was reordered
  if(SRC[key] && (!h || hashOf(key) === h)) return SRC[key].q._src || key;
  var k = String(key).split("#")[0];
  if(h && Array.isArray(QUIZ[k])) for(var i = 0; i < QUIZ[k].length; i++){ if(hashOf(k + "#" + i) === h) return SRC[k + "#" + i].q._src || (k + "#" + i); }
  return null;
}

/* ---------- progress state (in memory first; storage only mirrors it) ---------- */
function blank(){ return {v:1, module:MOD, best:{}, attempts:{}, read:[], last:"", misses:{}}; }
function num(x){ return typeof x === "number" && isFinite(x); }
function sanitize(o, strict){
  var p = blank();
  if(!o || typeof o !== "object" || Array.isArray(o)) return strict ? null : p;
  if(strict && (o.v !== 1 || +o.module !== MOD)) return null;
  var b = o.best && typeof o.best === "object" ? o.best : {};
  Object.keys(b).forEach(function(k){ if(k !== MISS_ID && Array.isArray(QUIZ[k]) && num(b[k]) && b[k] >= 0) p.best[k] = Math.min(b[k], QUIZ[k].length); });
  var a = o.attempts && typeof o.attempts === "object" ? o.attempts : {};
  Object.keys(a).forEach(function(k){ if(L[k] && num(a[k])) p.attempts[k] = a[k]; });
  (Array.isArray(o.read) ? o.read : []).forEach(function(id){ if(typeof id === "string" && L[id] && p.read.indexOf(id) < 0) p.read.push(id); });
  if(typeof o.last === "string" && L[o.last] && o.last !== MISS_ID) p.last = o.last;
  var m = o.misses && typeof o.misses === "object" ? o.misses : {};
  Object.keys(m).forEach(function(k){
    var e = m[k] || {}, key = resolveMissKey(k, typeof e.h === "string" ? e.h : null);
    if(!key) return;
    var n = num(e.n) ? Math.max(0, Math.floor(e.n)) : 0, t = num(e.t) ? e.t : Date.now();
    if(n >= CLEAR_AT) return;
    if(p.misses[key]){ p.misses[key].n = Math.min(p.misses[key].n, n); p.misses[key].t = Math.max(p.misses[key].t, t); }
    else p.misses[key] = {n:n, t:t, h:hashOf(key)};
  });
  return p;
}
var PG = sanitize(readRaw(), false);
function save(){ writeRaw(PG); }
function isRead(id){ return PG.read.indexOf(id) >= 0; }
function markRead(id){ if(!L[id] || id === MISS_ID || isRead(id)) return; PG.read.push(id); save(); }
function applyBest(){ Object.keys(S.best).forEach(function(k){ delete S.best[k]; }); Object.keys(PG.best).forEach(function(k){ S.best[k] = PG.best[k]; }); }
applyBest();

/* ---------- Review My Misses: a real lesson + dynamic quiz bank in the Games unit ---------- */
var GU = (typeof GAMES !== "undefined" && GAMES) || UNITS.filter(function(u){ return /games/i.test(u.title); })[0] || UNITS[UNITS.length-1];
var ML = { id:MISS_ID, title:"Review My Misses", kicker:"Every question you have missed, in one place — get each one right twice to clear it",
  blocks:[ {p:"Any question you answer wrong (or only partly right) in a lesson quiz, game, drill, Daily Five, or practice exam is saved here on this device. Play them back with feedback after each one. A question leaves the list after you answer it correctly <strong>twice</strong> here."} ] };
(function(){
  var gi = GU.lessons.findIndex(function(x){ return x.id === "game-daily"; });
  GU.lessons.splice(gi >= 0 ? gi + 1 : 0, 0, ML);
  L[MISS_ID] = ML;
  var oi = ORDER.indexOf("game-daily");
  if(oi < 0){ var lastGame = GU.lessons[GU.lessons.length-1]; oi = ORDER.indexOf(lastGame.id); }
  ORDER.splice(oi >= 0 ? oi + 1 : ORDER.length, 0, MISS_ID);
})();
function missKeys(){ return Object.keys(PG.misses).filter(function(k){ return SRC[k]; }); }
function syncMiss(){
  var ks = missKeys();
  if(ks.length){
    QUIZ[MISS_ID] = ks.map(function(id){
      var s = SRC[id], q = Object.assign({}, s.q);
      q._src = id;
      if(!q.ref && L[s.k] && !isGame(s.k) && !isExamId(s.k)) q.ref = s.k;
      return q;
    });
  } else delete QUIZ[MISS_ID];
  ML.title = "Review My Misses (" + ks.length + ")";
}
syncMiss();
var _buildBank = buildBank;
buildBank = function(id){
  if(id === MISS_ID){ syncMiss(); return QUIZ[MISS_ID] ? shuffled(QUIZ[MISS_ID]).map(shuffleOpts) : []; }
  return _buildBank.apply(this, arguments);
};
var logTok = {bank:null, i:-1};
function logAnswer(){
  if(S.view !== "quiz" || !S.submitted) return;
  var bank = curBank(); if(!bank) return;
  if(logTok.bank === bank && logTok.i === S.i) return;
  logTok.bank = bank; logTok.i = S.i;
  var q = bank[S.i]; if(!q || !q._src || !SRC[q._src]) return;
  var pts = Math.round((S.score - (S.qStartScore || 0)) * 100) / 100, ok = pts >= 0.999, id = q._src;
  if(S.id === MISS_ID){
    var m = PG.misses[id];
    if(m && ok){ m.n = (m.n || 0) + 1; if(m.n >= CLEAR_AT) delete PG.misses[id]; }
  } else if(!ok){
    if(PG.misses[id]) PG.misses[id].t = Date.now();
    else PG.misses[id] = {n:0, t:Date.now(), h:hashOf(id)};
  } else return;
  save(); syncMiss();
}

/* ---------- display settings (separate key; see header) ---------- */
var FZ = [0.9, 1, 1.1, 1.2, 1.3];
function readSet(){ try{ var v = localStorage.getItem(SKEY), o = v ? JSON.parse(v) : null; return o && typeof o === "object" && !Array.isArray(o) ? o : {}; }catch(e){ return {}; } }
var SET = readSet();
if(FZ.indexOf(+SET.fs) < 0) SET.fs = 1;
if(SET.theme !== "dark" && SET.theme !== "light") delete SET.theme;
SET.examOnly = SET.examOnly === true;
function saveSet(){ try{ localStorage.setItem(SKEY, JSON.stringify({v:1, examOnly:SET.examOnly, fs:SET.fs, theme:SET.theme})); }catch(e){} }
var MQ = null; try{ MQ = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null; }catch(e){}
function curTheme(){ return SET.theme || (MQ && MQ.matches ? "dark" : "light"); }
var ROOT = document.documentElement;
function applyTheme(){
  var t = curTheme(); ROOT.setAttribute("data-theme", t);
  var b = document.getElementById("bx-theme");
  if(b){ b.textContent = t === "dark" ? "☀️" : "🌙"; b.setAttribute("aria-label", t === "dark" ? "Switch to light mode" : "Switch to dark mode"); b.setAttribute("aria-pressed", t === "dark" ? "true" : "false"); b.title = b.getAttribute("aria-label"); }
}
if(MQ){ var mqh = function(){ if(!SET.theme) applyTheme(); }; try{ if(MQ.addEventListener) MQ.addEventListener("change", mqh); else if(MQ.addListener) MQ.addListener(mqh); }catch(e){} }
function applyFz(){
  ROOT.style.setProperty("--fz", String(SET.fs)); ROOT.setAttribute("data-fz", String(SET.fs));
  var i = FZ.indexOf(SET.fs), dn = document.getElementById("bx-fdn"), up = document.getElementById("bx-fup"), pc = Math.round(SET.fs * 100) + "%";
  if(dn){ dn.disabled = i <= 0; dn.setAttribute("aria-label", "Smaller text (now " + pc + ")"); dn.title = dn.getAttribute("aria-label"); }
  if(up){ up.disabled = i >= FZ.length - 1; up.setAttribute("aria-label", "Larger text (now " + pc + ")"); up.title = up.getAttribute("aria-label"); }
}
var toastT = null;
function toast(msg){
  var t = document.getElementById("bx-toast");
  if(!t){ t = document.createElement("div"); t.id = "bx-toast"; t.setAttribute("role", "status"); t.setAttribute("aria-live", "polite"); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(function(){ t.classList.remove("show"); }, 1300);
}
function stepFz(dir){
  var i = FZ.indexOf(SET.fs), j = Math.max(0, Math.min(FZ.length - 1, i + dir));
  if(j === i) return;
  // keep the reader's place: remember the first block on screen and put it back at the same height
  var anc = null, off = 0, els = app.querySelectorAll("[data-bi], .q, .row, h3.title");
  for(var k = 0; k < els.length; k++){ var r = els[k].getBoundingClientRect(); if(r.bottom > 60){ anc = els[k]; off = r.top; break; } }
  SET.fs = FZ[j]; saveSet(); applyFz();
  if(anc && window.pageYOffset > 0){ var d = anc.getBoundingClientRect().top - off; if(Math.abs(d) > 1) window.scrollTo(0, Math.max(0, window.pageYOffset + d)); }
  toast("Text size " + Math.round(SET.fs * 100) + "%");
}
(function(){   // header buttons: A− A+ 🌙/☀️ (next to 🔍)
  var hb = document.querySelector("header .hdr-btns"); if(!hb) return;
  var g = document.createElement("div"); g.className = "hx-disp"; g.setAttribute("role", "group"); g.setAttribute("aria-label", "Reading comfort");
  g.innerHTML = '<button type="button" class="hx-hb" id="bx-fdn">A−</button><button type="button" class="hx-hb" id="bx-fup">A+</button><button type="button" class="hx-hb" id="bx-theme"></button>';
  var sb = document.getElementById("hx-sbtn");
  if(sb && sb.parentNode === hb) hb.insertBefore(g, sb.nextSibling); else hb.insertBefore(g, hb.firstChild);
  g.addEventListener("click", function(e){
    var b = e.target.closest ? e.target.closest("button") : null; if(!b || b.disabled) return;
    if(b.id === "bx-fdn") stepFz(-1);
    else if(b.id === "bx-fup") stepFz(1);
    else if(b.id === "bx-theme"){ SET.theme = curTheme() === "dark" ? "light" : "dark"; saveSet(); applyTheme(); toast(SET.theme === "dark" ? "Dark mode" : "Light mode"); }
  });
})();
applyTheme(); applyFz();

/* ---------- need-to-know badges: the ONE mapping (unit defaults + per-lesson overrides) ---------- */
var BADGE_DEF = {
  ex:   {t:"★ Exam focus",           d:(MODULE.examName ? "on the " + MODULE.examName : "on the Module " + MOD + " exam")},
  p211: {t:"211 preview",                 d:"next semester, not on this exam"},
  rev:  {t:"Review",                      d:"earlier-course review"},
  prac: {t:"Practice",                    d:"worksheets, games & drills"},
  sky:  {t:"Classmate notes",             d:"Sky's study notes"},
  ref:  {t:"Reference — not tested", d:""}          // section-level only
};
function U(v){ return v && v.lessons ? v : null; }   // units are top-level consts in the main script
var BADGE_UNITS = (MODULE.badgeUnits || []).map(function(p){ return [U(p[0]), p[1]]; });
var BADGES = MODULE.badges || {};
function badgesOf(id){
  if(hasOwn(BADGES, id)) return BADGES[id];
  for(var i = 0; i < BADGE_UNITS.length; i++){ var u = BADGE_UNITS[i][0]; if(u && u.lessons.some(function(x){ return x.id === id; })) return BADGE_UNITS[i][1]; }
  return [];
}
function isExamFocus(id){ return badgesOf(id).indexOf("ex") >= 0; }
function chip(k, sec){ return '<span class="bx-chip bx-' + k + (sec ? ' bx-sec' : '') + '">' + BADGE_DEF[k].t + '</span>'; }
function chipsHTML(id){ return badgesOf(id).map(function(k){ return chip(k); }).join(""); }
// section-level chips, decided from the block's own text at render time (content files untouched)
var RE211 = /\bNUR\s?211\b|\b211 content\b|\blikely (?:NUR )?211\b|\bin 211\b/i;
var RENT = /\bnot tested\b|\bjoules? (?:are |is )?not needed\b/i;
var HAS_BADGES = BADGE_UNITS.length > 0 || Object.keys(BADGES).length > 0;   // modules without badges get no automatic section chips
function secKinds(t, row){
  if(!HAS_BADGES) return [];
  var k = [];
  if(!row && RE211.test(t)) k.push("p211");
  if(RENT.test(t) || (row ? /joule/i.test(t) : (/joule|energy setting/i.test(t) && /reference/i.test(t)))) k.push("ref");
  return k;
}
function secChips(t, row){ return secKinds(t, row).map(function(k){ return chip(k, true); }).join(""); }
function addSecChips(b, out){
  if(!out) return out;
  if(b.h){ var c = secChips(plain(b.h)); return c ? out.replace(/<\/h4>$/, " " + c + "</h4>") : out; }
  if(b.p){ var c2 = secChips(plain(b.p)); return c2 ? out.replace(/<\/p>$/, " " + c2 + "</p>") : out; }
  if(b.hook){ var c3 = secChips(plain(b.hook)); return c3 ? out.replace(/<\/div>$/, " " + c3 + "</div>") : out; }
  if(b.list) return out.replace(/<li>([\s\S]*?)<\/li>/g, function(m, inner){ var c4 = secChips(plain(inner)); return c4 ? "<li>" + inner + " " + c4 + "</li>" : m; });
  if(b.table) return out.replace(/<tr>([\s\S]*?)<\/tr>/g, function(m, inner){
    if(inner.indexOf("<td") < 0) return m;
    var c5 = secChips(plain(inner), true);
    return c5 ? "<tr>" + inner.replace("</td>", " " + c5 + "</td>") + "</tr>" : m;
  });
  return out;
}

/* ---------- block indexing: every lesson block gets data-bi="<index>" (+ section chips) ---------- */
var BI = -1, _blk = blk, _lesson = lesson;
blk = function(b){
  var out = _blk.apply(this, arguments);
  try{ if(b && typeof b === "object") out = addSecChips(b, out); }catch(e){}
  if(BI >= 0){ var n = BI++; if(out) out = out.replace(/^<([a-zA-Z0-9]+)/, '<$1 data-bi="' + n + '"'); }
  return out;
};
lesson = function(){ BI = 0; try{ return _lesson.apply(this, arguments); } finally { BI = -1; } };

/* ---------- search ---------- */
var TA = document.createElement("textarea");
function plain(html){
  TA.innerHTML = String(html == null ? "" : html).replace(/<br\s*\/?>/gi, " ").replace(/<\/(p|li|td|th|div|h\d)>/gi, " ").replace(/<[^>]*>/g, " ");
  return TA.value.replace(/\s+/g, " ").trim();
}
function escH(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function escR(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function blockInfo(b){
  if(b.h) return ["Heading", plain(b.h)];
  if(b.p) return ["", plain(b.p)];
  if(b.list) return ["List", b.list.map(plain).join(" · ")];
  if(b.hook) return ["Tip", plain(b.hook)];
  if(b.table) return ["Table", [b.table.head.map(plain).join(" · ")].concat(b.table.rows.map(function(r){ return r.map(plain).join(" · "); })).join(" | ")];
  if(b.img) return ["Figure", plain(b.caption || "")];
  return null;
}
var IDX = null;
function skyUnit(ui){ return (typeof SKY_NOTES !== "undefined" && UNITS[ui] === SKY_NOTES) || /sky/i.test(UNITS[ui].title); }
function buildIndex(){
  IDX = ORDER.map(function(id, oi){
    var x = L[id], ui = unitIndexOf(id), title = plain(x.title), kick = plain(x.kicker || "");
    var ents = [{bi:-1, kind:"Lesson", text:title + (kick ? " — " + kick : "")}];
    (x.blocks || []).forEach(function(b, bi){ var r = blockInfo(b); if(r && r[1]) ents.push({bi:bi, kind:r[0], text:r[1]}); });
    ents.forEach(function(e){ e.low = e.text.toLowerCase(); });
    return {id:id, oi:oi, ui:ui, title:title, tlow:title.toLowerCase(), sky:skyUnit(ui), unit:plain(UNITS[ui].title), ents:ents};
  });
}
function hl(s, words){
  var re = new RegExp("(" + words.slice().sort(function(a,b){ return b.length - a.length; }).map(escR).join("|") + ")", "gi");
  var out = "", last = 0, m;
  while((m = re.exec(s))){ out += escH(s.slice(last, m.index)) + "<mark>" + escH(m[0]) + "</mark>"; last = m.index + m[0].length; if(!m[0].length) re.lastIndex++; }
  return out + escH(s.slice(last));
}
function snippet(text, words){
  var low = text.toLowerCase(), pos = -1;
  words.forEach(function(w){ var p = low.indexOf(w); if(p >= 0 && (pos < 0 || p < pos)) pos = p; });
  if(pos < 0) pos = 0;
  var start = Math.max(0, pos - 45), end = Math.min(text.length, pos + 115);
  if(start > 0){ var sp = text.indexOf(" ", start); if(sp >= 0 && sp < pos) start = sp + 1; }
  if(end < text.length){ var sp2 = text.lastIndexOf(" ", end); if(sp2 > pos) end = sp2; }
  return (start > 0 ? "… " : "") + hl(text.slice(start, end), words) + (end < text.length ? " …" : "");
}
var CAP = 50, PER = 4;
function runSearch(q){
  var words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if(!words.length || q.trim().length < 2) return null;
  if(!IDX) buildIndex();
  var groups = [], total = 0;
  IDX.forEach(function(L0){
    var hits = L0.ents.filter(function(e){
      var any = false;
      for(var j = 0; j < words.length; j++){ var w = words[j], inE = e.low.indexOf(w) >= 0; if(inE) any = true; else if(L0.tlow.indexOf(w) < 0) return false; }
      return any;
    });
    if(hits.length){ total += hits.length; groups.push({L:L0, hits:hits, score:(hits[0].bi === -1 ? 1000 : 0) + hits.length}); }
  });
  groups.sort(function(a,b){ return (b.score - a.score) || (a.L.oi - b.L.oi); });
  return {words:words, groups:groups, total:total};
}
function resultsHTML(q){
  var r = runSearch(q);
  if(!r) return "";
  if(!r.groups.length) return '<div class="hx-empty">No matches for <strong>' + escH(q.trim()) + '</strong>. Try fewer or shorter words.</div>';
  var shown = 0, h = '<div class="hx-meta">' + r.total + ' match' + (r.total === 1 ? "" : "es") + ' in ' + r.groups.length + ' lesson' + (r.groups.length === 1 ? "" : "s") + (r.total > CAP ? ' · showing the top ' + CAP : '') + '</div>';
  for(var g = 0; g < r.groups.length && shown < CAP; g++){
    var G = r.groups[g], first = G.hits[0];
    h += '<div class="hx-grp" data-hx-grp="' + G.L.id + '"><button class="hx-gh" data-hx-open="' + G.L.id + '" data-hx-bi="' + (first.bi === -1 ? -1 : first.bi) + '"><span class="hx-gt"><span class="unit-chip" style="background:' + (UNIT_COLORS[G.L.ui] || "#333") + '"></span>' + escH(G.L.title) + '</span><span class="hx-gu' + (G.L.sky ? ' sky' : '') + '">' + escH(G.L.sky ? "Sky's Notes" : G.L.unit) + '</span>' + (badgesOf(G.L.id).length ? '<span class="bx-chips">' + chipsHTML(G.L.id) + '</span>' : '') + '</button>';
    var hits = G.hits.filter(function(e){ return e.bi >= 0; }), lim = Math.min(hits.length, PER, CAP - shown);
    if(!hits.length) shown++;
    for(var i = 0; i < lim; i++){
      var e = hits[i];
      h += '<button class="hx-hit" data-hx-open="' + G.L.id + '" data-hx-bi="' + e.bi + '">' + (e.kind ? '<span class="hx-kind">' + e.kind + '</span>' : '') + snippet(e.text, r.words) + '</button>';
      shown++;
    }
    if(hits.length > lim) h += '<div class="hx-more">+' + (hits.length - lim) + ' more in this lesson</div>';
    h += '</div>';
  }
  return h;
}
var SQ = "", sTimer = null;
function renderResults(){ var box = document.getElementById("hx-res"); if(box) box.innerHTML = resultsHTML(SQ); var c = document.getElementById("hx-clr"); if(c) c.hidden = !SQ; }
document.addEventListener("input", function(e){
  if(!e.target || e.target.id !== "hx-q") return;
  SQ = e.target.value;
  var c = document.getElementById("hx-clr"); if(c) c.hidden = !SQ;
  clearTimeout(sTimer); sTimer = setTimeout(renderResults, 200);
});
document.addEventListener("keydown", function(e){ if(e.target && e.target.id === "hx-q" && e.key === "Enter"){ clearTimeout(sTimer); SQ = e.target.value; renderResults(); e.target.blur(); } });
function scrollToEl(el, smooth){
  var y = Math.max(0, el.getBoundingClientRect().top + window.pageYOffset - 16);
  try{ window.scrollTo({top:y, behavior:smooth ? "smooth" : "auto"}); }catch(err){ window.scrollTo(0, y); }
}
function goToBlock(bi){
  var el = app.querySelector('[data-bi="' + bi + '"]'); if(!el) return;
  scrollToEl(el, false);
  el.classList.remove("hx-flash"); void el.offsetWidth; el.classList.add("hx-flash");
  setTimeout(function(){ el.classList.remove("hx-flash"); }, 2600);
  var y0 = window.pageYOffset;
  setTimeout(function(){ if(Math.abs(window.pageYOffset - y0) < 2 && document.body.contains(el) && Math.abs(el.getBoundingClientRect().top - 16) > 40) scrollToEl(el, false); }, 500);
}

/* ---------- export / import / merge ---------- */
function b64enc(s){ return btoa(unescape(encodeURIComponent(s))); }
function b64dec(s){ return decodeURIComponent(escape(atob(s))); }
function exportObj(){ var o = JSON.parse(JSON.stringify(PG)); o.exported = Date.now(); return o; }
function parseCode(txt){
  txt = String(txt || "").trim();
  if(!txt) return {err:"Paste a progress code (or choose a backup file) first."};
  var o = null;
  try{ o = JSON.parse(txt.charAt(0) === "{" ? txt : b64dec(txt.replace(/\s+/g, ""))); }catch(e){ return {err:"That doesn't look like a progress code. Copy the whole code from the other device and try again."}; }
  if(!o || typeof o !== "object") return {err:"That doesn't look like a progress code."};
  if(+o.module !== MOD) return {err:"That code is from " + (o.module ? "Module " + escH(o.module) : "a different app") + ". Load it in that module's app instead."};
  if(o.v !== 1) return {err:"That code was made by a newer version of the app. Update this page and try again."};
  var p = sanitize(o, true);
  if(!p) return {err:"That code couldn't be read."};
  return {p:p};
}
function mergeIn(inc){
  var c = {best:0, read:0, miss:0};
  Object.keys(inc.best).forEach(function(k){ if(!(k in PG.best) || inc.best[k] > PG.best[k]){ PG.best[k] = inc.best[k]; c.best++; } });
  Object.keys(inc.attempts).forEach(function(k){ if(!(k in PG.attempts) || inc.attempts[k] > PG.attempts[k]) PG.attempts[k] = inc.attempts[k]; });
  inc.read.forEach(function(id){ if(!isRead(id)){ PG.read.push(id); c.read++; } });
  if(!PG.last && inc.last) PG.last = inc.last;
  Object.keys(inc.misses).forEach(function(k){
    var a = PG.misses[k], b = inc.misses[k];
    if(!a){ PG.misses[k] = {n:b.n, t:b.t, h:b.h || hashOf(k)}; c.miss++; }
    else { a.n = Math.min(a.n, b.n); a.t = Math.max(a.t, b.t); }
  });
  save(); applyBest(); syncMiss();
  return c;
}
function setMsg(id, cls, html){ var m = document.getElementById(id); if(m){ m.className = "hx-msg " + cls; m.innerHTML = html; } }
function doImport(txt){
  var r = parseCode(txt);
  if(r.err){ setMsg("hx-imsg", "bad", r.err); return false; }
  var c = mergeIn(r.p);
  FLASHMSG = {id:"hx-imsg", cls:"ok", html:"Progress merged: " + c.best + " higher score" + (c.best === 1 ? "" : "s") + ", " + c.read + " more read lesson" + (c.read === 1 ? "" : "s") + ", " + c.miss + " new miss" + (c.miss === 1 ? "" : "es") + "." + (STORE_OK ? "" : " (This browser can't save, so it lasts until you close the page.)")};
  SYNC_OPEN = true; draw();
  return true;
}
var FLASHMSG = null, SYNC_OPEN = false;

/* ---------- home / lesson decoration (runs after every draw; idempotent) ---------- */
function decorateFilter(){
  if(document.getElementById("bx-filt")) return;
  var on = SET.examOnly, total = 0, shown = 0, used = {};
  ORDER.forEach(function(id){ total++; if(isExamFocus(id)) shown++; badgesOf(id).forEach(function(k){ used[k] = 1; }); });
  if(!Object.keys(used).length){ app.classList.remove("bx-exonly"); return; }   // module has no badges: no panel
  if(!shown) on = false;                                                         // no exam-focus lessons yet: no switch
  var box = document.createElement("div"); box.id = "bx-filt";
  box.innerHTML = (shown ? '<div class="bx-frow"><label class="bx-tog"><input type="checkbox" id="bx-exam"' + (on ? " checked" : "") + '><span class="bx-sw" aria-hidden="true"></span><span class="bx-tl">★ Exam focus only</span></label>' +
    '<span class="bx-cnt">' + (on ? "Showing " + shown + " of " + total + " lessons" : total + " lessons") + '</span></div>' : '') +
    '<p class="bx-legend">' + ["ex","p211","rev","prac","sky"].filter(function(k){ return used[k]; }).map(function(k){ return '<span class="bx-li">' + chip(k) + ' ' + BADGE_DEF[k].d + '</span>'; }).join('<span class="bx-dot" aria-hidden="true"> · </span>') + '</p>';
  var lede = app.querySelector("p.lede");
  if(lede && lede.parentNode === app) app.insertBefore(box, lede.nextSibling);
  else { var top = document.getElementById("hx-top"); app.insertBefore(box, top ? top.nextSibling : app.firstChild); }
  app.classList.toggle("bx-exonly", on);
  if(!on) return;
  // hide lessons without the Exam-focus badge; hide units/groups left empty (open or closed)
  app.querySelectorAll("button.row[data-l]").forEach(function(b){ if(!isExamFocus(b.dataset.l)) b.classList.add("bx-hide"); });
  app.querySelectorAll("section.unit").forEach(function(s){ if(!s.querySelector("button.row[data-l]:not(.bx-hide)")) s.classList.add("bx-hide"); });
  app.querySelectorAll("section.topic-group").forEach(function(s){
    var t = s.querySelector("[data-unittoggle],[data-grouptoggle]"); if(!t) return;
    var units = t.dataset.unittoggle !== undefined ? [UNITS[+t.dataset.unittoggle]] : UNITS.filter(function(u){ return u.group === t.dataset.grouptoggle; });
    var any = units.some(function(u){ return u && u.lessons.some(function(x){ return isExamFocus(x.id); }); });
    if(!any) s.classList.add("bx-hide");
  });
}
function fmtDate(ts){ try{ return new Date(ts).toLocaleDateString(undefined, {month:"short", day:"numeric", year:"numeric"}); }catch(e){ return ""; } }
function decorateHome(){
  if(document.getElementById("hx-top")) return;
  var top = document.createElement("div"); top.id = "hx-top";
  var h = "";
  if(PG.last && L[PG.last]){
    var ui = unitIndexOf(PG.last);
    h += '<button class="hx-cont" data-l="' + PG.last + '"><span><small>Continue where you left off</small><strong>' + L[PG.last].title + '</strong><em>' + UNITS[ui].title + '</em></span><span class="ar" aria-hidden="true">›</span></button>';
  }
  var n = missKeys().length;
  if(n) h += '<button class="hx-missbtn" data-q="' + MISS_ID + '"><span>Review My Misses (' + n + ')</span><span class="ar" aria-hidden="true">›</span></button>';
  h += '<div class="hx-search"><span class="ic" aria-hidden="true">🔍</span><input id="hx-q" type="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="' + escH(MODULE.searchHint ? "Search every lesson (e.g., " + MODULE.searchHint + ")" : "Search every lesson") + '" aria-label="Search every lesson"><button id="hx-clr" class="clr" type="button" aria-label="Clear search" data-hx-clear="1" hidden>✕</button></div><div id="hx-res"></div>';
  top.innerHTML = h;
  app.insertBefore(top, app.firstChild);
  var inp = document.getElementById("hx-q"); inp.value = SQ; if(SQ) renderResults();
  app.querySelectorAll("button.row[data-l]").forEach(function(b){
    var t = b.querySelector(".t"); if(!t) return;
    if(isRead(b.dataset.l) && !t.querySelector(".rd")) t.insertAdjacentHTML("beforeend", '<span class="rd" title="Read" aria-label="read">✓</span>');
    var c = chipsHTML(b.dataset.l); if(c && !t.querySelector(".bx-chips")) t.insertAdjacentHTML("beforeend", '<span class="bx-chips">' + c + '</span>');
  });
  decorateFilter();
  var f = document.createElement("div"); f.id = "hx-foot";
  f.innerHTML = '<details class="hx-sync"' + (SYNC_OPEN ? " open" : "") + '><summary>Save / move my progress</summary><div class="bd">' +
    '<p>Your scores, read lessons, and misses are saved in this browser only. To move them to another phone or computer, copy a code here and load it there.</p>' +
    '<h5>From this device</h5><div class="hx-btns"><button class="hx-btn pri" data-hx-export="1">Copy my progress code</button><button class="hx-btn" data-hx-download="1">Download backup file</button></div>' +
    '<div id="hx-exbox" hidden><textarea id="hx-code" readonly aria-label="Your progress code"></textarea><div class="hx-btns"><button class="hx-btn" data-hx-copy="1">Copy</button></div></div><div id="hx-emsg" class="hx-msg"></div>' +
    '<h5>Load progress from another device</h5><p>Paste a code below, or choose a backup file. It merges with what is already here — nothing is lost.</p>' +
    '<textarea id="hx-paste" placeholder="Paste a progress code here" aria-label="Paste a progress code"></textarea><div class="hx-btns"><button class="hx-btn pri" data-hx-import="1">Load progress</button></div>' +
    '<div class="hx-btns"><label class="hx-btn hx-file">Choose a backup file…<input type="file" id="hx-file" accept=".json,application/json,text/plain"></label></div><div id="hx-imsg" class="hx-msg"></div></div></details>' +
    '<div class="hx-resetrow"><button class="hx-reset" data-hx-reset="1">Reset my progress</button></div><div id="hx-rmsg" class="hx-note">' +
    (STORE_OK ? "Progress is saved on this device and browser only." : "This browser isn't letting the app save (private browsing?). Everything works, but progress clears when you close the page.") + '</div>';
  app.appendChild(f);
  if(FLASHMSG){ setMsg(FLASHMSG.id, FLASHMSG.cls, FLASHMSG.html); if(FLASHMSG.id === "hx-rmsg"){ var r = document.getElementById("hx-rmsg"); r.className = "hx-note"; } FLASHMSG = null; }
}
function headingList(x){
  var out = [];
  (x.blocks || []).forEach(function(b, bi){ if(b.h){ var t = plain(b.h); if(t) out.push({bi:bi, t:t.length > 90 ? t.slice(0, 88) + "…" : t}); } });
  return out;
}
var snav = null, topBtn = null;
function setSnav(id){
  if(!snav){
    snav = document.createElement("nav"); snav.id = "hx-snav"; snav.setAttribute("aria-label", "Previous and next lesson");
    document.body.appendChild(snav);
    snav.addEventListener("click", function(e){ var b = e.target.closest("button[data-hx-l]"); if(b) nav("lesson", {id:b.dataset.hxL}); });
  }
  var n = ORDER.indexOf(id), pv = n > 0 ? ORDER[n-1] : null, nx = n >= 0 && n < ORDER.length - 1 ? ORDER[n+1] : null;
  snav.innerHTML = '<div class="in">' +
    (pv ? '<button class="pv" data-hx-l="' + pv + '"><small>‹ Previous</small><span>' + L[pv].title + '</span></button>' : '<div class="ph"></div>') +
    (nx ? '<button class="nx" data-hx-l="' + nx + '"><small>Next ›</small><span>' + L[nx].title + '</span></button>' : '<div class="ph"></div>') + '</div>';
}
function decorateLesson(){
  var x = L[S.id]; if(!x) return;
  setSnav(x.id);
  if(app.querySelector(".hx-ldone")) return;
  app.querySelectorAll(".acts > button[data-l]").forEach(function(b){ if(/^(Previous|Next): /.test(b.textContent)) b.remove(); });
  var ttl = app.querySelector("h3.title"), lc = chipsHTML(x.id);
  if(ttl && lc && !app.querySelector(".bx-lchips")) ttl.insertAdjacentHTML("afterend", '<div class="bx-chips bx-lchips">' + lc + '</div>');
  var anchor = app.querySelector("p.kick") || app.querySelector("h3.title");
  var h = "";
  if(x.id === MISS_ID){
    var n = missKeys().length;
    h += '<p class="hx-stat' + (n ? "" : " dim") + '">' + (n ? n + " question" + (n === 1 ? "" : "s") + " waiting for review" : "Nothing saved yet — missed questions will show up here automatically.") + '</p>';
  } else if(QUIZ[x.id] && S.best[x.id] !== undefined){
    var at = PG.attempts[x.id];
    h += '<p class="hx-stat">Your best: ' + fmtScore(S.best[x.id]) + '/' + QUIZ[x.id].length + (at ? ' · last attempt ' + fmtDate(at) : '') + '</p>';
  }
  var hs = headingList(x);
  if(hs.length >= 3) h += '<details class="otp"><summary>On this page<span>' + hs.length + ' sections</span></summary><ol>' + hs.map(function(o){ return '<li><button data-hx-jump="' + o.bi + '">' + escH(o.t) + '</button></li>'; }).join("") + '</ol></details>';
  var mk = document.createElement("div"); mk.className = "hx-ldone"; mk.innerHTML = h;
  if(anchor && anchor.parentNode === app) app.insertBefore(mk, anchor.nextSibling); else app.insertBefore(mk, app.firstChild);
  if(x.id !== MISS_ID && PG.last !== x.id){ PG.last = x.id; save(); }
}
function decorateResult(){
  if(S.id !== MISS_ID || app.querySelector(".hx-mres")) return;
  var n = missKeys().length, big = app.querySelector(".big");
  var p = document.createElement("p"); p.className = "hx-stat hx-mres" + (n ? "" : " dim"); p.style.marginTop = "12px";
  p.textContent = n ? n + " question" + (n === 1 ? "" : "s") + " still in your misses list." : "Your misses list is empty — nice work.";
  if(big && big.parentNode) big.parentNode.insertBefore(p, big.nextSibling);
}
function checkRead(){
  if(S.view !== "lesson" || !S.id) return;
  var se = document.scrollingElement || document.documentElement;
  if(window.innerHeight + window.pageYOffset >= se.scrollHeight - 140) markRead(S.id);
}
function updTop(){ if(topBtn) topBtn.classList.toggle("show", window.pageYOffset > window.innerHeight * 0.9); }
var resTok = null;
function postDraw(){
  var sb = document.getElementById("hx-sbtn"); if(sb) sb.hidden = S.view === "home";
  document.body.classList.toggle("hx-snav-on", S.view === "lesson");
  if(S.view === "home") decorateHome();
  else if(S.view === "lesson"){ decorateLesson(); setTimeout(checkRead, 400); }
  else if(S.view === "quiz"){
    if(L[S.id]) markRead(S.id);
    app.querySelectorAll("table.matrix-table").forEach(function(t){   // wide answer grids scroll inside themselves, never the page
      if(t.parentNode.classList.contains("bx-mx")) return;
      var w = document.createElement("div"); w.className = "bx-mx"; t.parentNode.insertBefore(w, t); w.appendChild(t);
    });
    if(S.id === MISS_ID && !app.querySelector(".hx-from")){
      var cq = curBank()[S.i], src = cq && cq._src && SRC[cq._src], qd = app.querySelector(".q");
      if(src && qd){ var fl = document.createElement("p"); fl.className = "count hx-from"; fl.style.margin = "4px 0 0";
        fl.textContent = "From: " + plain(L[src.k] ? L[src.k].title : src.k); qd.parentNode.insertBefore(fl, qd); }
    }
  }
  else if(S.view === "result" && L[S.id]){
    if(resTok !== S.shuffledBank){
      resTok = S.shuffledBank;
      if(S.id === MISS_ID) delete S.best[MISS_ID];
      else {
        if(QUIZ[S.id] && num(S.best[S.id])) PG.best[S.id] = S.best[S.id];
        PG.attempts[S.id] = Date.now(); save();
      }
    }
    decorateResult();
  }
  updTop();
}
var _draw = draw;
draw = function(){
  try{ logAnswer(); }catch(e){ console.error(e); }
  _draw.apply(this, arguments);
  try{ postDraw(); }catch(e){ console.error(e); }
};

/* ---------- clicks for the extras (capture phase, before the engine's own handler) ---------- */
var resetArmed = null;
function copyText(ta){
  var done = function(ok){ setMsg("hx-emsg", ok ? "ok" : "bad", ok ? "Copied. Paste it into this app on your other device (Save / move my progress → Load)." : "Couldn't copy automatically — the code is selected; use Copy from your keyboard or menu."); };
  ta.focus(); ta.select(); try{ ta.setSelectionRange(0, ta.value.length); }catch(e){}
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(ta.value).then(function(){ done(true); }, function(){ var ok = false; try{ ok = document.execCommand("copy"); }catch(e){} done(ok); }); return; }
  }catch(e){}
  var ok = false; try{ ok = document.execCommand("copy"); }catch(e){} done(ok);
}
document.addEventListener("click", function(e){
  var t = e.target.closest ? e.target.closest("button,[data-q]") : null;
  if(!t) return;
  var d = t.dataset;
  if(d.q === MISS_ID && !QUIZ[MISS_ID]){ e.stopPropagation(); e.preventDefault(); nav("lesson", {id:MISS_ID}); return; }
  if(t.id === "hx-sbtn"){ e.stopPropagation(); if(S.view !== "home") nav("home"); var q = document.getElementById("hx-q"); if(q){ q.focus(); scrollToEl(q.parentNode, false); } return; }
  if(t.id === "hx-topbtn"){ try{ window.scrollTo({top:0, behavior:"smooth"}); }catch(err){ window.scrollTo(0,0); } return; }
  if(d.hxOpen){ e.stopPropagation(); var bi = +d.hxBi; nav("lesson", {id:d.hxOpen}); if(bi >= 0) goToBlock(bi); return; }
  if(d.hxJump !== undefined){ e.stopPropagation(); var el = app.querySelector('[data-bi="' + d.hxJump + '"]'); if(el){ scrollToEl(el, true); el.classList.remove("hx-flash"); void el.offsetWidth; el.classList.add("hx-flash"); } return; }
  if(d.hxClear){ e.stopPropagation(); SQ = ""; var qi = document.getElementById("hx-q"); if(qi){ qi.value = ""; qi.focus(); } renderResults(); return; }
  if(d.hxReset){
    e.stopPropagation();
    if(resetArmed){
      clearTimeout(resetArmed); resetArmed = null;
      clearAll(); PG = blank(); applyBest(); syncMiss(); SQ = "";
      FLASHMSG = {id:"hx-rmsg", cls:"", html:"Your progress on this device was reset."};
      draw(); return;
    }
    t.classList.add("armed"); t.textContent = "Tap again to confirm — erases scores, read marks & misses";
    resetArmed = setTimeout(function(){ resetArmed = null; t.classList.remove("armed"); t.textContent = "Reset my progress"; }, 5000);
    return;
  }
  if(d.hxExport){
    e.stopPropagation();
    var box = document.getElementById("hx-exbox"), ta = document.getElementById("hx-code");
    ta.value = b64enc(JSON.stringify(exportObj())); box.hidden = false;
    copyText(ta); return;
  }
  if(d.hxCopy){ e.stopPropagation(); copyText(document.getElementById("hx-code")); return; }
  if(d.hxDownload){
    e.stopPropagation();
    try{
      var blob = new Blob([JSON.stringify(exportObj(), null, 1)], {type:"application/json"});
      var url = URL.createObjectURL(blob), a = document.createElement("a");
      var dt = new Date(), ds = dt.getFullYear() + "-" + ("0" + (dt.getMonth()+1)).slice(-2) + "-" + ("0" + dt.getDate()).slice(-2);
      a.href = url; a.download = "nur114-m" + MOD + "-progress-" + ds + ".json"; document.body.appendChild(a); a.click();
      setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); }, 1500);
      setMsg("hx-emsg", "ok", "Backup file saved (check your Downloads or Files app).");
    }catch(err){ setMsg("hx-emsg", "bad", "This browser couldn't make a file. Use “Copy my progress code” instead."); }
    return;
  }
  if(d.hxImport){ e.stopPropagation(); var pa = document.getElementById("hx-paste"); doImport(pa ? pa.value : ""); return; }
}, true);
document.addEventListener("change", function(e){
  if(e.target && e.target.id === "bx-exam"){
    SET.examOnly = !!e.target.checked; saveSet(); draw();
    var cb = document.getElementById("bx-exam"); if(cb){ try{ cb.focus({preventScroll:true}); }catch(err){} }
    return;
  }
  if(!e.target || e.target.id !== "hx-file") return;
  var f = e.target.files && e.target.files[0]; if(!f) return;
  if(f.size > 2e6){ setMsg("hx-imsg", "bad", "That file is too big to be a progress backup."); return; }
  try{
    var rd = new FileReader();
    rd.onload = function(){ doImport(String(rd.result || "")); };
    rd.onerror = function(){ setMsg("hx-imsg", "bad", "Couldn't read that file."); };
    rd.readAsText(f);
  }catch(err){ setMsg("hx-imsg", "bad", "Couldn't read that file."); }
});

/* ---------- floating Top button + read-on-scroll ---------- */
topBtn = document.createElement("button"); topBtn.id = "hx-topbtn"; topBtn.type = "button"; topBtn.textContent = "↑ Top"; topBtn.setAttribute("aria-label", "Back to top");
document.body.appendChild(topBtn);
var ticking = false;
window.addEventListener("scroll", function(){ if(ticking) return; ticking = true; requestAnimationFrame(function(){ ticking = false; updTop(); checkRead(); }); }, {passive:true});

/* expose a small read-only API for tests and a future combined "Final" page */
window.NUR114_PROGRESS = { key:PKEY, get:function(){ return JSON.parse(JSON.stringify(PG)); }, storageOK:STORE_OK };
window.NUR114_SETTINGS = { key:SKEY, get:function(){ return {examOnly:SET.examOnly, fs:SET.fs, theme:SET.theme || null, effectiveTheme:curTheme()}; }, badges:function(id){ return badgesOf(id).slice(); } };

draw();   // re-render the current view with restored scores, ✓ marks, and banners
})();
