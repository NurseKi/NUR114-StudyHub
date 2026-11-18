/* Shared display settings, applied in <head> before first paint (no flash of the wrong theme/size).
   Reads localStorage "nur114-m<N>:settings" (N = <html data-mod>) = {v:1, theme:"dark"|"light" (absent = follow device), fs:0.9|1|1.1|1.2|1.3, examOnly:bool}.
   extras.js owns the full logic; this only sets <html data-theme> and the --fz text-size variable. */
(function(){try{
  var d = document.documentElement, s = null;
  try{ s = JSON.parse(localStorage.getItem("nur114-m" + (d.getAttribute("data-mod") || "0") + ":settings") || "null"); }catch(e){}
  if(!s || typeof s !== "object") s = {};
  var t = (s.theme === "dark" || s.theme === "light") ? s.theme : ((window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light");
  d.setAttribute("data-theme", t);
  var f = +s.fs; if([0.9, 1.1, 1.2, 1.3].indexOf(f) >= 0){ d.style.setProperty("--fz", String(f)); d.setAttribute("data-fz", String(f)); }
}catch(e){}})();
