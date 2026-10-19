/* Tiny SVG plotter shared by lab.js and designer.js. Colours are CSS variables, so plots follow the theme. */
(function(){
  let uid = 0;
  function niceTicks(min, max, n){
    const span = max - min; if(!(span > 0)) return [min];
    const raw = span / (n || 5), mag = Math.pow(10, Math.floor(Math.log10(raw))), e = raw / mag;
    const step = (e >= 7.5 ? 10 : e >= 3.5 ? 5 : e >= 1.5 ? 2 : 1) * mag;
    const out = [];
    for(let v = Math.ceil(min / step - 1e-9) * step; v <= max + step * 1e-9; v += step) out.push(+v.toPrecision(12));
    return out;
  }
  function decades(min, max){
    const out = [];
    for(let k = Math.ceil(Math.log10(min) - 1e-9); k <= Math.floor(Math.log10(max) + 1e-9); k++) out.push(Math.pow(10, k));
    return out;
  }
  function supExp(v){
    const k = Math.round(Math.log10(v));
    if(k >= -2 && k <= 3) return String(+v.toPrecision(3));
    return '10' + String(k).split('').map(c => '⁰¹²³⁴⁵⁶⁷⁸⁹'['0123456789'.indexOf(c)] || (c === '-' ? '⁻' : c)).join('');
  }
  const esc = s => String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

  /* o: {x:[min,max], y:[min,max], logx, logy, W, H, m, xlabel, ylabel, xfmt, yfmt, xticks, yticks,
         series:[{pts, color, w, dash, fill, op}], vlines:[{x,color,dash,label}], hlines:[{y,...}], extra:(X,Y)=>svg} */
  function plot(svg, o){
    const W = o.W || 640, H = o.H || 300;
    const m = Object.assign({l:60, r:16, t:14, b:44}, o.m || {});
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const lx = o.logx, ly = o.logy;
    const fx = v => lx ? Math.log10(v) : v, fy = v => ly ? Math.log10(v) : v;
    const x0 = fx(o.x[0]), x1 = fx(o.x[1]), y0 = fy(o.y[0]), y1 = fy(o.y[1]);
    const X = v => m.l + (fx(Math.max(v, lx ? o.x[0] * 1e-3 : -Infinity)) - x0) / (x1 - x0) * pw;
    const Y = v => m.t + ph - (fy(ly ? Math.max(v, o.y[0] * 1e-3) : v) - y0) / (y1 - y0) * ph;
    const id = 'clip' + (++uid);
    let s = '<defs><clipPath id="' + id + '"><rect x="' + m.l + '" y="' + m.t + '" width="' + pw + '" height="' + ph + '"/></clipPath></defs>';
    const xt = o.xticks || (lx ? decades(o.x[0], o.x[1]) : niceTicks(o.x[0], o.x[1], o.xn || 6));
    const yt = o.yticks || (ly ? decades(o.y[0], o.y[1]) : niceTicks(o.y[0], o.y[1], o.yn || 5));
    const xf = o.xfmt || (lx ? supExp : v => String(+v.toPrecision(4)));
    const yf = o.yfmt || (ly ? supExp : v => String(+v.toPrecision(4)));
    xt.forEach(v => { const px = X(v).toFixed(1); s += '<line class="grid" x1="' + px + '" x2="' + px + '" y1="' + m.t + '" y2="' + (m.t + ph) + '"/><text class="ts t-mut t-mono" x="' + px + '" y="' + (m.t + ph + 16) + '" text-anchor="middle">' + esc(xf(v)) + '</text>'; });
    yt.forEach(v => { const py = Y(v).toFixed(1); s += '<line class="grid" y1="' + py + '" y2="' + py + '" x1="' + m.l + '" x2="' + (m.l + pw) + '"/><text class="ts t-mut t-mono" x="' + (m.l - 6) + '" y="' + (+py + 4) + '" text-anchor="end">' + esc(yf(v)) + '</text>'; });
    s += '<rect x="' + m.l + '" y="' + m.t + '" width="' + pw + '" height="' + ph + '" style="fill:none;stroke:var(--line)"/>';
    if(o.xlabel) s += '<text class="ts t-mut" x="' + (m.l + pw / 2) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(o.xlabel) + '</text>';
    if(o.ylabel) s += '<text class="ts t-mut" x="14" y="' + (m.t + ph / 2) + '" text-anchor="middle" transform="rotate(-90 14 ' + (m.t + ph / 2) + ')">' + esc(o.ylabel) + '</text>';
    s += '<g clip-path="url(#' + id + ')">';
    (o.series || []).forEach(se => {
      const pts = se.pts.filter(p => isFinite(p[0]) && isFinite(p[1]) && (!ly || p[1] > 0) && (!lx || p[0] > 0));
      if(pts.length < 2) return;
      const d = pts.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join('');
      if(se.fill){
        const base = Y(ly ? o.y[0] : Math.max(o.y[0], 0)).toFixed(1);
        s += '<path d="' + d + 'L' + X(pts[pts.length - 1][0]).toFixed(1) + ' ' + base + 'L' + X(pts[0][0]).toFixed(1) + ' ' + base + 'Z" style="fill:' + se.color + ';fill-opacity:' + (se.op || .18) + ';stroke:none"/>';
      }
      s += '<path d="' + d + '" style="fill:none;stroke:' + se.color + ';stroke-width:' + (se.w || 2) + ';stroke-linejoin:round;stroke-linecap:round' + (se.dash ? ';stroke-dasharray:' + se.dash : '') + '"/>';
    });
    s += (o.extra ? o.extra(X, Y) : '') + '</g>';
    (o.vlines || []).forEach(v => {
      if(v.x < o.x[0] || v.x > o.x[1]) return;
      const px = X(v.x).toFixed(1);
      s += '<line x1="' + px + '" x2="' + px + '" y1="' + m.t + '" y2="' + (m.t + ph) + '" style="stroke:' + (v.color || 'var(--muted)') + ';stroke-width:' + (v.w || 1.4) + (v.dash !== false ? ';stroke-dasharray:' + (v.dash || '5 4') : '') + '"/>';
      if(v.label) s += '<text class="ts" x="' + (+px + (v.anchor === 'end' ? -4 : 4)) + '" y="' + (m.t + 12 + (v.dy || 0)) + '" text-anchor="' + (v.anchor || 'start') + '" style="fill:' + (v.color || 'var(--muted)') + '">' + esc(v.label) + '</text>';
    });
    (o.hlines || []).forEach(h => {
      if(h.y < o.y[0] || h.y > o.y[1]) return;
      const py = Y(h.y).toFixed(1);
      s += '<line y1="' + py + '" y2="' + py + '" x1="' + m.l + '" x2="' + (m.l + pw) + '" style="stroke:' + (h.color || 'var(--muted)') + ';stroke-width:1.4;stroke-dasharray:5 4"/>';
      if(h.label) s += '<text class="ts" x="' + (m.l + pw - 4) + '" y="' + (+py - 5) + '" text-anchor="end" style="fill:' + (h.color || 'var(--muted)') + '">' + esc(h.label) + '</text>';
    });
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.innerHTML = s;
    return {X, Y, m, pw, ph};
  }

  /* math helpers */
  function erfc(x){ // Numerical Recipes erfcc, fractional error < 1.2e-7
    const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
    const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? r : 2 - r;
  }
  const Phi = z => 0.5 * erfc(-z / Math.SQRT2);       // P(Z < z)
  const Q = z => 0.5 * erfc(z / Math.SQRT2);          // P(Z > z)
  function fmtSI(v, unit, digits){
    if(!isFinite(v)) return '—';
    const a = Math.abs(v), P = [[1e12,'T'],[1e9,'G'],[1e6,'M'],[1e3,'k'],[1,''],[1e-3,'m'],[1e-6,'µ'],[1e-9,'n'],[1e-12,'p'],[1e-15,'f']];
    if(a === 0) return '0 ' + unit;
    for(const [k, p] of P) if(a >= k * 0.9995){
      let s = (v / k).toPrecision(digits || 3);
      if(s.indexOf('.') >= 0 && s.indexOf('e') < 0) s = s.replace(/0+$/, '').replace(/\.$/, '');   // trim decimal zeros only, never "100" -> "1"
      return s + ' ' + p + unit;
    }
    return v.toExponential(2) + ' ' + unit;
  }
  function fmtSci(v){
    if(!isFinite(v)) return '—';
    if(v === 0) return '0';
    if(Math.abs(v) >= 1e-2 && Math.abs(v) < 1e4) return String(+v.toPrecision(3));
    const k = Math.floor(Math.log10(Math.abs(v))), mnt = v / Math.pow(10, k);
    return mnt.toFixed(1) + '×10' + String(k).split('').map(c => c === '-' ? '⁻' : '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]).join('');
  }
  window.MemPlot = {plot, niceTicks, erfc, Phi, Q, fmtSI, fmtSci};
})();
