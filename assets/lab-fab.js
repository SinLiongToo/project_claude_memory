/* Memory Lab — reliability / fab tabs: row hammer mitigation, wafer yield with repair, HBM stack yield, cost per Gb. */
(function(){
  const t = (window.MemSite && window.MemSite.t) || (zh => zh);
  const {plot, Phi, Q, fmtSci} = window.MemPlot;
  const {INIT, metrics, toggle, range, $, clamp} = window.MemLab;
  const fmtK = v => v >= 1e6 ? +(v / 1e6).toPrecision(3) + 'M' : v >= 1e3 ? +(v / 1e3).toPrecision(3) + 'K' : String(Math.round(v));
  function rng(seed){ return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function lgamma(x){ // Lanczos
    const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if(x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
    x -= 1; let a = c[0]; const t = x + g + 0.5;
    for(let i = 1; i < g + 2; i++) a += c[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }

  /* =====================================================================
     Row hammer: activations per refresh window vs per-cell flip thresholds, with TRR / RFM / PRAC
     ===================================================================== */
  INIT.rowhammer = function(){
    const hcOf = v => Math.pow(10, 2 + 3.3 * v / 100);
    const hc = range('rh-hc', v => fmtK(hcOf(v)), render);
    const duty = range('rh-duty', v => v + '%', render);
    const trrn = range('rh-trrn', v => v + t(' 列', ' rows'), render);
    const raa = range('rh-raa', v => v + ' ACT', render);
    const prac = range('rh-prac', v => fmtK(Math.pow(2, v)), render);
    ['rh-k', 'rh-win', 'rh-mit'].forEach(id => $(id).addEventListener('change', render));
    const BITS = 65536, SIG = 0.15, MED = Math.pow(10, 4 * SIG);   // weakest of 65 536 cells sits ~4σ below the median
    const flips = (d, HC) => d <= 0 ? 0 : BITS * Phi((Math.log10(d) - Math.log10(HC * MED)) / SIG);
    function model(p, mit){
      const maxAct = p.win * 1e6 / 48, total = maxAct * p.duty, a = total / p.k, sides = p.k >= 2 ? 2 : 1;
      let d = sides * a, ovh = 0, note = '';
      if(mit === 'trr'){
        if(p.k <= p.trrn){ d = sides * total / 8192; note = t('攻擊列都在追蹤表內：每次 REF 都更新受害列', 'All aggressors fit in the table: victims refreshed at every REF'); }
        else note = t('攻擊列數 > 追蹤表：追蹤被洗掉，TRR 失效', 'More aggressors than table entries: tracking thrashes, TRR fails');
      } else if(mit === 'rfm'){
        d = sides * Math.min(a, p.raa); ovh = total / p.raa * 200 / (p.win * 1e6); note = t('每 ', 'One RFM every ') + p.raa + t(' 次 ACT 一次 RFM', ' ACTs');
      } else if(mit === 'prac'){
        d = sides * Math.min(a, p.prac); ovh = 0.06 + total / p.prac * 350 / (p.win * 1e6); note = t('計數器達 ', 'Mitigate when a counter reaches ') + fmtK(p.prac) + t(' 即緩解', '');
      }
      return {a, d, f: flips(d, p.hc), ovh: Math.min(ovh, 1), note, sides};
    }
    function render(){
      const mit = $('rh-mit').value;
      document.querySelectorAll('#tab-rowhammer [data-mit]').forEach(el => el.hidden = el.dataset.mit !== mit);
      const p = {hc:hcOf(hc.get()), k:+$('rh-k').value, duty:duty.get() / 100, win:+$('rh-win').value, trrn:trrn.get(), raa:raa.get(), prac:Math.pow(2, prac.get())};
      const M = model(p, mit);
      const safe = M.f < 1;
      metrics($('rh-metrics'), [
        {l:t('每條攻擊列 ACT 數', 'ACTs per aggressor row'), v:fmtK(M.a), s:t('視窗 ', 'Window ') + p.win + ' ms · ' + p.k + t(' 條攻擊列', ' aggressor rows')},
        {l:t('受害列有效擾動', 'Effective victim disturbance'), v:fmtK(M.d), s: M.sides === 2 ? t('兩側攻擊列合計', 'Both neighbours combined') : t('單側', 'One side')},
        {l:t('受害列預期翻轉位元', 'Expected flips per victim row'), v: M.f < 0.01 ? '≈ 0' : M.f < 10 ? M.f.toFixed(2) : fmtK(M.f), cls: safe ? 'ok' : 'bad', s: safe ? t('低於 1 個位元', 'Below 1 bit') : t('會發生位元翻轉', 'Bit flips will occur')},
        {l:t('緩解開銷（攻擊時）', 'Mitigation overhead (under attack)'), v: mit === 'none' || mit === 'trr' ? '—' : (M.ovh * 100).toFixed(1), u: mit === 'none' || mit === 'trr' ? '' : '%', s:M.note || t('無緩解', 'No mitigation')}
      ]);
      // rows picture
      const N = 11, H = 22, W = 420, rows = [];
      const aggr = new Set(p.k === 1 ? [5] : p.k === 2 ? [4, 6] : [1, 3, 5, 7, 9]);
      for(let i = 0; i < N; i++){
        const isA = aggr.has(i), nb = (aggr.has(i - 1) ? 1 : 0) + (aggr.has(i + 1) ? 1 : 0);
        const d = isA ? 0 : nb === 0 ? 0 : (M.d / M.sides) * nb, f = isA ? 0 : flips(d, p.hc);
        rows.push({isA, d, f});
      }
      let s = '';
      rows.forEach((r, i) => {
        const y = 10 + i * (H + 4);
        const fill = r.isA ? 'color-mix(in srgb,var(--bad) 35%,var(--surface))' : r.f >= 1 ? 'color-mix(in srgb,var(--warn) ' + Math.round(clamp(20 + Math.log10(r.f) * 15, 20, 80)) + '%,var(--surface))' : 'var(--surface)';
        s += '<rect x="70" y="' + y + '" width="' + (W - 80) + '" height="' + H + '" rx="3" style="fill:' + fill + ';stroke:' + (r.isA ? 'var(--bad)' : 'var(--line)') + '"/>' +
          '<text x="62" y="' + (y + 15) + '" text-anchor="end" class="ts t-mono t-mut">Row ' + (i - 5 >= 0 ? '+' : '') + (i - 5) + '</text>' +
          '<text x="80" y="' + (y + 15) + '" class="ts">' + (r.isA ? t('攻擊列 · ACT ', 'Aggressor · ACT ') + fmtK(M.a) : r.d > 0 ? t('擾動 ', 'Disturb ') + fmtK(r.d) + t(' · 翻轉 ', ' · flips ') + (r.f < 0.01 ? '≈0' : r.f < 10 ? r.f.toFixed(1) : fmtK(r.f)) : t('未受影響', 'Unaffected')) + '</text>';
      });
      if(p.k > 5) s += '<text x="' + (W / 2) + '" y="' + (10 + N * (H + 4) + 12) + t('" text-anchor="middle" class="ts t-mut">另有 ', '" text-anchor="middle" class="ts t-mut">') + (p.k - 5) + t(' 條攻擊列在其他位置</text>', ' more aggressor rows elsewhere</text>');
      const svg = $('rh-rows'); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + (N * (H + 4) + 34)); svg.innerHTML = s;
      // curves
      const mk = m => { const a = []; for(let x = 2; x <= 5.31; x += 0.03){ const P = Object.assign({}, p, {hc:Math.pow(10, x)}); a.push([Math.pow(10, x), Math.max(1e-3, model(P, m).f)]); } return a; };
      plot($('rh-plot'), {W:420, H:300, m:{l:56, r:12, t:12, b:44}, x:[100, 2e5], logx:true, y:[1e-3, 65536], logy:true, xlabel:t('HC_first（最弱單元的翻轉門檻 ACT 數）', 'HC_first (ACTs to flip the weakest cell)'), ylabel:t('翻轉位元 / 受害列', 'Flips per victim row'),
        xfmt:fmtK, yticks:[1e-3, 1e-1, 10, 1e3, 1e5].filter(v => v <= 65536).concat([65536]).slice(0, 5),
        series:[{pts:mk('none'), color:'var(--muted)', w:1.8}, {pts:mk('trr'), color:'var(--s1)', w: mit === 'trr' ? 3 : 1.6}, {pts:mk('rfm'), color:'var(--s2)', w: mit === 'rfm' ? 3 : 1.6}, {pts:mk('prac'), color:'var(--s3)', w: mit === 'prac' ? 3 : 1.6}],
        hlines:[{y:1, color:'var(--bad)', label:t('1 個位元', '1 bit')}],
        vlines:[{x:p.hc, color:'var(--ink)', dash:false, w:1.2, label:t('目前', 'now')}]});
    }
    render();
  };

  /* =====================================================================
     Wafer map: negative-binomial defects, repairable array area, analytic models
     ===================================================================== */
  function gammaSample(a, R){
    if(a < 1) return gammaSample(a + 1, R) * Math.pow(R(), 1 / a);
    const d = a - 1 / 3, c = 1 / Math.sqrt(9 * d);
    for(;;){
      let x, v;
      do { const u1 = R(), u2 = R(); x = Math.sqrt(-2 * Math.log(u1 || 1e-12)) * Math.cos(2 * Math.PI * u2); v = 1 + c * x; } while(v <= 0);
      v = v * v * v; const u = R();
      if(u < 1 - 0.0331 * x * x * x * x || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  }
  function poissonSample(l, R){ const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= R(); } while(p > L); return k - 1; }
  // P(no periphery defect and array defects <= cap), defects ~ gamma-Poisson with mean mu, shape alpha (0 = Poisson)
  function yieldRepair(mu, alpha, f, cap){
    let s = 0;
    for(let j = 0; j <= cap; j++){
      if(alpha === 0) s += Math.exp(-mu + j * Math.log(mu * f + 1e-300) - lgamma(j + 1));
      else { const th = mu / alpha; s += Math.exp(j * Math.log(f + 1e-300) - lgamma(j + 1) + lgamma(alpha + j) - lgamma(alpha) + j * Math.log(th) - (alpha + j) * Math.log(1 + th)); }
    }
    return Math.min(1, s);
  }
  INIT.wafer = function(){
    let seed = 7, edge = true;
    const area = range('wf-area', v => v + ' mm²', render);
    const d0 = range('wf-d0', v => v.toFixed(2) + ' /cm²', render);
    const arr = range('wf-arr', v => v + '%', render);
    const cap = range('wf-cap', v => v + t(' 個', ''), render);
    $('wf-alpha').addEventListener('change', render);
    toggle('wf-edge', v => { edge = v === '1'; render(); });
    $('wf-roll').addEventListener('click', () => { seed = Math.floor(Math.random() * 1e9); render(); });
    function render(){
      const A = area.get(), D = d0.get(), al = +$('wf-alpha').value, f = arr.get() / 100, C = cap.get();
      const R = rng(seed), s = Math.sqrt(A), Rw = 150, ex = 3, mu = A / 100 * D;
      const dies = [];
      for(let y = -Rw; y < Rw; y += s) for(let x = -Rw; x < Rw; x += s){
        const xs = x + ((Rw * 2) % s) / 2, ys = y + ((Rw * 2) % s) / 2;
        const ok = [[xs, ys], [xs + s, ys], [xs, ys + s], [xs + s, ys + s]].every(([a, b]) => a * a + b * b <= (Rw - ex) * (Rw - ex));
        if(!ok) continue;
        const r = Math.hypot(xs + s / 2, ys + s / 2) / Rw;
        let lam = mu * (edge ? 0.8 + 2.2 * Math.pow(r, 8) : 1);
        if(al > 0) lam *= gammaSample(al, R) / al;
        const n = poissonSample(lam, R);
        let pa = 0, pp = 0; for(let i = 0; i < n; i++) (R() < f ? pa++ : pp++);
        dies.push({x:xs, y:ys, st: pp > 0 || pa > C ? 'bad' : pa > 0 ? 'rep' : 'good'});
      }
      const g = dies.filter(d => d.st === 'good').length, rp = dies.filter(d => d.st === 'rep').length, n = dies.length;
      const yp = Math.exp(-mu), ynb = al === 0 ? yp : Math.pow(1 + mu / al, -al), yr = yieldRepair(mu, al, f, C);
      metrics($('wf-metrics'), [
        {l:t('每片晶粒數', 'Dies per wafer'), v:n, s:t('晶粒 ', 'Die ') + s.toFixed(2) + t(' mm 見方 · 邊緣除外 3 mm', ' mm square · 3 mm edge exclusion')},
        {l:t('本片良率（含修補）', 'This wafer\'s yield (with repair)'), v:((g + rp) / n * 100).toFixed(1), u:'%', cls: (g + rp) / n > 0.85 ? 'ok' : (g + rp) / n > 0.6 ? 'warn' : 'bad', s:t('良品 ', 'Good ') + g + t(' + 修補 ', ' + repaired ') + rp + t(' 顆', ' dies')},
        {l:t('修補前良率', 'Yield before repair'), v:(g / n * 100).toFixed(1), u:'%', s:t('修補救回 ', 'Repair recovers ') + (rp / n * 100).toFixed(1) + t(' 個百分點', ' points')},
        {l:t('模型預測', 'Model prediction'), v:(yr * 100).toFixed(1), u:'%', s:'Poisson ' + (yp * 100).toFixed(1) + t('% · 負二項 ', '% · neg. binomial ') + (ynb * 100).toFixed(1) + t('%（皆未修補）', '% (both without repair)')}
      ]);
      $('wf-sub').textContent = 'A·D₀ = ' + mu.toFixed(2);
      const W = 400, k = (W - 20) / (2 * Rw), cx = W / 2, cy = W / 2;
      const col = {good:'var(--ok)', rep:'var(--s1)', bad:'var(--bad)'};
      let svg = '<circle cx="' + cx + '" cy="' + cy + '" r="' + (Rw * k) + '" style="fill:var(--sunk);stroke:var(--line)"/>';
      dies.forEach(d => { svg += '<rect x="' + (cx + d.x * k + 0.6).toFixed(1) + '" y="' + (cy + d.y * k + 0.6).toFixed(1) + '" width="' + Math.max(0.5, s * k - 1.2).toFixed(1) + '" height="' + Math.max(0.5, s * k - 1.2).toFixed(1) + '" style="fill:' + col[d.st] + ';fill-opacity:.75"/>'; });
      svg += '<rect x="' + (cx - 8) + '" y="' + (cy + Rw * k - 3) + '" width="16" height="6" style="fill:var(--surface)"/>';
      const el = $('wf-map'); el.setAttribute('viewBox', '0 0 ' + W + ' ' + W); el.innerHTML = svg;
      const P = [], NB = [], RP = [];
      for(let a = 5; a <= 200; a += 2.5){ const m = a / 100 * D; P.push([a, Math.exp(-m) * 100]); NB.push([a, (al === 0 ? Math.exp(-m) : Math.pow(1 + m / al, -al)) * 100]); RP.push([a, yieldRepair(m, al, f, C) * 100]); }
      plot($('wf-plot'), {W:420, H:400, m:{l:52, r:12, t:12, b:44}, x:[5, 200], y:[0, 100], xlabel:t('晶粒面積 (mm²)', 'Die area (mm²)'), ylabel:t('良率 (%)', 'Yield (%)'),
        series:[{pts:P, color:'var(--muted)', w:1.8}, {pts:NB, color:'var(--s2)', w:2}, {pts:RP, color:'var(--s1)', w:2.6}],
        vlines:[{x:A, color:'var(--ink)', dash:false, w:1.2, label:t('目前', 'now')}]});
    }
    render();
  };

  /* =====================================================================
     HBM stack yield: KGD test escapes, per-layer bond / TSV yield, TSV repair
     ===================================================================== */
  INIT.hbm = function(){
    let rep = true, seed = 11;
    const yd = range('hb-y', v => v + '%', render);
    const esc = range('hb-esc', v => v + '%', render);
    const bond = range('hb-bond', v => v.toFixed(2) + '%', render);
    const base = range('hb-base', v => v + '%', render);
    $('hb-n').addEventListener('change', render);
    toggle('hb-rep', v => { rep = v === '1'; render(); });
    function calc(n, o){
      const Y = o.yd, e = o.esc, pass = Y + (1 - Y) * e, q = o.kgd ? Y / pass : Y;
      const b0 = o.bond, m = -Math.log(b0), b = o.rep ? Math.exp(-m) * (1 + m) : b0;
      const ys = o.base * Math.pow(q, n) * Math.pow(b, n);
      return {ys, q, b, pass};
    }
    function render(){
      const n = +$('hb-n').value;
      const o = {yd:yd.get() / 100, esc:esc.get() / 100, bond:bond.get() / 100, base:base.get() / 100, rep, kgd:true};
      const C = calc(n, o), noK = calc(n, Object.assign({}, o, {kgd:false}));
      const cost = (n + 1.5 + 2) / C.ys;
      const diesPerGood = n / C.ys / C.pass;
      metrics($('hb-metrics'), [
        {l:t('堆疊良率', 'Stack yield'), v:(C.ys * 100).toFixed(1), u:'%', cls: C.ys > 0.85 ? 'ok' : C.ys > 0.6 ? 'warn' : 'bad', s:t('不做 KGD 測試：', 'Without KGD test: ') + (noK.ys * 100).toFixed(1) + '%'},
        {l:t('通過測試的晶粒真的是好的', 'Passed dies that are truly good'), v:(C.q * 100).toFixed(2), u:'%', s:t('測試通過率 ', 'Test pass rate ') + (C.pass * 100).toFixed(1) + '%'},
        {l:t('每層接合良率（有效）', 'Per-layer bond yield (effective)'), v:(C.b * 100).toFixed(3), u:'%', s: rep ? t('TSV 備援修補後', 'After TSV redundancy repair') : t('無修補', 'No repair')},
        {l:t('每個良品堆疊消耗晶圓晶粒', 'Wafer dies consumed per good stack'), v:diesPerGood.toFixed(1), u:t('顆', 'dies'), s:t('成本指數 ', 'Cost index ') + cost.toFixed(1) + t('（理想值 ', ' (ideal ') + (n + 3.5).toFixed(1) + t('）', ')')}
      ]);
      $('hb-sub').textContent = n + t('-Hi + 基底晶粒', '-Hi + base die');
      // stack drawing + 24 sampled stacks
      const W = 420, H = 300, lh = Math.min(14, 200 / (n + 1));
      let s = '<rect x="20" y="' + (H - 40) + '" width="160" height="16" rx="2" class="c6" style="stroke-width:1"/><text x="100" y="' + (H - 28) + t('" text-anchor="middle" class="ts">基底晶粒</text>', '" text-anchor="middle" class="ts">Base die</text>');
      for(let i = 0; i < n; i++){
        const y = H - 44 - (i + 1) * (lh + 2);
        s += '<rect x="30" y="' + y.toFixed(1) + '" width="140" height="' + lh.toFixed(1) + '" rx="2" class="c1" style="stroke-width:1"/>';
        if(lh >= 11) s += '<text x="100" y="' + (y + lh - 3).toFixed(1) + '" text-anchor="middle" class="ts">' + 'DRAM ' + (i + 1) + '</text>';
      }
      s += '<path d="M60 ' + (H - 40) + 'V' + (H - 44 - n * (lh + 2)) + 'M140 ' + (H - 40) + 'V' + (H - 44 - n * (lh + 2)) + '" style="stroke:var(--ink);stroke-width:1.5;stroke-dasharray:2 2"/>';
      s += '<text x="100" y="' + (H - 6) + t('" text-anchor="middle" class="ts t-mut">虛線：TSV</text>', '" text-anchor="middle" class="ts t-mut">Dashed: TSVs</text>');
      const R = rng(seed + n * 7 + Math.round(C.ys * 1000)); let goodN = 0;
      s += t('<text x="300" y="20" text-anchor="middle" class="ts">抽樣 24 個堆疊</text>', '<text x="300" y="20" text-anchor="middle" class="ts">24 sampled stacks</text>');
      for(let i = 0; i < 24; i++){
        const ok = R() < C.ys; if(ok) goodN++;
        const x = 210 + (i % 6) * 34, y = 34 + Math.floor(i / 6) * 58;
        for(let j = 0; j < Math.min(n, 16); j++) s += '<rect x="' + x + '" y="' + (y + 44 - j * 2.8).toFixed(1) + '" width="26" height="2.2" style="fill:' + (ok ? 'var(--ok)' : 'var(--bad)') + ';opacity:.8"/>';
        s += '<rect x="' + (x - 2) + '" y="' + (y + 47) + '" width="30" height="4" style="fill:var(--muted)"/>';
      }
      s += '<text x="300" y="' + (H - 6) + '" text-anchor="middle" class="ts t-mut">' + goodN + t(' / 24 良品</text>', ' / 24 good</text>');
      const el = $('hb-stack'); el.setAttribute('viewBox', '0 0 ' + W + ' ' + H); el.innerHTML = s;
      const c1 = [], c2 = [], c3 = [];
      for(let k = 1; k <= 16; k++){
        c1.push([k, calc(k, Object.assign({}, o, {kgd:false})).ys * 100]);
        c2.push([k, calc(k, Object.assign({}, o, {rep:false})).ys * 100]);
        c3.push([k, calc(k, Object.assign({}, o, {rep:true})).ys * 100]);
      }
      plot($('hb-plot'), {W:420, H:300, m:{l:52, r:12, t:12, b:44}, x:[1, 16], y:[0, 100], xticks:[1, 4, 8, 12, 16], xlabel:t('堆疊層數', 'Stack height'), ylabel:t('堆疊良率 (%)', 'Stack yield (%)'),
        series:[{pts:c1, color:'var(--muted)', w:1.8}, {pts:c2, color:'var(--s2)', w:2}, {pts:c3, color:'var(--s1)', w:2.6}],
        vlines:[{x:n, color:'var(--ink)', dash:false, w:1.2, label:n + '-Hi'}]});
    }
    render();
  };

  /* =====================================================================
     Cost per Gb: dies per wafer, yield, back-end cost, next-node comparison
     ===================================================================== */
  INIT.cost = function(){
    const PRE = {dram:{wafer:7000, area:38, gb:16, y:85, be:0.6}, hbm:{wafer:8000, area:110, gb:24, y:70, be:2}, nand:{wafer:5000, area:70, gb:1024, y:90, be:0.8}};
    const wafer = range('co-wafer', v => '$' + v.toLocaleString(), render);
    const area = range('co-area', v => v + ' mm²', render);
    const gb = range('co-gb', v => v >= 1024 ? v / 1024 + ' Tb' : v + ' Gb', render);
    const yl = range('co-y', v => v + '%', render);
    const be = range('co-be', v => '$' + v.toFixed(2), render);
    const shr = range('co-shr', v => v + '%', render);
    const wup = range('co-wup', v => '+' + v + '%', render);
    const ydrop = range('co-ydrop', v => '−' + v + t(' 點', ' pts'), render);
    toggle('co-pre', v => { const p = PRE[v]; wafer.set(p.wafer); area.set(p.area); gb.set(p.gb); yl.set(p.y); be.set(p.be); render(); });
    const dpw = A => Math.max(0, Math.floor(Math.PI * 150 * 150 / A - Math.PI * 300 / Math.sqrt(2 * A)));
    const cpg = (W, A, G, Y, B) => (W / (dpw(A) * Y) + B) / G;
    function render(){
      const W = wafer.get(), A = area.get(), G = gb.get(), Y = yl.get() / 100, B = be.get();
      const W2 = W * (1 + wup.get() / 100), A2 = A * shr.get() / 100, Y2 = Math.max(0.05, Y - ydrop.get() / 100);
      const n = dpw(A), good = n * Y, c = cpg(W, A, G, Y, B), c2 = cpg(W2, A2, G, Y2, B), c2m = cpg(W2, A2, G, Y, B);
      const ch = (c2 / c - 1) * 100;
      metrics($('co-metrics'), [
        {l:t('每片晶圓晶粒數', 'Dies per wafer'), v:n.toLocaleString(), s:t('良品 ', 'Good ') + Math.round(good).toLocaleString() + t(' 顆', ' dies')},
        {l:t('每片晶圓良品位元', 'Good bits per wafer'), v:(good * G / 8 / 1024).toFixed(1), u:'TB'},
        {l:t('每顆良品成本', 'Cost per good die'), v:'$' + (c * G).toFixed(2), s:t('前段 $', 'Front end $') + (W / good).toFixed(2) + t(' + 後段 $', ' + back end $') + B.toFixed(2)},
        {l:t('每 Gb 成本', 'Cost per Gb'), v:'$' + (c < 0.01 ? c.toFixed(4) : c.toFixed(3)), s:t('每 GB $', 'Per GB $') + (c * 8).toFixed(2)},
        {l:t('下一代（初期良率）', 'Next node (early yield)'), v:(ch >= 0 ? '+' : '') + ch.toFixed(1), u:'%', cls: ch < 0 ? 'ok' : 'bad', s:t('良率爬回原水準後 ', 'After yield recovers ') + ((c2m / c - 1) * 100).toFixed(1) + '%'}
      ]);
      const a1 = [], a2 = [];
      for(let y = 30; y <= 99; y += 1){ a1.push([y, cpg(W, A, G, y / 100, B)]); a2.push([y, cpg(W2, A2, G, y / 100, B)]); }
      const ymax = Math.max(a1[0][1], a2[0][1]) * 1.05;
      plot($('co-plot'), {W:640, H:300, x:[30, 99], y:[0, ymax], xlabel:t('良率 (%)', 'Yield (%)'), ylabel:t('每 Gb 成本 ($)', 'Cost per Gb ($)'), yfmt: v => '$' + (+v.toPrecision(3)),
        series:[{pts:a1, color:'var(--accent)', w:2.6}, {pts:a2, color:'var(--s2)', w:2.2}],
        vlines:[{x:Y * 100, color:'var(--accent)', label:t('目前', 'now')}, {x:Y2 * 100, color:'var(--s2)', label:t('下一代初期', 'next node, early'), dy:16, anchor:'end'}]});
    }
    render();
  };
  /* =====================================================================
     Shmoo: alpha-power speed model with temperature inversion, Vmin wall, guard bands, speed bins
     ===================================================================== */
  INIT.shmoo = function(){
    const A = 1.3, MU = 1.6, VT0 = 0.40, KT = 0.0022, D0 = 75.2;      // tuned: TT 25 °C 1.1 V ≈ 7600 MT/s, inversion near 0.94 V
    const BINS = [4800, 5600, 6400, 7200, 8000];
    const VNOM = 1.1, VTOL = 0.055, TCUST = [0, 95];
    let holes = false;
    const sig = range('sh-sig', v => (v >= 0 ? '+' : '') + v.toFixed(2) + ' σ', render);
    const temp = range('sh-temp', v => v + ' °C', render);
    const gbt = range('sh-gbt', v => v + '%', render);
    const gbv = range('sh-gbv', v => v + ' mV', render);
    ['sh-corner', 'sh-bin'].forEach(id => $(id).addEventListener('change', render));
    toggle('sh-holes', v => { holes = v === '1'; render(); });

    const dly = (V, T, k) => { const vt = VT0 - KT * (T - 25); if(V <= vt + 0.02) return Infinity; return D0 * k * Math.pow((T + 273) / 298, MU) * V / Math.pow(V - vt, A); };
    const fmax = (V, T, k) => 1e6 / dly(V, T, k);                          // MT/s
    const vmin = (T, s) => 0.80 + 0.0005 * Math.max(0, 25 - T) + 0.012 * s;  // functional wall (SA / keepers worse when cold)
    const hash = (a, b) => { let h = Math.imul(a * 73856093 ^ b * 19349663, 0x9E3779B1); h ^= h >>> 15; return (h >>> 0) / 4294967296; };
    const passAt = (V, rate, T, k, s, useHoles, ix, iy) => {
      if(V < vmin(T, s)) return false;
      const f = fmax(V, T, k);
      if(rate > f) return false;
      if(useHoles && rate > f * 0.95 && hash(ix, iy) < 0.35) return false;  // marginal, pattern-dependent fails near the edge
      return true;
    };
    // a window passes if its worst corners pass (speed is monotonic in V, so check low-V corner at the rate, plus the Vmin wall)
    const windowPass = (vlo, rate, T, k, s) => vlo >= vmin(T, s) && rate <= fmax(vlo, T, k);

    function render(){
      const k = +$('sh-corner').value * (1 + 0.04 * sig.get()), s = sig.get(), T = temp.get();
      const bin = +$('sh-bin').value, gT = gbt.get() / 100, gV = gbv.get() / 1000;
      const specLo = VNOM - VTOL, specHi = VNOM + VTOL;
      const testLo = specLo - gV, testHi = specHi + gV, testRate = bin * (1 + gT);
      const passSpec = windowPass(specLo, bin, T, k, s);
      const passTest = windowPass(testLo, testRate, T, k, s);
      const allTemp = TCUST.every(tc => windowPass(specLo, bin, tc, k, s));
      let best = null;
      BINS.forEach(b => { if(windowPass(testLo, b * (1 + gT), T, k, s)) best = b; });
      const verdict = passTest ? (allTemp ? 'ship' : 'escape') : (passSpec && allTemp) ? 'overkill' : 'reject';
      const VERD = {ship:[t('出貨', 'Ship'), 'ok', t('測試通過，全溫也符合規格', 'Passes test and meets spec at all temperatures')],
        escape:[t('漏網風險', 'Escape risk'), 'bad', t('測試溫度下通過，但客戶溫度範圍內會失效', 'Passes at test temperature but fails within the customer temperature range')],
        overkill:[t('誤殺', 'Overkill'), 'warn', t('符合規格，但沒通過含 guard band 的測試', 'Meets spec but fails the guard-banded test')],
        reject:[t('正確剔除', 'Correct reject'), '', t('在規格條件（某個客戶溫度）下就會失敗', 'Fails at spec conditions (at some customer temperature)')]};
      const vAtBin = (() => { let lo = 0.6, hi = 1.6; if(fmax(hi, T, k) < bin) return null; for(let i = 0; i < 40; i++){ const m = (lo + hi) / 2; if(fmax(m, T, k) >= bin) hi = m; else lo = m; } return Math.max(hi, vmin(T, s)); })();
      metrics($('sh-metrics'), [
        {l:t('判定', 'Verdict'), v:VERD[verdict][0], cls:VERD[verdict][1], s:VERD[verdict][2]},
        {l:t('最高可出貨等級', 'Highest shippable bin'), v: best ? best : '—', u: best ? 'MT/s' : '', s:t('在測試溫度、含 guard band', 'at test temperature, with guard band')},
        {l:t('1.1 V 時最高速度', 'Max speed at 1.1 V'), v:Math.round(fmax(VNOM, T, k)), u:'MT/s'},
        {l:t('目標速度所需最低 V<sub>DD</sub>', 'Min V<sub>DD</sub> for target bin'), v: vAtBin ? vAtBin.toFixed(3) : '—', u:'V', s:t('規格下限 ', 'spec low ') + specLo.toFixed(3) + ' V'},
        {l:t('全溫檢查（0 / 95 °C）', 'All-temperature check (0 / 95 °C)'), v: allTemp ? t('通過', 'Pass') : t('失敗', 'Fail'), cls: allTemp ? 'ok' : 'bad', s: TCUST.map(tc => tc + ' °C: ' + Math.round(fmax(specLo, tc, k))).join(' · ') + ' MT/s @ ' + specLo.toFixed(3) + ' V'}
      ]);
      $('sh-sub').textContent = t('測試溫度 ', 'test temp ') + T + ' °C · ' + t('測試速度 ', 'test rate ') + Math.round(testRate) + ' MT/s';
      // grid
      const V0 = 0.80, dV = 0.02, NV = 26, R0 = 3200, dR = 400, NR = 17;
      const W = 640, H = 400, m = {l:62, r:14, t:12, b:46}, cw = (W - m.l - m.r) / NV, ch = (H - m.t - m.b) / NR;
      const X = v => m.l + (v - V0 + dV / 2) / dV * cw, Y = r => m.t + (NR - 1 - (r - R0) / dR) * ch;
      let svg = '';
      for(let iy = 0; iy < NR; iy++) for(let ix = 0; ix < NV; ix++){
        const V = V0 + ix * dV, rate = R0 + iy * dR, ok = passAt(V, rate, T, k, s, holes, ix, iy);
        svg += '<rect x="' + (m.l + ix * cw + 1).toFixed(1) + '" y="' + (Y(rate) - ch / 2 + 1).toFixed(1) + '" width="' + (cw - 2).toFixed(1) + '" height="' + (ch - 2).toFixed(1) + '" rx="2" style="fill:' + (ok ? 'var(--s3)' : 'var(--s4)') + ';opacity:' + (ok ? .72 : .5) + '"/>';
      }
      const box = (vlo, vhi, rate, col, dash, w) => '<rect x="' + X(vlo).toFixed(1) + '" y="' + (Y(rate) - ch / 2).toFixed(1) + '" width="' + (X(vhi) - X(vlo)).toFixed(1) + '" height="' + ch.toFixed(1) + '" style="fill:none;stroke:' + col + ';stroke-width:' + w + (dash ? ';stroke-dasharray:' + dash : '') + '"/>';
      svg += box(specLo, specHi, bin, 'var(--ink)', '6 3', 2.5);
      if(testRate <= R0 + (NR - 1) * dR + dR / 2) svg += box(testLo, testHi, Math.min(testRate, R0 + (NR - 1) * dR), 'var(--accent)', '', 2);
      for(let iy = 0; iy < NR; iy += 2) svg += '<text x="' + (m.l - 6) + '" y="' + (Y(R0 + iy * dR) + 4).toFixed(1) + '" text-anchor="end" class="ts t-mono t-mut">' + (R0 + iy * dR) + '</text>';
      for(let ix = 0; ix < NV; ix += 5) svg += '<text x="' + X(V0 + ix * dV).toFixed(1) + '" y="' + (H - m.b + 16) + '" text-anchor="middle" class="ts t-mono t-mut">' + (V0 + ix * dV).toFixed(2) + '</text>';
      svg += '<text x="' + ((W + m.l) / 2) + '" y="' + (H - 8) + '" text-anchor="middle" class="ts t-mut">V_DD (V)</text>';
      svg += '<text x="14" y="' + (H / 2) + '" text-anchor="middle" class="ts t-mut" transform="rotate(-90 14 ' + (H / 2) + ')">' + t('資料速率 (MT/s)', 'Data rate (MT/s)') + '</text>';
      const el = $('sh-plot'); el.setAttribute('viewBox', '0 0 ' + W + ' ' + H); el.innerHTML = svg;
      // speed vs V at four temperatures (same die)
      const series = [[-40, 'var(--s1)'], [25, 'var(--s3)'], [95, 'var(--s2)'], [125, 'var(--s4)']].map(([tc, col]) => {
        const pts = []; for(let V = 0.8; V <= 1.301; V += 0.01) pts.push([V, Math.min(12000, fmax(V, tc, k))]);
        return {pts, color:col, w: tc === T ? 3 : 1.6};
      });
      plot($('sh-temps'), {W:640, H:260, x:[0.8, 1.3], y:[2000, 11000], xlabel:'V_DD (V)', ylabel:t('最高速度 (MT/s)', 'Max speed (MT/s)'), series,
        hlines:[{y:bin, color:'var(--ink)', label:t('目標 ', 'target ') + bin}],
        vlines:[{x:0.94, color:'var(--muted)', label:t('反轉點 ≈ 0.94 V', 'inversion ≈ 0.94 V')}, {x:specLo, color:'var(--ink)', label:t('規格下限', 'spec low'), dy:16, anchor:'end'}]});
    }
    render();
  };
  /* =====================================================================
     Voltage screening: Vmin / Vmax margin tests, VLV, Vmin PAT and VHV stress on a die population
     ===================================================================== */
  INIT.voltage = function(){
    const MU = 0.80, VMIN_TEST = 1.02, SPEC_HI = 1.155;
    const P = {H:1 - 6000e-6, R:3000e-6, L:2000e-6, V:1000e-6};
    const DA = 0.03, DB = 0.25, VF0 = 1.12, VF1 = 1.30;
    const FIELD = {R:0.5, L:0.6, D:0.3};
    const on = {vmin:true, vmax:true, vlv:false, pat:false, vhv:false};
    ['vmin', 'vmax', 'vlv', 'pat', 'vhv'].forEach(k => toggle('vt-' + k, v => { on[k] = v === '1'; render(); }));
    const sig = range('vt-sig', v => v + ' mV', render);
    const vmaxv = range('vt-vmaxv', v => v.toFixed(3) + ' V', render);
    const vlvv = range('vt-vlvv', v => v.toFixed(3) + ' V (' + (v / 1.1).toFixed(2) + '×)', render);
    const kk = range('vt-k', v => v.toFixed(2), render);
    const vhvr = range('vt-vhvr', v => v.toFixed(2) + '× (' + (v * 1.1).toFixed(2) + ' V)', render);
    const vhvt = range('vt-vhvt', v => { const s = Math.pow(10, v); return s < 1 ? Math.round(s * 1000) + ' ms' : s.toPrecision(2) + ' s'; }, render);
    const clamp01 = x => Math.max(0, Math.min(1, x));
    const fmtP = x => x >= 100 ? Math.round(x).toLocaleString() : x >= 1 ? x.toFixed(1) : x >= 0.01 ? x.toFixed(2) : x > 0 ? '<0.01' : '0';

    function render(){
      const s = sig.get() / 1000;
      const lims = [];
      if(on.vmin) lims.push(VMIN_TEST);
      if(on.vlv) lims.push(vlvv.get());
      if(on.pat) lims.push(MU + kk.get() * s);
      const T = lims.length ? Math.min(...lims) : Infinity;
      const hRej = isFinite(T) ? Q((T - MU) / s) : 0;
      // resistive: Vmin = MU + delta + noise, delta ~ U(DA, DB)
      let cR = 0;
      if(isFinite(T)){ const n = 60; for(let i = 0; i < n; i++){ const d = DA + (i + 0.5) * (DB - DA) / n; cR += Q((T - MU - d) / s) / n; } }
      // latent oxide: only VHV converts them
      const r = vhvr.get(), tt = Math.pow(10, vhvt.get());
      const conv = on.vhv ? 1 - Math.exp(-tt / (0.5 * Math.exp(20 * (1.4 - r)))) : 0;
      const dmg = on.vhv ? 1 - Math.exp(-tt / (1e11 * Math.exp(-40 * (r - 1)))) : 0;
      const cL = conv + (1 - conv) * hRej;
      // high-voltage sensitive: fail point Vf ~ U(VF0, VF1)
      const vtop = on.vmax ? vmaxv.get() : 1.1;
      const cV = clamp01((vtop - VF0) / (VF1 - VF0));
      const vFieldEsc = P.V * clamp01((SPEC_HI - Math.max(vtop, VF0)) / (VF1 - VF0));

      const goodShip = P.H * (1 - hRej);
      const escR = P.R * (1 - cR), escL = P.L * (1 - cL);
      const shipped = goodShip + escR + escL + P.V * (1 - cV);
      const escapes = escR + escL + vFieldEsc;
      const field = FIELD.R * escR + FIELD.L * escL + vFieldEsc + FIELD.D * goodShip * dmg;
      const ppm = x => x * 1e6;

      metrics($('vt-metrics'), [
        {l:t('良率（出貨比例）', 'Yield (shipped)'), v:(shipped * 100).toFixed(2), u:'%'},
        {l:t('誤殺健康晶片', 'Healthy dies overkilled'), v:fmtP(ppm(P.H * hRej)), u:'ppm', cls: ppm(P.H * hRej) < 100 ? 'ok' : ppm(P.H * hRej) < 2000 ? 'warn' : 'bad'},
        {l:t('出貨中的不良品', 'Defective among shipped'), v:fmtP(escapes / shipped * 1e6), u:'DPPM', cls: escapes / shipped * 1e6 < 300 ? 'ok' : escapes / shipped * 1e6 < 2000 ? 'warn' : 'bad', s:t('會在規格條件下失效的晶片', 'dies that will fail within spec')},
        {l:t('預期現場失效', 'Expected field failures'), v:fmtP(field / shipped * 1e6), u:'DPPM', cls: field / shipped * 1e6 < 300 ? 'ok' : field / shipped * 1e6 < 2000 ? 'warn' : 'bad', s:t('含 VHV 對健康晶片的損傷', 'incl. VHV damage to healthy dies')},
        {l:t('VHV：潛在缺陷轉換率', 'VHV: latent conversion'), v: on.vhv ? (conv * 100).toFixed(1) : '—', u: on.vhv ? '%' : '', s: on.vhv ? t('健康晶片受損 ', 'healthy damaged ') + fmtP(ppm(dmg)) + ' ppm' : t('未啟用', 'off')}
      ]);

      const row = (name, pop, caught, esc, fld) => '<tr><td>' + name + '</td><td class="n">' + fmtP(ppm(pop)) + '</td><td class="n">' + fmtP(ppm(caught)) + '</td><td class="n">' + fmtP(ppm(esc)) + '</td><td class="n">' + fmtP(ppm(fld)) + '</td></tr>';
      $('vt-table').innerHTML = '<tr><th>' + t('類別', 'Class') + '</th><th class="n">' + t('母體 ppm', 'Population ppm') + '</th><th class="n">' + t('被剔除', 'Rejected') + '</th><th class="n">' + t('出貨', 'Shipped') + '</th><th class="n">' + t('現場失效', 'Field fails') + '</th></tr>' +
        row(t('健康晶片', 'Healthy'), P.H, P.H * hRej, goodShip, FIELD.D * goodShip * dmg) +
        row(t('電阻性缺陷', 'Resistive defect'), P.R, P.R * cR, escR, FIELD.R * escR) +
        row(t('潛在氧化層缺陷', 'Latent oxide defect'), P.L, P.L * cL, escL, FIELD.L * escL) +
        row(t('高壓敏感缺陷', 'High-V sensitive'), P.V, P.V * cV, P.V * (1 - cV), vFieldEsc);

      // Vmin distribution
      const H = [], Rd = [];
      let peak = 0;
      for(let v = 0.70; v <= 1.15001; v += 0.002){
        const h = P.H * 1e6 * Math.exp(-0.5 * Math.pow((v - MU) / s, 2)) / (s * Math.sqrt(2 * Math.PI)) / 1000;
        const rd = P.R * 1e6 / (DB - DA) * (Phi((v - MU - DA) / s) - Phi((v - MU - DB) / s)) / 1000;
        peak = Math.max(peak, h); H.push([v, h]); Rd.push([v, rd]);
      }
      const vl = (x, label, active, dy) => ({x, color: active ? 'var(--accent)' : 'var(--muted)', dash: active ? false : '3 4', w: active ? 1.8 : 1, label: label + (active ? '' : t('（關）', ' (off)')), dy});
      plot($('vt-plot'), {W:640, H:300, x:[0.70, 1.15], y:[1e-3, peak * 3], logy:true, xlabel:'Vmin (V)', ylabel:t('晶粒數 / 百萬 / mV', 'dies / million / mV'),
        series:[{pts:H, color:'var(--s3)', w:2, fill:true, op:.15}, {pts:Rd, color:'var(--s4)', w:2, fill:true, op:.15}],
        vlines:[vl(VMIN_TEST, t('Vmin 測試', 'Vmin test'), on.vmin, 0), vl(vlvv.get(), 'VLV', on.vlv, 16), vl(MU + kk.get() * s, 'PAT', on.pat, 32)]});
    }
    render();
  };
})();
