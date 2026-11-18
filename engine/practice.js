/* Endless practice generators — shared engine.
   Mounts into <span class="px-mount" data-gen="math|abg|abg-rome"></span> inside any lesson.
   Every question is generated fresh; the current question and running stats are saved per module in
   localStorage "nur114-m<N>:practice", so a game reopens exactly where it was left.
   Module options: MODULE.practiceMath = [generator keys] (default: all). */
(function(){
"use strict";
var MODN = (typeof MODULE !== "undefined" && MODULE.num) || (document.documentElement.getAttribute("data-mod") || "0");
var KEY = "nur114-m" + MODN + ":practice";
function load(){ try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch(e){ return {}; } }
function save(st){ try { localStorage.setItem(KEY, JSON.stringify(st)); } catch(e){} }
function ri(a, b){ return a + Math.floor(Math.random() * (b - a + 1)); }
function rf(a, b, d){ var m = Math.pow(10, d); return Math.round((a + Math.random() * (b - a)) * m) / m; }
function pick(a){ return a[Math.floor(Math.random() * a.length)]; }
function r(x, d){ var m = Math.pow(10, d); return Math.round(x * m + 1e-9) / m; }
function fmt(x){ return Number(x).toLocaleString("en-US", { maximumFractionDigits: 4 }); }
function esc(s){ return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
var RND = { 0: "Round to the nearest whole number.", 1: "Round to the nearest tenth.", 2: "Round to the nearest hundredth." };

/* ---------------- Med Math generators ----------------
   Each returns {stem, unit, ans, d (decimals), steps:[...], k}. Rules follow the Med Math lessons. */
var MATH = {
 "dose-tab": { label: "Tablets", f: function(){
   var drug = pick([["metoprolol", [25, 50]], ["furosemide", [20, 40]], ["lorazepam", [0.5, 1]], ["acetaminophen", [325, 500]], ["amiodarone", [200]], ["digoxin", [0.125, 0.25]]]);
   var have = pick(drug[1]), mult = have < 1 ? pick([1, 2]) : pick([0.5, 1, 1.5, 2, 3]), want = r(have * mult, 3);
   return { stem: "Order: " + drug[0] + " " + fmt(want) + " mg PO. Available: " + fmt(have) + " mg tablets. How many tablets will you give?", unit: "tablets", ans: r(want / have, 1), d: 1,
     steps: ["Desired ÷ Have × Quantity", fmt(want) + " ÷ " + fmt(have) + " × 1 tablet = " + fmt(r(want / have, 2)) + " tablets"] };
 }},
 "dose-liq": { label: "Liquids & IV push", f: function(){
   var c = pick([["lorazepam", 2, "mg", [1, 2, 3, 4]], ["morphine", 4, "mg", [2, 3, 4, 6]], ["naloxone", 0.4, "mg", [0.4, 0.8, 0.2]], ["adenosine", 3, "mg", [6, 12]], ["atropine", 0.1, "mg", [0.5, 1]], ["furosemide", 10, "mg", [20, 40, 60]], ["ondansetron", 2, "mg", [4, 8]], ["heparin", 5000, "units", [5000, 7500, 2500]]]);
   var want = pick(c[3]), ans = r(want / c[1], 1);
   return { stem: "Order: " + c[0] + " " + fmt(want) + " " + c[2] + " IV. Available: " + fmt(c[1]) + " " + c[2] + "/mL. How many mL will you give?", unit: "mL", ans: ans, d: 1,
     steps: ["Desired ÷ Have × Quantity", fmt(want) + " ÷ " + fmt(c[1]) + " × 1 mL = " + fmt(r(want / c[1], 3)) + " mL"] };
 }},
 "lbkg": { label: "Pounds → kg", f: function(){
   var lb = ri(95, 320);
   return { stem: "A client weighs " + lb + " lb. What is the weight in kilograms?", unit: "kg", ans: r(lb / 2.2, 1), d: 1, steps: ["lb ÷ 2.2 = kg", lb + " ÷ 2.2 = " + fmt(r(lb / 2.2, 3)) + " kg"] };
 }},
 "weight-mg": { label: "Weight-based dose (mg/kg)", f: function(){
   var lb = ri(110, 280), kg = r(lb / 2.2, 1), per = pick([0.5, 1, 1.5, 2]), dose = r(kg * per, 1);
   return { stem: "Order: lidocaine " + per + " mg/kg IV for a client who weighs " + lb + " lb. How many mg will you give? (Convert the weight to kg first and round the kg to the nearest tenth.)", unit: "mg", ans: dose, d: 1,
     steps: [lb + " lb ÷ 2.2 = " + fmt(kg) + " kg", fmt(kg) + " kg × " + per + " mg/kg = " + fmt(r(kg * per, 3)) + " mg"] };
 }},
 "mlhr": { label: "mL/hr (pump)", f: function(){
   var vol = pick([50, 100, 250, 500, 1000]), hrs = pick(vol <= 100 ? [0.5, 1] : vol <= 250 ? [1, 2, 3] : [4, 6, 8, 10, 12]);
   if(vol <= 100){ var min = hrs * 60;
     return { stem: "Infuse " + vol + " mL of an IV antibiotic over " + min + " minutes on a pump. What rate do you set in mL/hr?", unit: "mL/hr", ans: r(vol / hrs, 1), d: 1, steps: ["Convert minutes to hours: " + min + " ÷ 60 = " + hrs + " hr", vol + " mL ÷ " + hrs + " hr = " + fmt(r(vol / hrs, 3)) + " mL/hr"] }; }
   return { stem: "Infuse " + vol + " mL of normal saline over " + hrs + " hours. What rate do you set on the pump in mL/hr?", unit: "mL/hr", ans: r(vol / hrs, 1), d: 1, steps: ["Total volume ÷ total time", vol + " ÷ " + hrs + " = " + fmt(r(vol / hrs, 3)) + " mL/hr"] };
 }},
 "gtt": { label: "Drip rate (gtt/min)", f: function(){
   var df = pick([10, 15, 20, 60]);
   if(Math.random() < 0.5){ var rate = pick([75, 100, 125, 150, 83, 50]);
     return { stem: "An IV is ordered at " + rate + " mL/hr by gravity. The tubing drop factor is " + df + " gtt/mL. How many drops per minute?", unit: "gtt/min", ans: r(rate / 60 * df, 0), d: 0,
       steps: ["(mL/hr ÷ 60) × drop factor", "(" + rate + " ÷ 60) × " + df + " = " + fmt(r(rate / 60 * df, 2)) + " → " + r(rate / 60 * df, 0) + " gtt/min"] }; }
   var vol = pick([500, 1000, 250]), hrs = pick([2, 4, 6, 8]), min = hrs * 60;
   return { stem: "Infuse " + vol + " mL over " + hrs + " hours by gravity with tubing of " + df + " gtt/mL. How many drops per minute?", unit: "gtt/min", ans: r(vol * df / min, 0), d: 0,
     steps: ["(Volume × drop factor) ÷ time in minutes", "(" + vol + " × " + df + ") ÷ " + min + " = " + fmt(r(vol * df / min, 2)) + " → " + r(vol * df / min, 0) + " gtt/min"] };
 }},
 "inftime": { label: "Infusion time", f: function(){
   var vol = pick([250, 500, 1000, 750]), rate = pick([50, 75, 100, 125, 150, 200]);
   return { stem: "A " + vol + " mL bag is infusing at " + rate + " mL/hr. How many hours will it last?", unit: "hours", ans: r(vol / rate, 1), d: 1, steps: ["Volume ÷ rate", vol + " ÷ " + rate + " = " + fmt(r(vol / rate, 3)) + " hr"] };
 }},
 "mcgkgmin": { label: "mcg/kg/min → mL/hr", f: function(){
   var d = pick([["dopamine", 400, 250, [3, 5, 10, 15, 20]], ["dobutamine", 250, 250, [2.5, 5, 10]], ["norepinephrine (weight-based)", 4, 250, [0.05, 0.1, 0.2]]]);
   var kg = ri(55, 120), dose = pick(d[3]), conc = d[1] * 1000 / d[2], ans = r(dose * kg * 60 / conc, 1);
   return { stem: "Order: " + d[0] + " " + dose + " mcg/kg/min for a " + kg + " kg client. The bag contains " + d[1] + " mg in " + d[2] + " mL. What rate in mL/hr?", unit: "mL/hr", ans: ans, d: 1,
     steps: ["Concentration: " + d[1] + " mg × 1,000 ÷ " + d[2] + " mL = " + fmt(conc) + " mcg/mL", "(mcg × kg × 60) ÷ concentration", "(" + dose + " × " + kg + " × 60) ÷ " + fmt(conc) + " = " + fmt(r(dose * kg * 60 / conc, 3)) + " mL/hr"] };
 }},
 "mcgmin": { label: "mcg/min → mL/hr", f: function(){
   var d = pick([["epinephrine", 4, 250, [2, 4, 6, 10]], ["norepinephrine", 4, 250, [2, 5, 8, 12]], ["nitroglycerin", 50, 250, [10, 20, 40]]]);
   var dose = pick(d[3]), conc = d[1] * 1000 / d[2], ans = r(dose * 60 / conc, 1);
   return { stem: "Order: " + d[0] + " " + dose + " mcg/min. The bag contains " + d[1] + " mg in " + d[2] + " mL. What rate in mL/hr?", unit: "mL/hr", ans: ans, d: 1,
     steps: ["Concentration: " + d[1] + " mg × 1,000 ÷ " + d[2] + " mL = " + fmt(conc) + " mcg/mL", "(mcg/min × 60) ÷ concentration", "(" + dose + " × 60) ÷ " + fmt(conc) + " = " + fmt(r(dose * 60 / conc, 3)) + " mL/hr"] };
 }},
 "heparin": { label: "Heparin units → mL/hr", f: function(){
   var conc = 100;
   if(Math.random() < 0.5){ var u = pick([800, 1000, 1200, 1300, 1500, 1600]);
     return { stem: "Order: heparin " + fmt(u) + " units/hr. The bag contains 25,000 units in 250 mL. What rate in mL/hr?", unit: "mL/hr", ans: r(u / conc, 1), d: 1, steps: ["Concentration: 25,000 ÷ 250 = 100 units/mL", fmt(u) + " ÷ 100 = " + fmt(r(u / conc, 3)) + " mL/hr"] }; }
   var kg = ri(55, 120), per = pick([12, 15, 18]);
   return { stem: "Order: heparin " + per + " units/kg/hr for a " + kg + " kg client. The bag contains 25,000 units in 250 mL. What rate in mL/hr?", unit: "mL/hr", ans: r(per * kg / conc, 1), d: 1,
     steps: ["Concentration: 25,000 ÷ 250 = 100 units/mL", per + " × " + kg + " = " + fmt(per * kg) + " units/hr", fmt(per * kg) + " ÷ 100 = " + fmt(r(per * kg / conc, 3)) + " mL/hr"] };
 }},
 "amio": { label: "Amiodarone mg/min", f: function(){
   var dose = pick([0.5, 1]);
   return { stem: "Order: amiodarone " + dose + " mg/min. The bag contains 900 mg in 500 mL. What rate in mL/hr?", unit: "mL/hr", ans: r(dose * 60 / 1.8, 1), d: 1,
     steps: ["Concentration: 900 ÷ 500 = 1.8 mg/mL", dose + " mg/min × 60 = " + fmt(dose * 60) + " mg/hr", fmt(dose * 60) + " ÷ 1.8 = " + fmt(r(dose * 60 / 1.8, 3)) + " mL/hr"] };
 }},
 "co": { label: "Cardiac output", f: function(){
   var hr = ri(50, 150), sv = ri(30, 100), co = hr * sv / 1000;
   return { stem: "A client's heart rate is " + hr + " beats/min and stroke volume is " + sv + " mL/beat. Calculate the cardiac output in L/min.", unit: "L/min", ans: r(co, 1), d: 1,
     steps: ["CO = HR × SV ÷ 1,000", hr + " × " + sv + " = " + fmt(hr * sv) + " mL/min", fmt(hr * sv) + " ÷ 1,000 = " + fmt(r(co, 3)) + " L/min (normal 4–8)"] };
 }},
 "sv": { label: "Stroke volume", f: function(){
   var co = rf(3, 8, 1), hr = ri(55, 130), sv = co * 1000 / hr;
   return { stem: "A client's cardiac output is " + co + " L/min with a heart rate of " + hr + " beats/min. Calculate the stroke volume in mL/beat.", unit: "mL/beat", ans: r(sv, 0), d: 0,
     steps: ["SV = (CO × 1,000) ÷ HR", "(" + co + " × 1,000) ÷ " + hr + " = " + fmt(r(sv, 2)) + " → " + r(sv, 0) + " mL/beat (normal 60–100)"] };
 }},
 "map": { label: "MAP", f: function(){
   var s = ri(70, 190), dd = ri(38, Math.min(110, s - 20)), m = (s + 2 * dd) / 3;
   return { stem: "A client's BP is " + s + "/" + dd + ". Calculate the MAP in mm Hg.", unit: "mm Hg", ans: r(m, 0), d: 0,
     steps: ["MAP = (SBP + 2 × DBP) ÷ 3", "(" + s + " + " + (2 * dd) + ") ÷ 3 = " + fmt(r(m, 2)) + " → " + r(m, 0) + " mm Hg" + (r(m, 0) < 60 ? " (below 60 — organs are not perfused)" : "")] };
 }},
 "cpp": { label: "CPP", f: function(){
   var icp = ri(8, 35);
   if(Math.random() < 0.5){ var mp = ri(55, 110), c = mp - icp;
     return { stem: "MAP is " + mp + " mm Hg and ICP is " + icp + " mm Hg. Calculate the CPP in mm Hg.", unit: "mm Hg", ans: c, d: 0, steps: ["CPP = MAP − ICP", mp + " − " + icp + " = " + c + " mm Hg (normal 70–100; below 50 ischemia; below 30 necrosis)"] }; }
   var s = ri(90, 180), dd = ri(45, Math.min(105, s - 25)), m = r((s + 2 * dd) / 3, 0), cc = m - icp;
   return { stem: "BP is " + s + "/" + dd + " and ICP is " + icp + " mm Hg. Calculate the CPP in mm Hg. (Round the MAP to the nearest whole number first.)", unit: "mm Hg", ans: cc, d: 0,
     steps: ["MAP = (" + s + " + " + (2 * dd) + ") ÷ 3 = " + fmt(r((s + 2 * dd) / 3, 2)) + " → " + m, "CPP = " + m + " − " + icp + " = " + cc + " mm Hg"] };
 }},
 "io": { label: "Intake & output", f: function(){
   var items = [], tot = 0, steps = [];
   var juice = pick([4, 6, 8]), coffee = pick([1, 2]), ice = pick([0, 120, 200, 240]), iv = pick([0, 250, 500, 1000]), pb = pick([0, 50, 100]), soup = pick([0, 0.5, 1]);
   items.push(juice + " oz of juice"); steps.push(juice + " oz × 30 = " + juice * 30 + " mL"); tot += juice * 30;
   items.push(coffee + " cup" + (coffee > 1 ? "s" : "") + " of coffee"); steps.push(coffee + " cup × 240 = " + coffee * 240 + " mL"); tot += coffee * 240;
   if(soup){ items.push(soup + " cup of broth"); steps.push(soup + " cup × 240 = " + soup * 240 + " mL"); tot += soup * 240; }
   if(ice){ items.push(ice + " mL of ice chips"); steps.push(ice + " mL ice chips ÷ 2 = " + ice / 2 + " mL"); tot += ice / 2; }
   if(iv){ items.push(iv + " mL of IV fluid"); steps.push("IV " + iv + " mL"); tot += iv; }
   if(pb){ items.push("a " + pb + " mL IV piggyback"); steps.push("Piggyback " + pb + " mL"); tot += pb; }
   if(Math.random() < 0.5){
     return { stem: "Calculate the total intake in mL for this shift: " + items.join(", ") + ".", unit: "mL", ans: tot, d: 0, steps: steps.concat(["Total intake = " + tot + " mL"]) };
   }
   var u1 = ri(150, 450), u2 = ri(100, 400), em = pick([0, 100, 150, 200]), jp = pick([0, 30, 50, 75]), out = u1 + u2 + em + jp;
   var outs = ["urine " + u1 + " mL and " + u2 + " mL"]; if(em) outs.push("emesis " + em + " mL"); if(jp) outs.push("JP drain " + jp + " mL");
   return { stem: "Intake: " + items.join(", ") + ". Output: " + outs.join(", ") + ". What is the net fluid balance in mL? (Use a minus sign for a negative balance.)", unit: "mL", ans: tot - out, d: 0,
     steps: steps.concat(["Total intake = " + tot + " mL", "Total output = " + out + " mL", "Net = " + tot + " − " + out + " = " + (tot - out > 0 ? "+" : "") + (tot - out) + " mL"]) };
 }},
 "uo": { label: "Urine output (mL/kg/hr)", f: function(){
   var kg = ri(50, 120);
   if(Math.random() < 0.5){ return { stem: "A burned client weighs " + kg + " kg. The goal urine output is at least 0.5 mL/kg/hr. What is the minimum acceptable hourly urine output in mL?", unit: "mL/hr", ans: r(kg * 0.5, 1), d: 1, steps: ["0.5 × " + kg + " = " + fmt(r(kg * 0.5, 2)) + " mL/hr"] }; }
   var tot = ri(80, 400), hrs = pick([2, 4, 8]), rate = tot / hrs / kg;
   return { stem: "A " + kg + " kg client put out " + tot + " mL of urine over " + hrs + " hours. Calculate the urine output in mL/kg/hr.", unit: "mL/kg/hr", ans: r(rate, 2), d: 2,
     steps: [tot + " ÷ " + hrs + " hr = " + fmt(r(tot / hrs, 2)) + " mL/hr", fmt(r(tot / hrs, 2)) + " ÷ " + kg + " kg = " + fmt(r(rate, 3)) + " mL/kg/hr" + (r(rate, 2) < 0.5 ? " — below 0.5: report" : " — at or above 0.5")] };
 }}
};

/* ---------------- ABG generator ---------------- */
var ABG_TYPES = [["RAc","Respiratory acidosis"],["RAl","Respiratory alkalosis"],["MAc","Metabolic acidosis"],["MAl","Metabolic alkalosis"]];
var COMP = [["U","Uncompensated"],["P","Partially compensated"],["F","Fully compensated"]];
var CTX = { RAc: ["opioid overdose, RR 7", "benzodiazepine overdose", "COPD exacerbation", "post-op, heavily sedated", "chest trauma with shallow breathing"],
  RAl: ["panic attack", "early aspirin overdose", "therapeutic hyperventilation for IICP", "high fever, breathing fast", "mechanical ventilation rate set too high"],
  MAc: ["septic shock, lactate 5.8", "DKA", "acute kidney injury", "severe diarrhea", "cardiac arrest after ROSC", "emergent phase of a major burn"],
  MAl: ["prolonged vomiting", "continuous NG suction", "excessive antacid use", "loop diuretic with low potassium"] };
function genABG(){
  var t = pick(ABG_TYPES)[0], c = pick(["U","P","F"]), pH, co2, hco3;
  if(Math.random() < 0.06){ return { t: "N", c: "-", pH: rf(7.36, 7.44, 2), co2: ri(36, 44), hco3: ri(23, 25), pao2: ri(85, 99), ctx: "routine pre-op labs" }; }
  if(t === "RAc"){ co2 = ri(47, 70); hco3 = c === "U" ? ri(22, 26) : c === "P" ? ri(27, 33) : ri(28, 36); pH = c === "U" ? rf(7.20, 7.33, 2) : c === "P" ? rf(7.25, 7.34, 2) : rf(7.35, 7.38, 2); }
  if(t === "RAl"){ co2 = ri(22, 33); hco3 = c === "U" ? ri(22, 26) : c === "P" ? ri(17, 21) : ri(16, 21); pH = c === "U" ? rf(7.47, 7.58, 2) : c === "P" ? rf(7.46, 7.52, 2) : rf(7.42, 7.45, 2); }
  if(t === "MAc"){ hco3 = ri(10, 20); co2 = c === "U" ? ri(35, 45) : c === "P" ? ri(25, 33) : ri(22, 33); pH = c === "U" ? rf(7.18, 7.33, 2) : c === "P" ? rf(7.25, 7.34, 2) : rf(7.35, 7.38, 2); }
  if(t === "MAl"){ hco3 = ri(29, 40); co2 = c === "U" ? ri(35, 45) : c === "P" ? ri(46, 55) : ri(46, 58); pH = c === "U" ? rf(7.47, 7.58, 2) : c === "P" ? rf(7.46, 7.52, 2) : rf(7.42, 7.45, 2); }
  return { t: t, c: c, pH: pH, co2: co2, hco3: hco3, pao2: ri(60, 98), ctx: Math.random() < 0.6 ? pick(CTX[t]) : "" };
}
function cat(v, k){ // Acid / Normal / Base for each value
  if(k === "pH") return v < 7.35 ? "A" : v > 7.45 ? "B" : "N";
  if(k === "co2") return v > 45 ? "A" : v < 35 ? "B" : "N";
  return v < 22 ? "A" : v > 26 ? "B" : "N";
}
function arrow(v, k){ var lo = { pH: 7.35, co2: 35, hco3: 22 }[k], hi = { pH: 7.45, co2: 45, hco3: 26 }[k]; return v < lo ? "↓" : v > hi ? "↑" : "↔"; }
var CATN = { A: "Acid", N: "Normal", B: "Base" };
function tname(t){ return t === "N" ? "Normal ABG" : ABG_TYPES.filter(function(x){ return x[0] === t; })[0][1]; }
function cname(c){ return c === "-" ? "—" : COMP.filter(function(x){ return x[0] === c; })[0][1]; }
function explain(q){
  var A = cat(q.pH, "pH"), C = cat(q.co2, "co2"), H = cat(q.hco3, "hco3");
  var lines = [];
  lines.push("<b>Arrows:</b> pH " + arrow(q.pH, "pH") + " · PaCO₂ " + arrow(q.co2, "co2") + " · HCO₃ " + arrow(q.hco3, "hco3"));
  lines.push("<b>Tic-tac-toe:</b> pH = " + CATN[A] + (A === "N" ? (q.pH < 7.40 ? " (leans acid — below 7.40)" : q.pH > 7.40 ? " (leans base — above 7.40)" : "") : "") + " · PaCO₂ = " + CATN[C] + " · HCO₃ = " + CATN[H]);
  if(q.t === "N"){ lines.push("All three values are normal → <b>normal ABG</b>."); return lines; }
  var resp = q.t === "RAc" || q.t === "RAl";
  lines.push("<b>ROME:</b> " + (resp ? "pH and PaCO₂ move in <b>opposite</b> directions → <b>R</b>espiratory <b>O</b>pposite." : "pH and HCO₃ move in the <b>same</b> direction → <b>M</b>etabolic <b>E</b>qual."));
  lines.push("<b>Compensation:</b> " + (q.c === "U" ? "the other system is still normal → uncompensated." : q.c === "P" ? "the other system is moving to help, but the pH is still abnormal → partially compensated." : "both systems are abnormal and the pH is back in the normal range → fully compensated (the side of 7.40 tells you the original problem)."));
  return lines;
}

/* ---------------- styles ---------------- */
var css = ".px{margin:10px 0 4px;display:block}.px-stats{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:.86em;margin:0 0 8px;opacity:.85}.px-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}@media(max-width:600px){.px-chips{flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch}.px-chip{flex:0 0 auto}}" +
 ".px-chip{font:inherit;font-size:.8em;border:1.5px solid var(--line,#E2DFD3);background:var(--card,#fff);color:inherit;border-radius:999px;padding:4px 10px;cursor:pointer}.px-chip[aria-pressed=true]{background:#1F3A5F;border-color:#1F3A5F;color:#fff}" +
 ".px-card{background:var(--card,#fff);border:1.5px solid var(--line,#E2DFD3);border-radius:14px;padding:14px 16px}.px-type{font-size:.72em;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#117864;margin-bottom:6px}" +
 ".px-stem{font-size:1.05em;line-height:1.45;font-weight:600;margin-bottom:10px}.px-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.px-in{font:inherit;font-size:1.1em;width:9em;padding:8px 10px;border:2px solid var(--line,#ccc);border-radius:9px;background:var(--bg,#fff);color:inherit}" +
 ".px-btn{font:inherit;font-weight:700;border:0;border-radius:9px;padding:9px 16px;background:#1F3A5F;color:#fff;cursor:pointer}.px-btn[disabled]{opacity:.45;cursor:default}.px-btn.ghost{background:transparent;color:inherit;border:1.5px solid var(--line,#ccc);font-weight:600}" +
 ".px-fb{margin-top:12px;border-radius:10px;padding:10px 12px;line-height:1.5}.px-ok{background:#E3F4E9;border:1.5px solid #1E7D45}.px-no{background:#FBE7E5;border:1.5px solid #B3261E}" +
 "[data-theme=dark] .px-ok{background:#163323}[data-theme=dark] .px-no{background:#3D1A18}[data-theme=dark] .px-chip[aria-pressed=true]{background:#8FB0DC;color:#111}" +
 ".px-steps{margin:6px 0 0 1.1em;padding:0}.px-gas{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:4px 0 10px}.px-val{border:1.5px solid var(--line,#ccc);border-radius:10px;padding:8px;text-align:center}" +
 ".px-val b{display:block;font-size:1.3em}.px-val span{font-size:.75em;opacity:.7}.px-grp{margin:8px 0}.px-glab{font-size:.78em;font-weight:800;text-transform:uppercase;letter-spacing:.06em;opacity:.7;margin-bottom:4px}" +
 ".px-opts{display:flex;flex-wrap:wrap;gap:6px}.px-o{font:inherit;font-size:.9em;border:2px solid var(--line,#ccc);background:var(--card,#fff);color:inherit;border-radius:9px;padding:7px 10px;cursor:pointer}" +
 ".px-o[aria-pressed=true]{border-color:#1F3A5F;background:#E9EEF5}[data-theme=dark] .px-o[aria-pressed=true]{background:#1D2A3B;border-color:#8FB0DC}.px-o.good{border-color:#1E7D45;background:#E3F4E9}.px-o.bad{border-color:#B3261E;background:#FBE7E5}" +
 "[data-theme=dark] .px-o.good{background:#163323}[data-theme=dark] .px-o.bad{background:#3D1A18}.px-ttt{display:grid;grid-template-columns:auto repeat(3,1fr);gap:6px;align-items:center;margin:6px 0}.px-ttt .px-h{font-size:.75em;font-weight:800;text-align:center;opacity:.7}" +
 ".px-ttt .px-o{width:100%;text-align:center;padding:8px 2px}.px-note{font-size:.82em;opacity:.75;margin-top:8px}.px-reset{font:inherit;font-size:.78em;background:none;border:0;color:inherit;opacity:.6;text-decoration:underline;cursor:pointer;padding:0}";
var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

/* ---------------- game ---------------- */
function Game(el){
  this.el = el; this.kind = el.getAttribute("data-gen");
  this.S = load(); this.g = this.S[this.kind] || (this.S[this.kind] = { n: 0, ok: 0, streak: 0, best: 0, by: {}, filter: "all", cur: null, sel: {}, done: false });
  if(this.kind === "math"){
    var keys = (typeof MODULE !== "undefined" && MODULE.practiceMath) || Object.keys(MATH);
    this.keys = keys.filter(function(k){ return MATH[k]; });
  }
  if(!this.g.cur) this.next(true);
  var self = this;
  el.addEventListener("click", function(e){ self.click(e); });
  el.addEventListener("keydown", function(e){ if(e.key === "Enter" && e.target.classList.contains("px-in")){ e.preventDefault(); if(!self.g.done) self.check(); else self.next(); } });
  this.render();
}
Game.prototype.persist = function(){ this.S[this.kind] = this.g; save(this.S); };
Game.prototype.next = function(silent){
  var g = this.g;
  if(this.kind === "math"){
    var pool = g.filter && g.filter !== "all" && MATH[g.filter] ? [g.filter] : this.keys;
    // adaptive: weight types the student misses more often
    var w = pool.map(function(k){ var b = g.by[k] || [0, 0]; return 0.35 + (b[1] ? 1 - b[0] / b[1] : 0.65); });
    var tot = w.reduce(function(a, b){ return a + b; }, 0), x = Math.random() * tot, k = pool[0];
    for(var i = 0; i < pool.length; i++){ x -= w[i]; if(x <= 0){ k = pool[i]; break; } }
    var q = MATH[k].f(); q.k = k; g.cur = q;
  } else { g.cur = genABG(); }
  g.sel = {}; g.done = false; g.input = "";
  this.persist(); if(!silent) this.render();
};
Game.prototype.stats = function(){
  var g = this.g, pct = g.n ? Math.round(g.ok / g.n * 100) : 0;
  return '<div class="px-stats"><span>Answered <b>' + g.n + '</b></span><span>Correct <b>' + pct + '%</b></span><span>Streak <b>' + g.streak + '</b></span><span>Best <b>' + g.best + '</b></span>' +
    '<button class="px-reset" data-act="reset" type="button">Reset stats</button></div>';
};
Game.prototype.render = function(){
  var g = this.g, q = g.cur, h = this.stats();
  if(this.kind === "math"){
    var self = this;
    h += '<div class="px-chips">' + [["all", "All exam-focus"]].concat(this.keys.map(function(k){ return [k, MATH[k].label]; })).map(function(c){
      return '<button class="px-chip" type="button" data-filter="' + c[0] + '" aria-pressed="' + ((g.filter || "all") === c[0]) + '">' + esc(c[1]) + (c[0] !== "all" && g.by[c[0]] ? " · " + Math.round(g.by[c[0]][0] / g.by[c[0]][1] * 100) + "%" : "") + '</button>';
    }).join("") + '</div>';
    h += '<div class="px-card"><div class="px-type">' + esc(MATH[q.k].label) + '</div><div class="px-stem">' + esc(q.stem) + ' ' + RND[q.d] + '</div>';
    h += '<div class="px-row"><input class="px-in" type="text" inputmode="decimal" autocomplete="off" aria-label="Your answer" value="' + esc(g.input || "") + '"' + (g.done ? " disabled" : "") + '><span>' + esc(q.unit) + '</span>' +
      (g.done ? '<button class="px-btn" data-act="next" type="button">Next problem →</button>' : '<button class="px-btn" data-act="check" type="button">Check</button>') + '</div>';
    if(g.done){
      h += '<div class="px-fb ' + (g.last ? "px-ok" : "px-no") + '"><b>' + (g.last ? "Correct!" : "Not quite.") + '</b> Answer: <b>' + fmt(q.ans) + " " + esc(q.unit) + '</b>' +
        '<ol class="px-steps">' + q.steps.map(function(s){ return "<li>" + esc(s) + "</li>"; }).join("") + '</ol></div>';
    }
    h += '</div>';
  } else {
    var rome = this.kind === "abg-rome";
    h += '<div class="px-card"><div class="px-type">' + (rome ? "ROME boxes" : "Interpret the gas") + '</div>';
    if(q.ctx) h += '<div class="px-stem" style="font-weight:500">Client: ' + esc(q.ctx) + '</div>';
    h += '<div class="px-gas"><div class="px-val"><span>pH</span><b>' + q.pH.toFixed(2) + '</b><span>7.35–7.45</span></div><div class="px-val"><span>PaCO₂</span><b>' + q.co2 + '</b><span>35–45</span></div><div class="px-val"><span>HCO₃</span><b>' + q.hco3 + '</b><span>22–26</span></div></div>';
    var sel = g.sel, done = g.done;
    function obtn(group, val, label, correct){
      var cls = "px-o"; if(done){ if(val === correct) cls += " good"; else if(sel[group] === val) cls += " bad"; }
      return '<button class="' + cls + '" type="button" data-g="' + group + '" data-v="' + val + '" aria-pressed="' + (sel[group] === val) + '"' + (done ? " disabled" : "") + '>' + label + '</button>';
    }
    if(rome){
      h += '<div class="px-grp"><div class="px-glab">Step 1 — Mark each value</div><div class="px-ttt"><span></span><span class="px-h">Acid</span><span class="px-h">Normal</span><span class="px-h">Base</span>';
      [["pH","pH","pH"],["co2","PaCO₂","co2"],["hco3","HCO₃","hco3"]].forEach(function(v){
        var correct = cat(q[v[0]], v[2]);
        h += '<span class="px-h" style="text-align:left">' + v[1] + '</span>' + ["A","N","B"].map(function(c){ return obtn("b_" + v[0], c, CATN[c], correct); }).join("");
      });
      h += '</div></div><div class="px-glab">Step 2 — Interpret</div>';
    }
    h += '<div class="px-grp"><div class="px-glab">Imbalance</div><div class="px-opts">' + ABG_TYPES.concat([["N","Normal ABG"]]).map(function(t){ return obtn("t", t[0], t[1], q.t); }).join("") + '</div></div>';
    h += '<div class="px-grp"><div class="px-glab">Compensation</div><div class="px-opts">' + COMP.concat([["-","Not applicable (normal)"]]).map(function(c){ return obtn("c", c[0], c[1], q.c); }).join("") + '</div></div>';
    h += '<div class="px-row" style="margin-top:10px">' + (done ? '<button class="px-btn" data-act="next" type="button">Next gas →</button>' : '<button class="px-btn" data-act="check" type="button"' + (this.ready() ? "" : " disabled") + '>Check</button>') + '</div>';
    if(done){
      h += '<div class="px-fb ' + (g.last ? "px-ok" : "px-no") + '"><b>' + (g.last ? "Correct!" : "Not quite.") + '</b> ' + tname(q.t) + (q.t === "N" ? "" : ", " + cname(q.c).toLowerCase()) +
        '<ul class="px-steps">' + explain(q).map(function(s){ return "<li>" + s + "</li>"; }).join("") + '</ul></div>';
    }
    h += '</div>';
  }
  h += '<div class="px-note">Every problem is new. Your progress saves automatically on this device — come back anytime to pick up where you left off.</div>';
  this.el.innerHTML = h;
};
Game.prototype.ready = function(){
  var s = this.g.sel; if(!s.t || !s.c) return false;
  if(this.kind === "abg-rome") return !!(s.b_pH && s.b_co2 && s.b_hco3);
  return true;
};
Game.prototype.score = function(ok){
  var g = this.g, k = this.kind === "math" ? g.cur.k : g.cur.t + g.cur.c;
  g.n++; if(ok){ g.ok++; g.streak++; if(g.streak > g.best) g.best = g.streak; } else g.streak = 0;
  var b = g.by[k] || (g.by[k] = [0, 0]); b[1]++; if(ok) b[0]++;
  g.last = ok; g.done = true; this.persist(); this.render();
  var f = this.el.querySelector(".px-btn[data-act=next]"); if(f) f.focus({ preventScroll: true });
};
Game.prototype.check = function(){
  var g = this.g, q = g.cur;
  if(this.kind === "math"){
    var inp = this.el.querySelector(".px-in"); var raw = (inp.value || "").replace(/,/g, "").replace(/[^\d.\-+]/g, "");
    if(raw === "" || isNaN(parseFloat(raw))){ inp.focus(); return; }
    g.input = inp.value; var v = parseFloat(raw), tol = q.d === 0 ? 0.05 : q.d === 1 ? 0.05 : 0.005;
    this.score(Math.abs(v - q.ans) < tol + 1e-9);
    return;
  }
  if(!this.ready()) return;
  var s = g.sel, ok = s.t === q.t && s.c === q.c;
  if(this.kind === "abg-rome") ok = ok && s.b_pH === cat(q.pH, "pH") && s.b_co2 === cat(q.co2, "co2") && s.b_hco3 === cat(q.hco3, "hco3");
  this.score(ok);
};
Game.prototype.click = function(e){
  var b = e.target.closest("button"); if(!b || b.disabled) return;
  var g = this.g;
  if(b.dataset.filter){ g.filter = b.dataset.filter; this.next(); return; }
  if(b.dataset.act === "check"){ this.check(); return; }
  if(b.dataset.act === "next"){ this.next(); var top = this.el.getBoundingClientRect().top + window.pageYOffset - 90; if(top < window.pageYOffset) window.scrollTo(0, top); return; }
  if(b.dataset.act === "reset"){
    if(!b.dataset.armed){ b.dataset.armed = "1"; b.textContent = "Tap again to reset your stats"; var bb = b; setTimeout(function(){ if(bb.isConnected){ delete bb.dataset.armed; bb.textContent = "Reset stats"; } }, 4000); return; }
    this.g = this.S[this.kind] = { n: 0, ok: 0, streak: 0, best: 0, by: {}, filter: g.filter, cur: g.cur, sel: g.sel, done: g.done, last: g.last, input: g.input }; this.persist(); this.render(); return; }
  if(b.dataset.g){ g.sel[b.dataset.g] = b.dataset.v; this.persist(); this.render(); }
};
function mountAll(root){
  (root || document).querySelectorAll(".px-mount:not([data-ready])").forEach(function(el){
    el.setAttribute("data-ready", "1"); var d = document.createElement("div"); d.className = "px"; d.setAttribute("data-gen", el.getAttribute("data-gen")); el.replaceWith(d); new Game(d);
  });
}
window.NUR114_PRACTICE = { MATH: MATH, genABG: genABG, cat: cat, key: KEY };
mountAll();
new MutationObserver(function(){ if(document.querySelector(".px-mount:not([data-ready])")) mountAll(); }).observe(document.body, { childList: true, subtree: true });
})();
