/* Memory Lab — five small simulations: DRAM read, SRAM butterfly/SNM, NAND Vt distributions, DRAM retention vs refresh, March test fault simulation. */
(function(){
  const t = (window.MemSite && window.MemSite.t) || (zh => zh);
  const {plot, Phi, Q, fmtSci} = window.MemPlot;
  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------- small UI helpers ---------- */
  function metrics(el, arr){
    el.innerHTML = arr.map(m => '<div class="metric ' + (m.cls || '') + '"><div class="ml">' + m.l + '</div><div class="mv">' + m.v +
      (m.u ? ' <small>' + m.u + '</small>' : '') + '</div>' + (m.s ? '<div class="ms">' + m.s + '</div>' : '') + '</div>').join('');
  }
  function toggle(id, onChange){
    const box = $(id);
    box.addEventListener('click', e => {
      const b = e.target.closest('button[data-v]'); if(!b) return;
      box.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
      onChange(b.dataset.v);
    });
    return () => box.querySelector('[aria-pressed="true"]').dataset.v;
  }
  function range(id, fmt, onChange){
    const el = $(id), out = $(id + '-o');
    const upd = () => { if(out) out.textContent = fmt(+el.value); };
    el.addEventListener('input', () => { upd(); onChange(); });
    upd();
    return {get: () => +el.value, set: v => { el.value = v; upd(); }, el};
  }
  const fmtT = s => s < 1e-3 ? (s * 1e6).toPrecision(3) + ' µs' : s < 1 ? +(s * 1e3).toPrecision(3) + ' ms' : +s.toPrecision(3) + ' s';

  /* ---------- tabs ---------- */
  const tabs = [...document.querySelectorAll('[role=tab]')];
  const inited = {};
  function show(name){
    if(!document.getElementById('tab-' + name)) name = 'dram';
    tabs.forEach(t => t.setAttribute('aria-selected', t.dataset.tab === name ? 'true' : 'false'));
    document.querySelectorAll('.tabp').forEach(p => p.hidden = p.id !== 'tab-' + name);
    if(!inited[name]){ inited[name] = true; INIT[name](); }
    if(location.hash.slice(1) !== name) history.replaceState(null, '', '#' + name);
  }
  tabs.forEach(t => t.addEventListener('click', () => show(t.dataset.tab)));
  window.addEventListener('hashchange', () => show(location.hash.slice(1)));

  const INIT = {};

  /* =====================================================================
     1. DRAM read: charge sharing, sense amp offset, leakage before read
     ===================================================================== */
  INIT.dram = function(){
    let bit = 1, cursor = 40, raf = 0;
    const getBit = toggle('dr-bit', v => { bit = +v; render(); });
    const vdd = range('dr-vdd', v => v.toFixed(2) + ' V', render);
    const cs = range('dr-cs', v => v + ' fF', render);
    const cbl = range('dr-cbl', v => v + ' fF', render);
    const off = range('dr-off', v => v + ' mV', render);
    const temp = range('dr-temp', v => v + ' °C', render);
    const twr = range('dr-tw', v => fmtT(tw(v)), render);
    $('dr-cell').addEventListener('change', render);
    function tw(v){ return Math.pow(10, -3 + 4 * v / 100); }

    function params(){ return {bit, vdd:vdd.get(), cs:cs.get(), cbl:cbl.get(), off:off.get(), tau85:+$('dr-cell').value, T:temp.get(), tw:tw(twr.get())}; }
    function model(p){
      const tau = p.tau85 * Math.pow(2, (85 - p.T) / 10);
      const vc0 = p.bit ? p.vdd * Math.exp(-p.tw / tau) : 0;
      const r = p.cs / (p.cs + p.cbl);
      const dv = (vc0 - p.vdd / 2) * r;
      const sig = p.bit ? dv : -dv;
      const ok = sig * 1000 > p.off;
      return {tau, vc0, r, dv, sig, ok, decided: ok ? p.bit : 1 - p.bit};
    }
    function wave(p, M, tm){
      const vh = p.vdd / 2, vs = vh + M.dv, vpp = p.vdd * 1.25;
      let wl = 0;
      if(tm >= 5 && tm < 7) wl = vpp * (tm - 5) / 2; else if(tm >= 7 && tm < 26) wl = vpp; else if(tm >= 26 && tm < 28) wl = vpp * (1 - (tm - 26) / 2);
      const sh = tt => 1 - Math.exp(-Math.max(0, tt - 6) / 1.2);
      let bl = vh, blb = vh, cell = M.vc0;
      if(tm >= 6){ const u = sh(Math.min(tm, 14)); bl = vh + (vs - vh) * u; cell = vs + (M.vc0 - vs) * (1 - u); }
      if(tm >= 14){
        const tgt = M.decided ? p.vdd : 0, tgtb = p.vdd - tgt;
        const bl14 = vh + (vs - vh) * sh(14), c14 = vs + (M.vc0 - vs) * (1 - sh(14));
        const ta = Math.min(tm, 30) - 14;
        bl = tgt + (bl14 - tgt) * Math.exp(-ta / 1.8);
        blb = tgtb + (vh - tgtb) * Math.exp(-ta / 1.8);
        cell = tgt + (c14 - tgt) * Math.exp(-(Math.min(tm, 27) - 14) / 3);
        if(tm >= 30){ const k = Math.exp(-(tm - 30) / 1.2); bl = vh + (bl - vh) * k; blb = vh + (blb - vh) * k; }
      }
      return {bl, blb, cell, wl};
    }
    const phase = tm => tm < 5 ? t('① 預充 V<sub>DD</sub>/2', '① Precharge to V<sub>DD</sub>/2') : tm < 14 ? t('② 字元線開啟 · 電荷分享', '② WL on · charge sharing') : tm < 26 ? t('③ SA 放大 + ④ 回寫', '③ SA amplify + ④ restore') : tm < 30 ? t('字元線關閉', 'WL off') : t('⑤ 預充', '⑤ Precharge');

    function drawSch(p, M, tm){
      const w = wave(p, M, tm), H = 160, top = 44;
      const g = (x, v, label, col) => {
        const h = clamp(v / p.vdd, 0, 1) * H;
        return '<rect x="' + x + '" y="' + top + '" width="60" height="' + H + '" rx="4" style="fill:var(--sunk);stroke:var(--line)"/>' +
          '<rect x="' + x + '" y="' + (top + H - h).toFixed(1) + '" width="60" height="' + h.toFixed(1) + '" rx="4" style="fill:' + col + ';fill-opacity:.55"/>' +
          '<line x1="' + (x - 4) + '" x2="' + (x + 64) + '" y1="' + (top + H / 2) + '" y2="' + (top + H / 2) + '" style="stroke:var(--muted);stroke-dasharray:3 3"/>' +
          '<text x="' + (x + 30) + '" y="' + (top + H + 18) + '" text-anchor="middle" class="ts">' + label + '</text>' +
          '<text x="' + (x + 30) + '" y="' + (top + H + 34) + '" text-anchor="middle" class="ts t-mono t-mut">' + Math.round(v * 1000) + ' mV</text>';
      };
      const on = w.wl > p.vdd * 0.6, saOn = tm >= 14 && tm < 30;
      let s = '<line x1="16" x2="304" y1="20" y2="20" style="stroke:var(--accent);stroke-width:3;opacity:' + (on ? 1 : .25) + '"/>' +
        '<text x="16" y="14" class="ts t-mono">WL ' + (on ? 'ON (V<tspan dy="2" class="ts">PP</tspan><tspan dy="-2">)</tspan>' : 'OFF') + '</text>';
      s += g(24, w.cell, t('單元 SN', 'Cell SN'), 'var(--s3)') + g(130, w.bl, 'BL', 'var(--s1)') + g(236, w.blb, 'BLB', 'var(--s2)');
      s += on ? '<line x1="84" x2="130" y1="124" y2="124" style="stroke:var(--accent);stroke-width:3"/>'
              : '<line x1="84" x2="100" y1="124" y2="124" style="stroke:var(--muted);stroke-width:2"/><line x1="114" x2="130" y1="124" y2="124" style="stroke:var(--muted);stroke-width:2"/>';
      s += '<rect x="193" y="104" width="40" height="40" rx="5" style="fill:' + (saOn ? 'var(--accent)' : 'var(--surface)') + ';stroke:var(--ink)"/>' +
        '<text x="213" y="129" text-anchor="middle" class="ts" style="fill:' + (saOn ? 'var(--accent-ink)' : 'var(--ink)') + '">SA</text>';
      const svg = $('dr-sch');
      svg.setAttribute('viewBox', '0 0 320 250');
      svg.innerHTML = s;
      $('dr-phase').innerHTML = phase(tm);
    }
    function drawWave(p, M, tm){
      const pts = {bl:[], blb:[], cell:[], wl:[]};
      for(let x = 0; x <= 40.001; x += 0.2){ const w = wave(p, M, x); pts.bl.push([x, w.bl]); pts.blb.push([x, w.blb]); pts.cell.push([x, w.cell]); pts.wl.push([x, w.wl * 0.8]); }
      plot($('dr-wave'), {x:[0, 40], y:[-0.05, p.vdd * 1.12], xlabel:t('時間 (ns)', 'Time (ns)'), ylabel:t('電壓 (V)', 'Voltage (V)'), W:420, H:330, m:{l:50, r:12, t:12, b:44},
        series:[{pts:pts.wl, color:'var(--muted)', w:1.4, dash:'4 3'}, {pts:pts.cell, color:'var(--s3)', w:2}, {pts:pts.blb, color:'var(--s2)', w:2}, {pts:pts.bl, color:'var(--s1)', w:2.4}],
        vlines: tm < 40 ? [{x:tm, color:'var(--ink)', dash:false, w:1}] : []});
    }
    function drawRet(p, M){
      const r = M.r, half = p.vdd / 2 * r * 1000;
      const curve = T => { const tau = p.tau85 * Math.pow(2, (85 - T) / 10), a = []; for(let k = -3; k <= 1.001; k += 0.04){ const t = Math.pow(10, k); a.push([t, (p.vdd * Math.exp(-t / tau) - p.vdd / 2) * r * 1000]); } return a; };
      const win = p.T > 85 ? 0.032 : 0.064;
      plot($('dr-ret'), {x:[1e-3, 10], logx:true, y:[-half * 1.05, half * 1.1], xlabel:t('距上次寫入 / 更新的時間 (s)', 'Time since last write / refresh (s)'), ylabel:'ΔV (mV)', H:240,
        xfmt: v => v < 1 ? (v * 1000) + ' ms' : v + ' s',
        series:[{pts:curve(45), color:'var(--muted)', w:1.6}, {pts:curve(p.T), color:'var(--accent)', w:2.6}],
        hlines:[{y:p.off, color:'var(--bad)', label:t('SA 偏移 ', 'SA offset ') + p.off + ' mV'}, {y:0, color:'var(--line)'}],
        vlines:[{x:p.tw, color:'var(--ink)', label:t('目前', 'now'), dash:false, w:1.2}, {x:win, color:'var(--warn)', label:'tREFW ' + (win * 1000) + ' ms', dy:16}]});
    }
    function render(){
      const p = params(), M = model(p);
      metrics($('dr-metrics'), [
        {l:t('讀取前單元電壓', 'Cell voltage before read'), v:(M.vc0).toFixed(3), u:'V', s:t('保存時間常數 τ = ', 'Retention time constant τ = ') + fmtT(M.tau)},
        {l:t('電荷轉移比 C<sub>s</sub>/(C<sub>s</sub>+C<sub>BL</sub>)', 'Transfer ratio C<sub>s</sub>/(C<sub>s</sub>+C<sub>BL</sub>)'), v:(M.r * 100).toFixed(1), u:'%'},
        {l:t('位元線訊號 ΔV', 'Bit-line signal ΔV'), v:(M.dv * 1000).toFixed(1), u:'mV', cls: M.ok ? 'ok' : 'bad'},
        {l:t('扣除 SA 偏移後的裕度', 'Margin after SA offset'), v:(M.sig * 1000 - p.off).toFixed(1), u:'mV', cls: M.ok ? 'ok' : 'bad'},
        {l:t('讀取結果', 'Read result'), v: M.ok ? t('正確', 'Correct') : t('讀錯', 'Wrong'), cls: M.ok ? 'ok' : 'bad', s: M.ok ? t('讀出 ', 'Read ') + p.bit + t('，並回寫', ', restored') : t('讀成 ', 'Read as ') + M.decided + t('，錯誤值被回寫', ', wrong value restored')}
      ]);
      drawSch(p, M, cursor); drawWave(p, M, cursor); drawRet(p, M);
    }
    $('dr-play').addEventListener('click', () => {
      cancelAnimationFrame(raf);
      let last = performance.now(); cursor = 0;
      const p = params(), M = model(p);
      const step = now => {
        cursor = Math.min(40, cursor + (now - last) / 1000 * 9); last = now;
        drawSch(p, M, cursor); drawWave(p, M, cursor);
        if(cursor < 40) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });
    void getBit;
    render();
  };

  /* =====================================================================
     2. SRAM 6T butterfly curve and static noise margin (Seevinck 45° method)
     ===================================================================== */
  function ids(vov, vds, k){
    if(vds <= 0) return 0;
    const nvt = 1.4 * 0.02585, veff = 2 * nvt * Math.log1p(Math.exp(vov / (2 * nvt)));
    if(vds >= veff) return 0.5 * k * veff * veff * (1 + 0.08 * (vds - veff));
    return k * (veff * vds - 0.5 * vds * vds);
  }
  function invOut(vin, P, dvt){
    const {vdd, vt, beta, gam, read} = P;
    let lo = 0, hi = vdd;
    for(let i = 0; i < 48; i++){
      const vo = (lo + hi) / 2;
      const f = ids(vdd - vin - vt, vdd - vo, gam) + (read ? ids(vdd - vo - vt, vdd - vo, 1) : 0) - ids(vin - vt - dvt, vo, beta);
      if(f > 0) lo = vo; else hi = vo;
    }
    return (lo + hi) / 2;
  }
  function snm(P){
    const N = 201, vdd = P.vdd, f1 = new Float64Array(N), f2 = new Float64Array(N);
    for(let i = 0; i < N; i++){ const g = vdd * i / (N - 1); f2[i] = invOut(g, P, 0); f1[i] = invOut(g, P, P.dvt); }
    const at = (arr, v) => { const u = clamp(v / vdd, 0, 1) * (N - 1), i = Math.min(N - 2, Math.floor(u)), fr = u - i; return arr[i] * (1 - fr) + arr[i + 1] * fr; };
    const xA = c => { // y = f2(x) on the line y = x + c
      let lo = 0, hi = vdd; if(at(f2, 0) - c < 0) return null;
      for(let i = 0; i < 40; i++){ const x = (lo + hi) / 2; if(at(f2, x) - x - c > 0) lo = x; else hi = x; }
      const x = (lo + hi) / 2; return [x, at(f2, x)];
    };
    const xB = c => { // x = f1(y) on the line y = x + c
      let lo = 0, hi = vdd; if(vdd - at(f1, vdd) - c < 0 || -at(f1, 0) - c > 0) return null;
      for(let i = 0; i < 40; i++){ const y = (lo + hi) / 2; if(y - at(f1, y) - c < 0) lo = y; else hi = y; }
      const y = (lo + hi) / 2; return [at(f1, y), y];
    };
    const lobe = sgn => {
      let best = {d:0, p:null};
      for(let k = 1; k < 300; k++){
        const c = sgn * vdd * k / 300, a = xA(c), b = xB(c);
        if(!a || !b) continue;
        const d = sgn > 0 ? a[0] - b[0] : b[0] - a[0];
        if(d > best.d) best = {d, p: sgn > 0 ? b : a};
      }
      return best;
    };
    const L1 = lobe(1), L2 = lobe(-1);
    const A = [], B = [];
    for(let i = 0; i < N; i++){ const g = vdd * i / (N - 1); A.push([g, f2[i]]); B.push([f1[i], g]); }
    return {s1:L1.d, s2:L2.d, sq1:L1, sq2:L2, snm:Math.min(L1.d, L2.d), A, B};
  }
  INIT.sram = function(){
    let mode = 'read';
    toggle('sr-mode', v => { mode = v; render(); });
    const vdd = range('sr-vdd', v => v.toFixed(2) + ' V', render);
    const beta = range('sr-beta', v => v.toFixed(1), render);
    const gam = range('sr-gam', v => v.toFixed(2), render);
    const vt = range('sr-vt', v => (v * 1000).toFixed(0) + ' mV', render);
    const dvt = range('sr-dvt', v => (v >= 0 ? '+' : '') + (v * 1000).toFixed(0) + ' mV', render);
    function render(){
      const base = {vt:vt.get(), beta:beta.get(), gam:gam.get(), dvt:dvt.get()};
      const P = Object.assign({vdd:vdd.get(), read: mode === 'read'}, base);
      const R = snm(P);
      const V = P.vdd;
      const sq = (L, X, Y) => L.p && L.d > 0.002 ? '<rect x="' + X(L.p[0]).toFixed(1) + '" y="' + Y(L.p[1] + L.d).toFixed(1) + '" width="' + (X(L.p[0] + L.d) - X(L.p[0])).toFixed(1) + '" height="' + (Y(L.p[1]) - Y(L.p[1] + L.d)).toFixed(1) + '" style="fill:var(--accent);fill-opacity:.15;stroke:var(--accent);stroke-width:2"/>' : '';
      plot($('sr-bfly'), {W:420, H:400, m:{l:56, r:14, t:12, b:48}, x:[0, V], y:[0, V], xlabel:'V(Q) (V)', ylabel:'V(QB) (V)',
        series:[{pts:R.A, color:'var(--s1)', w:2.4}, {pts:R.B, color:'var(--s2)', w:2.4}],
        extra:(X, Y) => sq(R.sq1, X, Y) + sq(R.sq2, X, Y) +
          (R.sq1.d > 0.01 ? '<text class="ts" x="' + (X(R.sq1.p[0] + R.sq1.d / 2)).toFixed(1) + '" y="' + (Y(R.sq1.p[1] + R.sq1.d / 2) + 4).toFixed(1) + '" text-anchor="middle">' + Math.round(R.s1 * 1000) + '</text>' : '') +
          (R.sq2.d > 0.01 ? '<text class="ts" x="' + (X(R.sq2.p[0] + R.sq2.d / 2)).toFixed(1) + '" y="' + (Y(R.sq2.p[1] + R.sq2.d / 2) + 4).toFixed(1) + '" text-anchor="middle">' + Math.round(R.s2 * 1000) + '</text>' : '')});
      // sweep
      const hold = [], rd = [];
      let vmin = null;
      for(let v = 0.3; v <= 1.2001; v += 0.03){
        const h = snm(Object.assign({vdd:v, read:false}, base)).snm, r = snm(Object.assign({vdd:v, read:true}, base)).snm;
        hold.push([v, h * 1000]); rd.push([v, r * 1000]);
        if(vmin === null && r >= 0.03) vmin = v;
      }
      const ymax = Math.max(60, ...hold.map(p => p[1])) * 1.1;
      plot($('sr-sweep'), {W:420, H:400, m:{l:56, r:14, t:12, b:48}, x:[0.3, 1.2], y:[0, ymax], xlabel:'V_DD (V)', ylabel:'SNM (mV)',
        series:[{pts:hold, color:'var(--s3)', w:2.4}, {pts:rd, color:'var(--s4)', w:2.4}],
        hlines:[{y:30, color:'var(--bad)', label:t('30 mV 門檻', '30 mV limit')}],
        vlines:[{x:V, color:'var(--ink)', dash:false, w:1.2, label:t('目前', 'now')}].concat(vmin ? [{x:vmin, color:'var(--warn)', label:t('讀取 Vmin', 'read Vmin'), dy:16}] : [])});
      const s = R.snm, rel = s / V;
      metrics($('sr-metrics'), [
        {l:(mode === 'read' ? 'Read' : 'Hold') + ' SNM', v:Math.round(s * 1000), u:'mV', cls: s < 0.005 ? 'bad' : rel < 0.1 ? 'warn' : 'ok', s: s < 0.005 ? t('只剩一個穩定態：會翻轉', 'Only one stable state: the cell flips') : (rel * 100).toFixed(0) + '% of V<sub>DD</sub>'},
        {l:t('左上眼（存 0）', 'Upper-left eye (holding 0)'), v:Math.round(R.s1 * 1000), u:'mV'},
        {l:t('右下眼（存 1）', 'Lower-right eye (holding 1)'), v:Math.round(R.s2 * 1000), u:'mV'},
        {l:t('估計讀取 V<sub>min</sub>', 'Estimated read V<sub>min</sub>'), v: vmin === null ? '&gt; 1.2' : vmin <= 0.3 ? '≤ 0.30' : vmin.toFixed(2), u:'V', s:t('Read SNM ≥ 30 mV 的最低電壓', 'Lowest V<sub>DD</sub> with read SNM ≥ 30 mV')}
      ]);
    }
    render();
  };

  /* =====================================================================
     3. NAND Vt distributions, cycling + retention, RBER with fixed vs tracked read levels
     ===================================================================== */
  INIT.nand = function(){
    const PE = [0, 100, 300, 500, 1000, 2000, 3000, 5000, 10000, 30000, 100000];
    const RET = [0, 1, 24, 168, 720, 2160, 8760, 26280, 87600];
    const RETL = [t('剛寫入', 'Just written'), t('1 小時', '1 hour'), t('1 天', '1 day'), t('1 週', '1 week'), t('1 個月', '1 month'), t('3 個月', '3 months'), t('1 年', '1 year'), t('3 年', '3 years'), t('10 年', '10 years')];
    const STEP = {1:0.5, 2:0.3, 3:0.2, 4:0.12};
    const NAME = {1:'SLC', 2:'MLC', 3:'TLC', 4:'QLC'};
    let bits = 3, retry = false, logy = true;
    toggle('nd-bits', v => { bits = +v; step.set(STEP[bits]); render(); });
    toggle('nd-rr', v => { retry = v === '1'; render(); });
    toggle('nd-log', v => { logy = v === '1'; render(); });
    const step = range('nd-step', v => (v * 1000).toFixed(0) + ' mV', render);
    const pe = range('nd-pe', v => PE[v].toLocaleString() + t(' 次', ' cycles'), render);
    const ret = range('nd-ret', v => RETL[v], render);
    const temp = range('nd-temp', v => v + ' °C', render);

    function states(p){
      const L = 1 << p.bits, mu0 = [-2.6];
      if(L === 2) mu0.push(2.2); else for(let k = 1; k < L; k++) mu0.push(0.4 + (k - 1) * 4.6 / (L - 2));
      const kpe = p.pe / 1000, sdP = Math.hypot(p.step / Math.sqrt(12), 0.04), sdPE = 0.035 * Math.sqrt(kpe);
      const af = Math.exp(1.1 / 8.617e-5 * (1 / 298.15 - 1 / (p.T + 273.15)));
      const D = Math.log10(1 + p.hours * af), fac = 1 + 0.9 * Math.sqrt(kpe);
      return mu0.map((m, i) => {
        let mu = m + (i === 0 ? 0.1 : 0.03) * Math.sqrt(kpe);
        mu += -0.012 * mu * D * fac;
        const sd = Math.hypot(i === 0 ? 0.45 : sdP, sdPE, 0.008 * D * fac * Math.abs(m) / 5);
        return {mu, sd};
      });
    }
    function refsFor(S){
      const r = [];
      for(let i = 0; i < S.length - 1; i++){ const a = S[i], b = S[i + 1]; r.push((a.mu * b.sd + b.mu * a.sd) / (a.sd + b.sd)); }
      return r.sort((x, y) => x - y);
    }
    function rber(S, refs){
      const L = S.length, nb = Math.log2(L), gray = i => i ^ (i >> 1);
      const pop = x => { let c = 0; while(x){ c += x & 1; x >>= 1; } return c; };
      let err = 0;
      S.forEach((s, i) => {
        for(let j = 0; j < L; j++){
          if(j === i) continue;
          const lo = j === 0 ? -Infinity : refs[j - 1], hi = j === L - 1 ? Infinity : refs[j];
          let pr;
          if(j > i) pr = Q((lo - s.mu) / s.sd) - (hi === Infinity ? 0 : Q((hi - s.mu) / s.sd));
          else pr = Phi((hi - s.mu) / s.sd) - (lo === -Infinity ? 0 : Phi((lo - s.mu) / s.sd));
          err += Math.max(0, pr) * pop(gray(i) ^ gray(j));
        }
      });
      return err / L / nb;
    }
    function render(){
      const p = {bits, step:step.get(), pe:PE[pe.get()], hours:RET[ret.get()], T:temp.get()};
      const S = states(p), fresh = states(Object.assign({}, p, {pe:0, hours:0}));
      const fixedRefs = refsFor(fresh), curRefs = retry ? refsFor(S) : fixedRefs;
      const e = rber(S, curRefs), eFixed = rber(S, fixedRefs);
      const L = S.length;
      const cols = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)'];
      let peak = 0;
      const series = S.map((s, i) => {
        const pts = [];
        for(let k = -6; k <= 6.001; k += 0.08){ const x = s.mu + k * s.sd, y = Math.exp(-k * k / 2) / (s.sd * Math.sqrt(2 * Math.PI)); peak = Math.max(peak, y); pts.push([x, y]); }
        return {pts, color:cols[i % cols.length], w:1.6, fill:true, op:.22};
      });
      plot($('nd-plot'), {x:[-4.5, 6.5], y: logy ? [peak * 1e-6, peak * 3] : [0, peak * 1.1], logy, H:320, xlabel:t('臨界電壓 V_t (V)', 'Threshold voltage V_t (V)'), ylabel: logy ? t('機率密度（對數）', 'Probability density (log)') : t('機率密度', 'Probability density'),
        yfmt: logy ? (v => '') : (v => ''), series,
        vlines: (retry ? fixedRefs.map(r => ({x:r, color:'var(--muted)', dash:'2 4', w:1})) : []).concat(curRefs.map(r => ({x:r, color:'var(--accent)', w:1.4})))});
      let worst = Infinity;
      S.forEach((s, i) => { if(i > 0) worst = Math.min(worst, (s.mu - curRefs[i - 1]) / s.sd); if(i < L - 1) worst = Math.min(worst, (curRefs[i] - s.mu) / s.sd); });
      const pulses = Math.ceil(4.6 / p.step) + 2, tprog = pulses * (8 + (L - 1) * 1.5);
      const ldpc = 4e-3;
      metrics($('nd-metrics'), [
        {l:t('原始位元錯誤率 RBER', 'Raw bit error rate (RBER)'), v:fmtSci(e), cls: e < 1e-4 ? 'ok' : e < ldpc ? 'warn' : 'bad', s: e < 1e-4 ? t('輕鬆更正', 'Easily corrected') : e < ldpc ? t('LDPC 硬判決可更正', 'Correctable by hard-decision LDPC') : t('超出硬判決能力', 'Beyond hard-decision capability')},
        {l:t('固定參考電壓下 RBER', 'RBER with fixed read levels'), v:fmtSci(eFixed), s: retry ? t('Read retry 改善 ', 'Read retry improves it ') + (eFixed > 0 && e > 0 ? (eFixed / e).toFixed(1) + '×' : '—') : t('目前即使用固定參考', 'Currently using fixed levels')},
        {l:t('最差邊限', 'Worst margin'), v: isFinite(worst) ? worst.toFixed(2) : '—', u:'σ', cls: worst < 2 ? 'bad' : worst < 3 ? 'warn' : 'ok'},
        {l:t('估計 t<sub>PROG</sub>（示意）', 'Estimated t<sub>PROG</sub> (illustrative)'), v:tprog >= 1000 ? (tprog / 1000).toFixed(2) : Math.round(tprog), u:tprog >= 1000 ? 'ms' : 'µs', s:pulses + t(' 個 ISPP 脈衝 × ', ' ISPP pulses × ') + (L - 1) + t(' 次驗證', ' verifies')}
      ]);
      $('nd-sub').textContent = NAME[bits] + ' · ' + L + t(' 個狀態 · ', ' states · ') + p.pe.toLocaleString() + ' P/E · ' + RETL[ret.get()] + (p.hours ? ' @ ' + p.T + ' °C' : '');
    }
    render();
  };

  /* =====================================================================
     4. DRAM retention distribution vs refresh window and temperature
     ===================================================================== */
  INIT.retention = function(){
    const MU_M = Math.log10(6), SD_M = 0.3, MU_T = Math.log10(0.5), SD_T = 0.35;
    const winOf = v => Math.pow(10, -2.1 + 3.1 * v / 100);
    const temp = range('rt-temp', v => v + ' °C', render);
    const win = range('rt-win', v => fmtT(winOf(v)), render);
    const tail = range('rt-tail', v => fmtSci(Math.pow(10, v)), render);
    win.set(29.2);
    $('rt-den').addEventListener('change', render);
    $('rt-std').addEventListener('click', () => { const w = temp.get() > 85 ? 0.032 : 0.064; win.set((Math.log10(w) + 2.1) / 3.1 * 100); render(); });
    const fail = (w, T, tw) => { const x = Math.log10(w * Math.pow(2, (T - 85) / 10)); return (1 - tw) * Phi((x - MU_M) / SD_M) + tw * Phi((x - MU_T) / SD_T); };
    function render(){
      const T = temp.get(), w = winOf(win.get()), tw = Math.pow(10, tail.get());
      const [gb, trfc] = $('rt-den').value.split(',').map(Number);
      const bitsN = gb * Math.pow(2, 30);
      const F = fail(w, T, tw), base = fail(0.064, 85, tw);
      const ovh = trfc * 1e-9 * 8192 / w;
      // window that matches the 85 °C / 64 ms baseline at this temperature
      let lo = -4, hi = 2;
      for(let i = 0; i < 60; i++){ const mid = (lo + hi) / 2; if(fail(Math.pow(10, mid), T, tw) < base) lo = mid; else hi = mid; }
      const need = Math.pow(10, (lo + hi) / 2);
      const nf = F * bitsN;
      metrics($('rt-metrics'), [
        {l:t('失效位元比例', 'Failing-bit fraction'), v:fmtSci(F)},
        {l:t('預期失效位元數（整顆）', 'Expected failing bits (whole die)'), v: nf < 1 ? nf.toFixed(2) : nf < 1e4 ? Math.round(nf).toLocaleString() : fmtSci(nf), cls: F <= base * 1.5 ? 'ok' : F <= base * 10 ? 'warn' : 'bad', s:t('相對 85 °C / 64 ms 基準 ', 'vs. 85 °C / 64 ms baseline ') + (F / base).toPrecision(2) + '×'},
        {l:t('維持基準所需視窗', 'Window needed to match baseline'), v:fmtT(need), s:'tREFI = ' + fmtT(need / 8192)},
        {l:t('Refresh 時間開銷', 'Refresh time overhead'), v:(ovh * 100).toFixed(ovh < 0.1 ? 2 : 1), u:'%', cls: ovh < 0.05 ? 'ok' : ovh < 0.12 ? 'warn' : 'bad', s:'tREFI = ' + fmtT(w / 8192) + t('，tRFC = ', ', tRFC = ') + trfc + ' ns'}
      ]);
      const curve = TT => { const a = []; for(let k = -3; k <= 2.001; k += 0.05){ const x = Math.pow(10, k); a.push([x, fail(x, TT, tw)]); } return a; };
      plot($('rt-plot'), {x:[1e-3, 100], logx:true, y:[1e-12, 1], logy:true, H:300, xlabel:t('Refresh 視窗 tREFW (s)', 'Refresh window tREFW (s)'), ylabel:t('失效位元比例', 'Failing-bit fraction'),
        xfmt: v => v < 1 ? (v * 1000) + ' ms' : v + ' s',
        series:[{pts:curve(45), color:'var(--s3)', w:1.6}, {pts:curve(85), color:'var(--s2)', w:1.6}, {pts:curve(105), color:'var(--s4)', w:1.6}, {pts:curve(T), color:'var(--accent)', w:3}],
        hlines:[{y:1 / bitsN, color:'var(--muted)', label:t('≈ 1 個位元 / 晶片', '≈ 1 bit per die')}],
        vlines:[{x:w, color:'var(--ink)', dash:false, w:1.2, label:t('目前 ', 'now ') + fmtT(w)}, {x:0.064, color:'var(--muted)', label:'64 ms', dy:16, anchor:'end'}]});
      const ov = []; for(let k = -2.1; k <= 1.001; k += 0.05){ const x = Math.pow(10, k); ov.push([x, trfc * 1e-9 * 8192 / x * 100]); }
      plot($('rt-ovh'), {x:[0.008, 10], logx:true, y:[0, 50], H:220, xlabel:t('Refresh 視窗 tREFW (s)', 'Refresh window tREFW (s)'), ylabel:t('開銷 (%)', 'Overhead (%)'),
        xfmt: v => v < 1 ? (v * 1000) + ' ms' : v + ' s',
        series:[{pts:ov, color:'var(--accent)', w:2.4, fill:true, op:.12}],
        vlines:[{x:w, color:'var(--ink)', dash:false, w:1.2, label:(ovh * 100).toFixed(1) + '%'}]});
    }
    render();
  };

  /* =====================================================================
     5. March tests on a faulty 8x8 memory
     ===================================================================== */
  const ALGS = {
    'MATS+':        [['any', ['w0']], ['up', ['r0', 'w1']], ['down', ['r1', 'w0']]],
    'March X':      [['any', ['w0']], ['up', ['r0', 'w1']], ['down', ['r1', 'w0']], ['any', ['r0']]],
    'March C−':     [['any', ['w0']], ['up', ['r0', 'w1']], ['up', ['r1', 'w0']], ['down', ['r0', 'w1']], ['down', ['r1', 'w0']], ['any', ['r0']]],
    'March B':      [['any', ['w0']], ['up', ['r0', 'w1', 'r1', 'w0', 'r0', 'w1']], ['up', ['r1', 'w0', 'w1']], ['down', ['r1', 'w0', 'w1', 'w0']], ['down', ['r0', 'w1', 'w0']]],
    'Checkerboard': [['any', ['w0'], 'cb'], ['any', ['r0'], 'cb'], ['any', ['w1'], 'cb'], ['any', ['r1'], 'cb']]
  };
  const ARROW = {any:'⇕', up:'⇑', down:'⇓'};
  const FT = ['SA0', 'SA1', 'TFu', 'TFd', 'CFin', 'CFid', 'CFst', 'AF'];
  const FT_LABEL = {SA0:'SA0', SA1:'SA1', TFu:'TF↑', TFd:'TF↓', CFin:'CFin', CFid:'CFid', CFst:'CFst', AF:'AF'};
  const TWO = new Set(['CFin', 'CFid', 'CFst', 'AF']);
  const N = 64;
  const notation = name => '{ ' + ALGS[name].map(e => ARROW[e[0]] + '(' + e[1].join(',') + ')').join('; ') + ' }' + (name === 'Checkerboard' ? t('  0/1 = 棋盤 / 反棋盤', '  0/1 = checkerboard / inverse') : '');
  function expand(name){
    const ops = [];
    ALGS[name].forEach((e, ei) => {
      const order = [...Array(N).keys()]; if(e[0] === 'down') order.reverse();
      order.forEach(a => e[1].forEach(o => {
        let v = +o[1]; if(e[2] === 'cb') v ^= ((a >> 3) + (a & 7)) & 1;
        ops.push({e:ei, a, op:o[0], v});
      }));
    });
    return ops;
  }
  function makeMem(faults, init){
    const cells = init.slice(), map = [...Array(N).keys()];
    faults.forEach(f => { if(f.t === 'AF') map[f.a] = f.v; });
    const enforce = () => {
      faults.forEach(f => { if(f.t === 'CFst' && cells[f.a] === 1) cells[f.v] = 0; });
      faults.forEach(f => { if(f.t === 'SA0') cells[f.c] = 0; else if(f.t === 'SA1') cells[f.c] = 1; });
    };
    enforce();
    return {
      cells,
      write(addr, v){
        const p = map[addr], old = cells[p]; let nv = v;
        faults.forEach(f => { if(f.c === p && ((f.t === 'TFu' && old === 0 && v === 1) || (f.t === 'TFd' && old === 1 && v === 0))) nv = old; });
        cells[p] = nv;
        if(old !== nv) faults.forEach(f => {
          if(f.a !== p) return;
          if(f.t === 'CFin' && old === 0) cells[f.v] ^= 1;
          if(f.t === 'CFid' && old === 1) cells[f.v] = 1;
        });
        enforce();
      },
      read(addr){ return cells[map[addr]]; }
    };
  }
  function rng(seed){ return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function randFault(t, R){
    const c = Math.floor(R() * N);
    if(!TWO.has(t)) return {t, c};
    let v; do { v = Math.floor(R() * N); } while(v === c);
    return {t, a:c, v};
  }
  INIT.march = function(){
    const sel = $('mt-alg');
    sel.innerHTML = Object.keys(ALGS).map(k => '<option' + (k === 'March C−' ? ' selected' : '') + '>' + k + '</option>').join('');
    const grid = $('mt-grid');
    grid.innerHTML = Array.from({length:N}, (_, i) => '<span data-i="' + i + '"></span>').join('');
    const spans = [...grid.children];
    const SPEED = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];
    const speed = range('mt-speed', v => SPEED[v - 1] + ' ops/s', () => {});
    let faults = [], pending = null, S = null, timer = 0, running = false;

    function hint(){
      const ft = $('mt-ftype').value;
      $('mt-hint').textContent = pending !== null ? t('已選攻擊者 / 位址 a = ', 'Aggressor / address a = ') + pending + t('，再點一格作為受害者 / 位址 b', ' selected; click a victim / address b') :
        TWO.has(ft) ? t('點一格當攻擊者（AF 為位址 a），再點一格當受害者（AF 為 b）', 'Click an aggressor (address a for AF), then a victim (b for AF)') : t('點一格注入', 'Click a cell to inject');
    }
    function reset(){
      stop();
      const name = sel.value;
      const init = Array.from({length:N}, () => Math.random() < 0.5 ? 1 : 0);
      S = {name, ops:expand(name), ptr:0, mem:makeMem(faults, init), mism:[], det:new Set(), cur:-1};
      $('mt-notation').textContent = notation(name);
      $('mt-log').innerHTML = t('<span>尚未執行</span>', '<span>Not run yet</span>');
      draw();
    }
    function involved(f){ return TWO.has(f.t) ? [f.a, f.v] : [f.c]; }
    function watch(f){ return f.t === 'AF' ? [f.a, f.v] : TWO.has(f.t) ? [f.v] : [f.c]; }
    function draw(){
      const fset = new Set(); faults.forEach(f => involved(f).forEach(i => fset.add(i)));
      spans.forEach((s, i) => {
        const v = S.mem.cells[i];
        s.textContent = v;
        s.className = (v ? 'one' : '') + (i === S.cur ? ' cur' : '') + (fset.has(i) ? ' flt' : '') + (S.det.has(i) ? ' det' : '') ;
        s.title = t('位址 ', 'Address ') + i + (i === pending ? t('（已選）', ' (selected)') : '');
      });
      if(pending !== null) spans[pending].classList.add('cur');
      const total = S.ops.length, done = S.ptr === total;
      const detected = faults.filter(f => watch(f).some(i => S.det.has(i))).length;
      metrics($('mt-metrics'), [
        {l:t('複雜度', 'Complexity'), v:(total / N) + 'N', s:total + t(' 次操作', ' operations')},
        {l:t('進度', 'Progress'), v:Math.round(S.ptr / total * 100), u:'%'},
        {l:t('讀取不符', 'Read mismatches'), v:S.mism.length, cls: S.mism.length ? 'bad' : ''},
        {l:t('故障偵測', 'Faults detected'), v: faults.length ? detected + ' / ' + faults.length : '—', cls: !faults.length || !done ? '' : detected === faults.length ? 'ok' : 'warn', s: done ? t('已完成', 'Finished') : faults.length ? t('執行中或尚未開始', 'Running or not started') : t('尚未注入故障', 'No faults injected')}
      ]);
      $('mt-pos').textContent = S.cur >= 0 && S.ptr > 0 ? 'M' + S.ops[Math.min(S.ptr, total) - 1].e + t(' · 位址 ', ' · address ') + S.cur : '—';
      $('mt-faults').innerHTML = faults.length ? faults.map(f => {
        const d = watch(f).some(i => S.det.has(i));
        const where = TWO.has(f.t) ? (f.t === 'AF' ? 'a=' + f.a + ' → b=' + f.v : t('攻擊 ', 'aggressor ') + f.a + t(' → 受害 ', ' → victim ') + f.v) : t('位址 ', 'Address ') + f.c;
        return '<div' + (done && !d ? ' class="bad"' : '') + '>' + FT_LABEL[f.t] + ' · ' + where + ' — ' + (d ? t('✓ 偵測到', '✓ detected') : done ? t('✗ 漏網', '✗ escaped') : '…') + '</div>';
      }).join('') : t('<span>尚未注入（可用「隨機注入 3 個」）</span>', '<span>None yet (try “Inject 3 random”)</span>');
      $('mt-run').textContent = running ? t('❚❚ 暫停', '❚❚ Pause') : done ? t('▶ 再跑一次', '▶ Run again') : t('▶ 執行', '▶ Run');
    }
    function stepOnce(){
      if(!S || S.ptr >= S.ops.length) return false;
      const o = S.ops[S.ptr++];
      S.cur = o.a;
      if(o.op === 'w') S.mem.write(o.a, o.v);
      else {
        const got = S.mem.read(o.a);
        if(got !== o.v){
          S.mism.push(o); S.det.add(o.a);
          if(S.mism.length <= 200){
            const log = $('mt-log'); if(S.mism.length === 1) log.innerHTML = '';
            log.insertAdjacentHTML('beforeend', '<div class="bad">M' + o.e + ' ' + ARROW[ALGS[S.name][o.e][0]] + t(' 位址 ', ' addr ') + o.a + t('：r', ': r') + o.v + t(' 讀到 ', ' read ') + got + '</div>');
            log.scrollTop = log.scrollHeight;
          }
        }
      }
      return true;
    }
    function stop(){ running = false; cancelAnimationFrame(timer); }
    function run(){
      if(S.ptr >= S.ops.length) reset();
      running = true;
      let last = performance.now(), acc = 0;
      const tick = now => {
        acc += (now - last) / 1000 * SPEED[speed.get() - 1]; last = now;
        let n = Math.floor(acc); acc -= n;
        while(n-- > 0) if(!stepOnce()){ running = false; break; }
        if(S.ptr >= S.ops.length) running = false;
        draw();
        if(running) timer = requestAnimationFrame(tick);
        else if(!S.mism.length && S.ptr >= S.ops.length) $('mt-log').innerHTML = t('<span>全部讀取都符合預期</span>', '<span>Every read matched</span>');
      };
      timer = requestAnimationFrame(tick);
      draw();
    }
    grid.addEventListener('click', e => {
      const s = e.target.closest('span[data-i]'); if(!s) return;
      const i = +s.dataset.i, t = $('mt-ftype').value;
      if(TWO.has(t)){
        if(pending === null){ pending = i; hint(); draw(); return; }
        if(i === pending) return;
        faults = faults.filter(f => !(f.t === 'AF' && t === 'AF' && f.a === pending));
        faults.push({t, a:pending, v:i}); pending = null;
      } else {
        faults = faults.filter(f => !(f.c === i && !TWO.has(f.t)));
        faults.push({t, c:i});
      }
      hint(); reset();
    });
    $('mt-ftype').addEventListener('change', () => { pending = null; hint(); draw(); });
    sel.addEventListener('change', reset);
    $('mt-rand').addEventListener('click', () => {
      const used = new Set(); faults.forEach(f => involved(f).forEach(i => used.add(i)));
      for(let k = 0; k < 3; k++){
        let f, tries = 0;
        do { f = randFault(FT[Math.floor(Math.random() * FT.length)], Math.random); tries++; } while(involved(f).some(i => used.has(i)) && tries < 50);
        involved(f).forEach(i => used.add(i)); faults.push(f);
      }
      pending = null; hint(); reset();
    });
    $('mt-clear').addEventListener('click', () => { faults = []; pending = null; hint(); reset(); });
    $('mt-reset').addEventListener('click', reset);
    $('mt-step').addEventListener('click', () => { stop(); if(S.ptr >= S.ops.length) reset(); stepOnce(); draw(); });
    $('mt-run').addEventListener('click', () => { if(running){ stop(); draw(); } else run(); });

    // coverage experiment
    const R = rng(20261015), TRIALS = 200;
    const names = Object.keys(ALGS);
    const cov = names.map(name => {
      const ops = expand(name);
      return FT.map(t => {
        let hit = 0;
        for(let k = 0; k < TRIALS; k++){
          const f = randFault(t, R), init = Array.from({length:N}, () => R() < 0.5 ? 1 : 0), mem = makeMem([f], init);
          for(const o of ops){ if(o.op === 'w') mem.write(o.a, o.v); else if(mem.read(o.a) !== o.v){ hit++; break; } }
        }
        return hit / TRIALS;
      });
    });
    $('mt-cov').innerHTML = t('<tr><th>演算法</th><th class="n">複雜度</th>', '<tr><th>Algorithm</th><th class="n">Complexity</th>') + FT.map(t => '<th class="n">' + FT_LABEL[t] + '</th>').join('') + '</tr>' +
      names.map((name, i) => '<tr><td>' + name + '</td><td class="n">' + (expand(name).length / N) + 'N</td>' + cov[i].map(c =>
        '<td class="n" style="color:' + (c >= 0.999 ? 'var(--ok)' : c >= 0.6 ? 'var(--warn)' : 'var(--bad)') + '">' + Math.round(c * 100) + '%</td>').join('') + '</tr>').join('');
    hint(); reset();
  };

  // extra tabs (assets/lab-fab.js) register into INIT; run after every script has loaded
  window.MemLab = {INIT, metrics, toggle, range, fmtT, $, clamp};
  document.addEventListener('DOMContentLoaded', () => show(location.hash.slice(1) || 'dram'));
})();
