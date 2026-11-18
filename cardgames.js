/* Card Match games — mounts into <span class="cg-mount" data-set="..."> inside Games lessons.
   Data: CARD_GAMES (module content). Strip images: STRIPS. Self-contained; no engine hooks needed. */
(function(){
"use strict";
if(typeof CARD_GAMES === "undefined") return;
var COLS = ["c-teal","c-purple","c-red","c-orange","c-teal"];
function shuffle(a){ a = a.slice(); for(var i = a.length - 1; i > 0; i--){ var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function stripify(h){ return String(h).replace(/STRIP:(\w+)/g, function(m, k){ return (typeof STRIPS !== "undefined" && STRIPS[k]) || ""; }).replace(/<img /g, '<img class="cg-inimg" '); }
function plain(h){ return String(h).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().toLowerCase(); }

/* Build a deck of questions for a set. Each question: {id, promptLabel, prompt (html), strips?, cols:[{label, cls, options:[html], answer:html}] } */
function rhythmDeck(items, grp){
  var pool = items.filter(function(d){ return !grp || grp === "All" || d.grp === grp; });
  return shuffle(pool).map(function(it){
    var same = shuffle(items.filter(function(d){ return d.fam === it.fam && d.k !== it.k; }));
    var other = shuffle(items.filter(function(d){ return d.fam !== it.fam; }));
    var nameOpts = same.length ? [it, same[0], other[0]] : [it, other[0], other[1]];
    function far(f){ return shuffle([it].concat(shuffle(items.filter(function(d){ return d.fam !== it.fam; })).slice(0, 2))).map(function(d){ return d[f]; }); }
    return { id: it.k, title: it.name, promptLabel: "Rhythm strip", strips: it.strips, cols: [
      { label: "Rhythm", cls: "c-navy", big: true, options: shuffle(nameOpts).map(function(d){ return d.name; }), answer: it.name },
      { label: "Signs & symptoms", cls: "c-teal", options: far("ss"), answer: it.ss },
      { label: "Treatment", cls: "c-red", options: far("tx"), answer: it.tx } ] };
  });
}
function matchDeck(set){
  var rows = set.rows;
  return shuffle(rows.map(function(r, ri){ return ri; })).map(function(ri){
    var r = rows[ri], cols = [];
    for(var c = 1; c < set.cats.length; c++){
      if(r[c] == null) continue;
      var seen = [plain(r[c])], opts = [r[c]];
      shuffle(rows.filter(function(x, xi){ return xi !== ri && x[c] != null; })).forEach(function(x){
        if(opts.length < 3 && seen.indexOf(plain(x[c])) < 0){ seen.push(plain(x[c])); opts.push(x[c]); } });
      var label = set.cats[c];
      if(c === 3 && r[4] === null && /alert/i.test(label)) label = "Alert";
      cols.push({ label: label, cls: COLS[(c - 1) % COLS.length], options: shuffle(opts), answer: r[c] });
    }
    return { id: set.key + ":" + ri, title: plain(r[0]).length < 60 ? r[0] : set.cats[0], promptLabel: set.cats[0], prompt: r[0], cols: cols };
  });
}
function sortDeck(set){
  var items = [];
  set.groups.forEach(function(g, gi){
    g[1].forEach(function(x){ items.push({ text: x, gi: gi, label: set.ilabel || "Card" }); });
    (g[2] || []).forEach(function(x){ items.push({ text: x, gi: gi, label: set.tlabel || "Card" }); });
  });
  var names = set.groups.map(function(g){ return g[0]; });
  return shuffle(items).map(function(it, n){
    return { id: set.key + ":" + plain(it.text).slice(0, 40), title: it.text, promptLabel: it.label, prompt: it.text, sort: true,
      cols: [{ label: set.glabel || "Which group?", cls: "c-navy", big: true, keepOrder: true, options: names.slice(), answer: names[it.gi] }] };
  });
}

function Game(el){
  this.el = el; this.key = el.getAttribute("data-set"); this.G = CARD_GAMES[this.key];
  this.sub = this.G.mode === "rhythm" ? "All" : 0;
  this.start();
}
Game.prototype.deckFor = function(onlyIds){
  var G = this.G, d;
  if(G.mode === "rhythm") d = rhythmDeck(G.items, this.sub);
  else { var set = G.sets[this.sub]; d = set.type === "sort" ? sortDeck(set) : matchDeck(set); }
  if(onlyIds) d = d.filter(function(q){ return onlyIds.indexOf(q.id) >= 0; });
  return d;
};
Game.prototype.start = function(onlyIds){
  this.deck = this.deckFor(onlyIds); this.i = 0; this.score = 0; this.total = 0; this.streak = 0; this.misses = {}; this.ans = {}; this.done = false;
  this.deck.forEach(function(q){ this.total += q.cols.length; }, this);
  this.render();
};
Game.prototype.chips = function(){
  var G = this.G, self = this, list;
  if(G.mode === "rhythm") list = ["All","Sinus & atrial","Ventricular","Pacers & block","MI"].map(function(g){ return [g, g]; });
  else if(G.sets.length > 1) list = G.sets.map(function(s, i){ return [i, s.title]; });
  else return "";
  return '<div class="cg-chips" role="group" aria-label="Choose a set">' + list.map(function(x){
    return '<button type="button" class="cg-chip" data-sub="' + x[0] + '" aria-pressed="' + (String(x[0]) === String(self.sub)) + '">' + x[1].replace(/&(?!amp;)/g, "&amp;") + '</button>'; }).join("") + '</div>';
};
Game.prototype.render = function(){
  var self = this, q = this.deck[this.i], h = this.chips();
  var done = this.done || !q;
  h += '<div class="cg-stats"><span><b>' + (done ? this.deck.length : this.i + 1) + '/' + this.deck.length + '</b> card</span><span><b>' + this.score + '/' + this.total + '</b> correct</span><span><b>' + this.streak + '</b> streak</span></div>';
  if(done){ this.el.innerHTML = h + this.endHTML(); this.wire(); return; }
  var prompt;
  if(q.strips){
    var multi = q.strips.length > 1;
    prompt = '<div class="cg-strip">' + q.strips.map(function(k, j){ return (multi ? '<div class="cg-lab">' + "abc"[j] + '</div>' : '') + '<img src="' + ((typeof STRIPS !== "undefined" && STRIPS[k]) || "") + '" alt="ECG rhythm strip">'; }).join("") + '</div>';
  } else prompt = '<div class="cg-prompt' + (q.sort ? ' cg-prompt-sort' : '') + '"><div class="cg-plabel">' + q.promptLabel + '</div><div class="cg-ptext">' + stripify(q.prompt) + '</div></div>';
  var cols = q.cols.map(function(c, ci){
    var a = self.ans[ci], opts = (c.keepOrder ? c.options : c.options).map(function(o, oi){
      var cls = "cg-opt";
      if(a != null){ if(plain(o) === plain(c.answer)) cls += " ok"; else if(oi === a) cls += " no"; else cls += " dim"; }
      return '<button type="button" class="' + cls + (c.big ? ' big' : '') + '" data-c="' + ci + '" data-o="' + oi + '"' + (a != null ? ' disabled' : '') + '>' + stripify(o) + '</button>';
    }).join("");
    var v = a == null ? "" : (plain(c.options[a]) === plain(c.answer) ? '<div class="cg-v ok">Correct</div>' : '<div class="cg-v no">Not quite — the green card is the match</div>');
    return '<section class="cg-col ' + c.cls + '"><h5>' + c.label.replace(/&(?!amp;)/g, "&amp;") + '</h5><div class="cg-opts">' + opts + '</div>' + v + '</section>';
  }).join("");
  var all = Object.keys(this.ans).length === q.cols.length;
  h += prompt + '<div class="cg-cols n' + Math.min(q.cols.length, 4) + '">' + cols + '</div>' +
    '<div class="cg-bar"><span class="cg-hint">' + (all ? "" : (q.cols.length > 1 ? "Answer every column to continue." : "Pick one to continue.")) + '</span><button type="button" class="cg-btn cg-next"' + (all ? "" : " disabled") + '>' + (this.i < this.deck.length - 1 ? "Next" : "See results") + '</button></div>';
  this.el.innerHTML = h; this.wire();
};
Game.prototype.endHTML = function(){
  var keys = Object.keys(this.misses), pct = this.total ? Math.round(100 * this.score / this.total) : 0, self = this;
  var list = keys.map(function(k){ return '<li><span class="cg-mt">' + self.misses[k].title + '</span>' + self.misses[k].cols.map(function(c){ return '<span class="cg-tag">' + c + '</span>'; }).join("") + '</li>'; }).join("");
  return '<div class="cg-end"><div class="cg-big">' + this.score + '/' + this.total + '</div><p>' + pct + '% matched' + (keys.length ? ' · ' + keys.length + ' to review' : ' · a perfect round') + '</p>' +
    (keys.length ? '<ul class="cg-miss">' + list + '</ul>' : '') +
    '<div class="cg-bar" style="justify-content:flex-start">' + (keys.length ? '<button type="button" class="cg-btn cg-redo">Replay missed (' + keys.length + ')</button>' : '') + '<button type="button" class="cg-btn ghost cg-again">New shuffle</button></div></div>';
};
Game.prototype.wire = function(){
  var self = this;
  this.el.onclick = function(e){
    var b = e.target.closest ? e.target.closest("button") : null; if(!b || !self.el.contains(b)) return;
    if(b.classList.contains("cg-chip")){ var s = b.getAttribute("data-sub"); self.sub = self.G.mode === "rhythm" ? s : +s; self.start(); return; }
    if(b.classList.contains("cg-opt")){ self.pick(+b.getAttribute("data-c"), +b.getAttribute("data-o")); return; }
    if(b.classList.contains("cg-next")){ self.next(); return; }
    if(b.classList.contains("cg-redo")){ self.start(Object.keys(self.misses)); return; }
    if(b.classList.contains("cg-again")){ self.start(); return; }
  };
};
Game.prototype.pick = function(ci, oi){
  if(this.ans[ci] != null) return;
  var q = this.deck[this.i], c = q.cols[ci]; this.ans[ci] = oi;
  if(plain(c.options[oi]) === plain(c.answer)){ this.score++; this.streak++; }
  else { this.streak = 0; var m = this.misses[q.id] || (this.misses[q.id] = { title: plain(q.title).length > 70 ? plain(q.title).slice(0, 70) + "…" : q.title.replace(/<img[^>]*>/g, ""), cols: [] }); m.cols.push(c.label); }
  this.render();
  if(Object.keys(this.ans).length === q.cols.length){ var n = this.el.querySelector(".cg-next"); if(n) n.focus({ preventScroll: true }); }
};
Game.prototype.next = function(){
  this.ans = {};
  if(this.i < this.deck.length - 1) this.i++; else this.done = true;
  this.render();
  var top = this.el.getBoundingClientRect().top + window.pageYOffset - 80; if(top < window.pageYOffset) window.scrollTo(0, top);
};
function mountAll(root){
  (root || document).querySelectorAll(".cg-mount:not([data-ready])").forEach(function(el){
    el.setAttribute("data-ready", "1"); var d = document.createElement("div"); d.className = "cg-game"; el.replaceWith(d); d.setAttribute("data-set", el.getAttribute("data-set")); new Game(d);
  });
}
mountAll();
new MutationObserver(function(){ if(document.querySelector(".cg-mount:not([data-ready])")) mountAll(); }).observe(document.body, { childList: true, subtree: true });
})();
