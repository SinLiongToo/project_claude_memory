/* Memory Spec Designer — first-order sizing for DRAM devices/systems, 3D NAND dies/SSDs and SRAM macros. */
(function(){
  const t = (window.MemSite && window.MemSite.t) || (zh => zh);
  const {plot, fmtSci} = window.MemPlot;
  const $ = id => document.getElementById(id);
  const log2 = Math.log2, ceil = Math.ceil;
  const r = (v, d) => +(+v).toFixed(d === undefined ? 2 : d);
  const pow2 = v => Math.abs(log2(v) - Math.round(log2(v))) < 1e-9;
  const opts = arr => arr.map(v => Array.isArray(v) ? v : [v, String(v)]);

  /* ===================== field schemas ===================== */
  const DRAM_F = [
    {g:t('元件組織', 'Device organization')},
    {k:'den', l:t('晶粒容量', 'Die density'), t:'sel', o:opts([[4,'4 Gb'],[8,'8 Gb'],[16,'16 Gb'],[24,'24 Gb'],[32,'32 Gb'],[64,'64 Gb']])},
    {k:'io', l:t('I/O 位寬', 'I/O width'), t:'sel', o:opts([[4,'x4'],[8,'x8'],[16,'x16'],[32,'x32'],[64,t('x64（HBM 偽通道）', 'x64 (HBM pseudo-channel)')]])},
    {k:'rate', l:t('每腳速率', 'Data rate per pin'), t:'num', u:'MT/s', min:200, step:100},
    {k:'bg', l:t('Bank group 數', 'Bank groups'), t:'sel', o:opts([1,2,4,8])},
    {k:'bpg', l:t('每組 bank 數', 'Banks per group'), t:'sel', o:opts([2,4,8])},
    {k:'page', l:t('Page 大小', 'Page size'), t:'sel', o:opts([[0.5,'0.5 KB'],[1,'1 KB'],[2,'2 KB'],[4,'4 KB']])},
    {k:'bl', l:t('Burst length / 預取', 'Burst length / prefetch'), t:'sel', o:opts([[8,'BL8'],[16,'BL16'],[32,'BL32']])},
    {g:t('單元與陣列', 'Cell & array')},
    {k:'F', l:t('特徵尺寸 F', 'Feature size F'), t:'num', u:'nm', min:8, max:60, step:0.5, h:t('1β/1γ 世代約 12–13 nm 等級', '1β/1γ class is roughly 12–13 nm')},
    {k:'cellF', l:t('單元面積', 'Cell area'), t:'sel', o:opts([[6,t('6F²（現行）', '6F² (current)')],[4,t('4F²（VCT）', '4F² (VCT)')],[8,t('8F²（摺疊式）', '8F² (folded)')]])},
    {k:'eff', l:t('陣列效率', 'Array efficiency'), t:'num', u:'%', min:20, max:80, step:1, h:t('陣列佔晶粒面積比例，DRAM 通常 40–55%', 'Share of die area that is cell array; DRAM is usually 40–55%')},
    {k:'vdd', l:t('陣列電壓', 'Array voltage'), t:'num', u:'V', min:0.5, max:2, step:0.05},
    {k:'cs', l:t('單元電容 C<sub>s</sub>', 'Cell capacitance C<sub>s</sub>'), t:'num', u:'fF', min:1, max:40, step:0.5},
    {k:'cpb', l:t('每條位元線單元數', 'Cells per bit line'), t:'sel', o:opts([256,512,1024,2048]), h:t('C<sub>BL</sub> ≈ 0.06 fF × 單元數 + 8 fF', 'C<sub>BL</sub> ≈ 0.06 fF × cells + 8 fF')},
    {k:'off', l:t('SA 偏移', 'SA offset'), t:'num', u:'mV', min:0, max:100, step:1},
    {g:'Refresh'},
    {k:'trefw', l:t('Refresh 視窗', 'Refresh window'), t:'sel', o:opts([[16,'16 ms'],[32,'32 ms'],[64,'64 ms']])},
    {k:'trfc', l:'tRFC', t:'num', u:'ns', min:50, max:1000, step:5},
    {g:t('系統配置', 'System')},
    {k:'sys', l:t('配置方式', 'Configuration'), t:'sel', o:[['dimm',t('DIMM（每通道一條）', 'DIMM (one per channel)')],['p2p',t('點對點（LPDDR / GDDR）', 'Point-to-point (LPDDR / GDDR)')],['hbm',t('HBM 堆疊', 'HBM stacks')]]},
    {k:'ranks', l:t('每條 DIMM rank 數', 'Ranks per DIMM'), t:'num', min:1, max:4, step:1, show:v => v.sys === 'dimm'},
    {k:'ecc', l:'ECC', t:'sel', o:[[1,t('有（+8 bit / 32 bit 子通道 ×2）', 'Yes (+8 bits per 32-bit sub-channel ×2)')],[0,t('無', 'No')]], show:v => v.sys === 'dimm'},
    {k:'ch', l:t('通道數', 'Channels'), t:'num', min:1, max:24, step:1, show:v => v.sys === 'dimm'},
    {k:'ndev', l:t('晶片數量', 'Number of devices'), t:'num', min:1, max:32, step:1, show:v => v.sys === 'p2p'},
    {k:'dies', l:t('每堆疊層數', 'Dies per stack'), t:'sel', o:opts([4,8,12,16]), show:v => v.sys === 'hbm'},
    {k:'ifw', l:t('每堆疊介面寬度', 'Interface width per stack'), t:'sel', o:opts([[1024,'1024 bit'],[2048,'2048 bit']]), show:v => v.sys === 'hbm'},
    {k:'stacks', l:t('堆疊數', 'Stacks'), t:'num', min:1, max:16, step:1, show:v => v.sys === 'hbm'}
  ];
  const NAND_F = [
    {g:t('晶粒', 'Die')},
    {k:'cap', l:t('晶粒容量', 'Die density'), t:'sel', o:opts([[256,'256 Gb'],[512,'512 Gb'],[1024,'1 Tb'],[2048,'2 Tb']])},
    {k:'bpc', l:t('每單元位元數', 'Bits per cell'), t:'sel', o:opts([[1,'SLC'],[2,'MLC'],[3,'TLC'],[4,'QLC']])},
    {k:'layers', l:t('字元線層數', 'Word-line layers'), t:'num', min:24, max:1000, step:1},
    {k:'planes', l:t('Plane 數', 'Planes'), t:'sel', o:opts([1,2,4,6,8])},
    {k:'page', l:t('Page 大小', 'Page size'), t:'sel', o:opts([[4,'4 KB'],[8,'8 KB'],[16,'16 KB']])},
    {k:'spb', l:t('每 block 子區塊（string）數', 'Sub-blocks (strings) per block'), t:'num', min:1, max:16, step:1, h:t('pages/block = 層數 × 子區塊 × bit/cell', 'pages/block = layers × sub-blocks × bits/cell')},
    {k:'tprog', l:t('t<sub>PROG</sub>（一次寫入整條 WL）', 't<sub>PROG</sub> (one full word line)'), t:'num', u:'µs', min:50, max:5000, step:10},
    {k:'tr', l:'t<sub>R</sub>', t:'num', u:'µs', min:5, max:500, step:1},
    {k:'rate', l:t('介面速率', 'Interface speed'), t:'num', u:'MT/s', min:200, max:6000, step:100, h:t('8-bit 匯流排，1 MT/s = 1 MB/s', '8-bit bus, 1 MT/s = 1 MB/s')},
    {g:'SSD'},
    {k:'ch', l:t('控制器通道數', 'Controller channels'), t:'num', min:1, max:32, step:1},
    {k:'dpc', l:t('每通道晶粒數', 'Dies per channel'), t:'num', min:1, max:32, step:1},
    {k:'pcie', l:t('主機介面', 'Host interface'), t:'sel', o:[[3.5,t('PCIe 3.0 x4（~3.5 GB/s）', 'PCIe 3.0 x4 (~3.5 GB/s)')],[7,t('PCIe 4.0 x4（~7 GB/s）', 'PCIe 4.0 x4 (~7 GB/s)')],[14,t('PCIe 5.0 x4（~14 GB/s）', 'PCIe 5.0 x4 (~14 GB/s)')],[28,t('PCIe 6.0 x4（~28 GB/s）', 'PCIe 6.0 x4 (~28 GB/s)')]]},
    {k:'op', l:t('預留空間 OP', 'Over-provisioning OP'), t:'num', u:'%', min:0, max:100, step:1},
    {k:'pe', l:t('額定 P/E 次數', 'Rated P/E cycles'), t:'num', min:100, max:200000, step:100},
    {k:'waf', l:t('寫入放大 WAF', 'Write amplification WAF'), t:'num', min:1, max:20, step:0.1}
  ];
  const NODES = [['0.120',t('28 nm（~0.120 µm²）', '28 nm (~0.120 µm²)')], ['0.074',t('16 nm（~0.074 µm²）', '16 nm (~0.074 µm²)')], ['0.027',t('7 nm（~0.027 µm²）', '7 nm (~0.027 µm²)')], ['0.021',t('5 nm / 3 nm（~0.021 µm²）', '5 nm / 3 nm (~0.021 µm²)')], ['0.0175',t('2 nm（~0.0175 µm²）', '2 nm (~0.0175 µm²)')]];
  const SRAM_F = [
    {g:t('巨集規格', 'Macro spec')},
    {k:'words', l:t('字數 words', 'Words'), t:'num', min:16, max:1048576, step:16},
    {k:'bits', l:t('字寬 bits', 'Bits per word'), t:'num', min:1, max:576, step:1},
    {k:'mux', l:t('行多工 column mux', 'Column mux'), t:'sel', o:opts([2,4,8,16,32])},
    {k:'banks', l:t('Bank / 子陣列數', 'Banks / sub-arrays'), t:'sel', o:opts([1,2,4,8,16,32,64,128])},
    {k:'freq', l:t('目標頻率（單週期存取）', 'Target frequency (single-cycle access)'), t:'num', u:'MHz', min:50, max:6000, step:50},
    {g:t('製程與電路', 'Process & circuit')},
    {k:'node', l:t('位元胞面積', 'Bitcell area'), t:'sel', o:NODES},
    {k:'eff', l:t('面積效率', 'Area efficiency'), t:'num', u:'%', min:30, max:90, step:1, h:t('位元胞總面積 ÷ 巨集面積', 'Total bitcell area ÷ macro area')},
    {k:'vdd', l:'V<sub>DD</sub>', t:'num', u:'V', min:0.4, max:1.2, step:0.05},
    {k:'icell', l:t('單元讀取電流', 'Cell read current'), t:'num', u:'µA', min:1, max:100, step:1},
    {k:'cbit', l:t('每單元位元線電容', 'Bit-line capacitance per cell'), t:'num', u:'fF', min:0.02, max:0.5, step:0.01},
    {k:'dv', l:t('SA 所需 ΔV', 'ΔV needed by the SA'), t:'num', u:'mV', min:20, max:300, step:5},
    {k:'leak', l:t('每位元漏電', 'Leakage per bit'), t:'num', u:'pA', min:0.1, max:1000, step:0.1}
  ];

  const PRESETS = {
    dram: [
      [t('DDR5-6400 16Gb x8 · 8 通道 RDIMM', 'DDR5-6400 16Gb x8 · 8-channel RDIMM'), {den:16, io:8, rate:6400, bg:8, bpg:4, page:1, bl:16, F:12.5, cellF:6, eff:45, vdd:1.1, cs:10, cpb:512, off:15, trefw:32, trfc:295, sys:'dimm', ranks:2, ecc:1, ch:8, ndev:4, dies:8, ifw:1024, stacks:4}],
      [t('LPDDR5X-8533 16Gb x16 · 手機 4 顆', 'LPDDR5X-8533 16Gb x16 · phone, 4 devices'), {den:16, io:16, rate:8533, bg:4, bpg:4, page:2, bl:16, F:12.5, cellF:6, eff:45, vdd:1.05, cs:9, cpb:512, off:15, trefw:32, trfc:280, sys:'p2p', ranks:1, ecc:0, ch:2, ndev:4, dies:8, ifw:1024, stacks:4}],
      [t('GDDR7 32 Gbps 16Gb x32 · 384-bit 顯示卡', 'GDDR7 32 Gbps 16Gb x32 · 384-bit graphics card'), {den:16, io:32, rate:32000, bg:4, bpg:4, page:2, bl:32, F:13, cellF:6, eff:42, vdd:1.2, cs:10, cpb:512, off:15, trefw:32, trfc:280, sys:'p2p', ranks:1, ecc:0, ch:2, ndev:12, dies:8, ifw:1024, stacks:4}],
      [t('HBM3E 12-Hi 24Gb · 8 堆疊 AI 加速器', 'HBM3E 12-Hi 24Gb · 8-stack AI accelerator'), {den:24, io:64, rate:9600, bg:4, bpg:4, page:1, bl:8, F:12.5, cellF:6, eff:40, vdd:1.1, cs:10, cpb:512, off:15, trefw:32, trfc:350, sys:'hbm', ranks:1, ecc:0, ch:2, ndev:4, dies:12, ifw:1024, stacks:8}],
      [t('HBM4 16-Hi 32Gb · 8 堆疊', 'HBM4 16-Hi 32Gb · 8 stacks'), {den:32, io:64, rate:8000, bg:4, bpg:4, page:1, bl:8, F:12, cellF:6, eff:40, vdd:1.05, cs:10, cpb:512, off:15, trefw:32, trfc:410, sys:'hbm', ranks:1, ecc:0, ch:2, ndev:4, dies:16, ifw:2048, stacks:8}],
      [t('DDR4-3200 8Gb x8 · 雙通道 UDIMM', 'DDR4-3200 8Gb x8 · dual-channel UDIMM'), {den:8, io:8, rate:3200, bg:4, bpg:4, page:1, bl:8, F:17, cellF:6, eff:48, vdd:1.2, cs:14, cpb:512, off:20, trefw:64, trfc:350, sys:'dimm', ranks:1, ecc:0, ch:2, ndev:4, dies:8, ifw:1024, stacks:4}]
    ],
    nand: [
      [t('TLC 1Tb 232 層 · 消費級 PCIe 5.0 SSD', 'TLC 1Tb 232-layer · client PCIe 5.0 SSD'), {cap:1024, bpc:3, layers:232, planes:6, page:16, spb:4, tprog:600, tr:50, rate:2400, ch:8, dpc:2, pcie:14, op:7, pe:3000, waf:2.5}],
      [t('QLC 2Tb 320 層 · 資料中心大容量', 'QLC 2Tb 320-layer · high-capacity data center'), {cap:2048, bpc:4, layers:320, planes:4, page:16, spb:4, tprog:2000, tr:80, rate:3600, ch:16, dpc:8, pcie:14, op:7, pe:1000, waf:1.8}],
      [t('TLC 512Gb 176 層 · PCIe 4.0 主流', 'TLC 512Gb 176-layer · mainstream PCIe 4.0'), {cap:512, bpc:3, layers:176, planes:4, page:16, spb:4, tprog:700, tr:60, rate:1600, ch:8, dpc:4, pcie:7, op:7, pe:3000, waf:3}],
      [t('SLC 256Gb · 工業 / 高耐寫', 'SLC 256Gb · industrial / high endurance'), {cap:256, bpc:1, layers:176, planes:4, page:16, spb:4, tprog:150, tr:25, rate:1600, ch:4, dpc:2, pcie:7, op:28, pe:60000, waf:2}]
    ],
    sram: [
      [t('L2 快取 1 MB @ 5/3 nm', 'L2 cache 1 MB @ 5/3 nm'), {words:65536, bits:128, mux:8, banks:32, freq:2000, node:'0.021', eff:65, vdd:0.75, icell:15, cbit:0.08, dv:80, leak:20}],
      [t('L1 資料快取 64 KB @ 5/3 nm', 'L1 data cache 64 KB @ 5/3 nm'), {words:4096, bits:128, mux:4, banks:8, freq:2500, node:'0.021', eff:55, vdd:0.75, icell:18, cbit:0.08, dv:80, leak:20}],
      [t('AI 加速器 SRAM 4 MB @ 2 nm', 'AI accelerator SRAM 4 MB @ 2 nm'), {words:262144, bits:128, mux:8, banks:128, freq:1500, node:'0.0175', eff:70, vdd:0.7, icell:12, cbit:0.07, dv:80, leak:15}],
      ['MCU SRAM 256 KB @ 28 nm', {words:65536, bits:32, mux:16, banks:4, freq:300, node:'0.120', eff:60, vdd:0.9, icell:30, cbit:0.2, dv:100, leak:5}]
    ]
  };
  const SCHEMA = {dram:DRAM_F, nand:NAND_F, sram:SRAM_F};

  /* ===================== state + field rendering ===================== */
  let type = 'dram', V = {}, outKey = 0, OUT = [];
  function renderFields(){
    const box = $('fields');
    box.innerHTML = SCHEMA[type].map(f => {
      if(f.g) return '<div class="eyebrow" style="margin:18px 0 10px;color:var(--muted)">' + f.g + '</div>';
      const id = 'f-' + f.k;
      const inp = f.t === 'sel'
        ? '<select id="' + id + '">' + f.o.map(o => '<option value="' + o[0] + '">' + o[1] + '</option>').join('') + '</select>'
        : '<input id="' + id + '" type="number"' + (f.min !== undefined ? ' min="' + f.min + '"' : '') + (f.max !== undefined ? ' max="' + f.max + '"' : '') + ' step="' + (f.step || 'any') + '">';
      return '<div class="ctl" data-k="' + f.k + '"><label for="' + id + '">' + f.l + (f.u ? ' <output>' + f.u + '</output>' : '') + '</label>' + inp + (f.h ? '<div class="note">' + f.h + '</div>' : '') + '</div>';
    }).join('');
    box.querySelectorAll('input,select').forEach(el => el.addEventListener('input', () => { read(); update(); }));
  }
  function setValues(vals){
    SCHEMA[type].forEach(f => { if(f.k && vals[f.k] !== undefined) $('f-' + f.k).value = vals[f.k]; });
    read();
  }
  function read(){
    V = {};
    SCHEMA[type].forEach(f => {
      if(!f.k) return;
      const raw = $('f-' + f.k).value;
      V[f.k] = (raw !== '' && !isNaN(+raw)) ? +raw : raw;
    });
    SCHEMA[type].forEach(f => { if(f.k && f.show) document.querySelector('.ctl[data-k="' + f.k + '"]').hidden = !f.show(V); });
  }
  function renderPresets(){
    $('preset').innerHTML = PRESETS[type].map((p, i) => '<option value="' + i + '">' + p[0] + '</option>').join('') + t('<option value="custom">（自訂）</option>', '<option value="custom">(custom)</option>');
  }
  $('preset').addEventListener('change', e => { if(e.target.value !== 'custom'){ setValues(PRESETS[type][+e.target.value][1]); update(); } });
  document.querySelectorAll('[data-type]').forEach(b => b.addEventListener('click', () => switchType(b.dataset.type)));
  function switchType(ty){
    if(!SCHEMA[ty]) ty = 'dram';
    type = ty; outKey = 0;
    document.querySelectorAll('[data-type]').forEach(b => b.setAttribute('aria-selected', b.dataset.type === ty ? 'true' : 'false'));
    renderFields(); renderPresets(); setValues(PRESETS[ty][0][1]); update();
    if(location.hash.slice(1) !== ty) history.replaceState(null, '', '#' + ty);
  }

  /* ===================== shared renderers ===================== */
  function metrics(arr){
    $('ds-metrics').innerHTML = arr.map(m => '<div class="metric ' + (m.cls || '') + '"><div class="ml">' + m.l + '</div><div class="mv">' + m.v +
      (m.u ? ' <small>' + m.u + '</small>' : '') + '</div>' + (m.s ? '<div class="ms">' + m.s + '</div>' : '') + '</div>').join('');
  }
  const table = (id, rows) => { $(id).innerHTML = rows.map(rw => '<tr><td>' + rw[0] + '</td><td class="n">' + rw[1] + '</td></tr>').join(''); };
  function addrBar(segs, total){
    const W = 420, x0 = 10, w = W - 20;
    const raw = segs.map(g => Math.max(34, w * g.bits / total)), k = w / raw.reduce((a, b) => a + b, 0);
    let x = x0, s = '<text x="' + x0 + '" y="20" class="ts t-mut t-mono">MSB</text><text x="' + (W - 10) + '" y="20" text-anchor="end" class="ts t-mut t-mono">LSB</text>';
    segs.forEach((g, i) => {
      const sw = raw[i] * k, cx = (x + sw / 2 - 1).toFixed(1);
      s += '<rect x="' + x.toFixed(1) + '" y="30" width="' + (sw - 2).toFixed(1) + '" height="40" rx="4" class="c' + (i % 6 + 1) + '"/>' +
        '<text x="' + cx + '" y="49" text-anchor="middle" class="ts">' + g.n + '</text>' +
        '<text x="' + cx + '" y="64" text-anchor="middle" class="ts t-mono t-mut">' + g.bits + 'b</text>';
      x += sw;
    });
    const note = segs.map(g => g.note).filter(Boolean)[0];
    if(note) s += '<text x="' + (W / 2) + '" y="90" text-anchor="middle" class="ts t-mut">' + note + '</text>';
    const svg = $('ds-addr');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + (note ? 98 : 80));
    svg.innerHTML = s;
  }
  function checks(list){
    $('ds-checks').innerHTML = list.map(c => '<div style="color:' + (c[0] === 'ok' ? 'var(--ok)' : c[0] === 'warn' ? 'var(--warn)' : 'var(--bad)') + '">' +
      (c[0] === 'ok' ? '✓ ' : c[0] === 'warn' ? '⚠ ' : '✗ ') + '<span style="color:var(--ink)">' + c[1] + '</span></div>').join('');
  }
  function outputs(list){
    OUT = list;
    if(outKey >= list.length) outKey = 0;
    $('ds-outsel').innerHTML = list.map((o, i) => '<button class="btn" type="button" data-i="' + i + '" aria-pressed="' + (i === outKey) + '">' + o[0] + '</button>').join('');
    $('ds-out').textContent = list[outKey][1];
  }
  $('ds-outsel').addEventListener('click', e => { const b = e.target.closest('button'); if(!b) return; outKey = +b.dataset.i; outputs(OUT); });
  $('ds-copy').addEventListener('click', () => {
    const txt = $('ds-out').textContent, b = $('ds-copy');
    const done = ok => { b.textContent = ok ? t('已複製', 'Copied') : t('請手動選取', 'Select manually'); setTimeout(() => b.textContent = t('複製', 'Copy'), 1500); };
    if(navigator.clipboard) navigator.clipboard.writeText(txt).then(() => done(true), () => done(false)); else done(false);
  });
  const dpw = A => Math.max(0, Math.floor(Math.PI * 150 * 150 / A - Math.PI * 300 / Math.sqrt(2 * A)));
  const fmtB = bytes => bytes >= 1099511627776 ? r(bytes / 1099511627776, 2) + ' TB' : bytes >= 1073741824 ? r(bytes / 1073741824, 2) + ' GB' : bytes >= 1048576 ? r(bytes / 1048576, 2) + ' MB' : bytes >= 1024 ? r(bytes / 1024, 2) + ' KB' : bytes + ' B';
  const fmtBW = mbps => mbps >= 1000 ? r(mbps / 1000, 2) + ' GB/s' : r(mbps, 0) + ' MB/s';

  /* ===================== DRAM ===================== */
  const cblOf = cpb => 0.06 * cpb + 8;
  function dram(){
    const v = V, banks = v.bg * v.bpg, pageBits = v.page * 8192, bits = v.den * Math.pow(2, 30);
    const cols = pageBits / v.io, rows = bits / (banks * pageBits);
    const bgB = log2(v.bg), baB = log2(v.bpg), rB = ceil(log2(rows) - 1e-9), cB = log2(cols);
    const tck = 2000 / v.rate, core = v.rate / v.bl;
    const bwDev = v.rate * v.io / 8;                  // MB/s
    const cellA = v.cellF * Math.pow(v.F / 1000, 2);  // µm²
    const arrA = bits * cellA / 1e6, dieA = arrA / (v.eff / 100);
    const cbl = cblOf(v.cpb), dv = v.vdd / 2 * v.cs / (v.cs + cbl) * 1000, margin = dv - v.off;
    const trefi = v.trefw * 1000 / 8192, ovh = v.trfc / 1000 / trefi;
    const rowsPerRef = rows / 8192;
    // system
    let sys = [], capB = 0, bwSys = 0, sysNote = '';
    if(v.sys === 'dimm'){
      const width = v.ecc ? 80 : 64, devs = width / v.io;
      capB = v.ranks * (64 / v.io) * bits / 8 * v.ch; bwSys = v.rate * 64 / 8 * v.ch;
      sys = [[t('每 rank 晶片數', 'Devices per rank'), devs + (v.ecc ? t('（含 ECC ', ' (incl. ') + (16 / v.io) + t(' 顆）', ' ECC devices)') : '')], [t('每條 DIMM 容量', 'Capacity per DIMM'), fmtB(v.ranks * (64 / v.io) * bits / 8)], [t('每通道峰值頻寬', 'Peak bandwidth per channel'), fmtBW(v.rate * 8)], [t('總容量（', 'Total capacity (') + v.ch + t(' 通道）', ' channels)'), fmtB(capB)], [t('總峰值頻寬', 'Total peak bandwidth'), fmtBW(bwSys)]];
      sysNote = v.ch + t(' 通道 DIMM', '-channel DIMM');
    } else if(v.sys === 'p2p'){
      capB = v.ndev * bits / 8; bwSys = v.ndev * bwDev;
      sys = [[t('匯流排寬度', 'Bus width'), v.ndev * v.io + ' bit'], [t('總容量', 'Total capacity'), fmtB(capB)], [t('總峰值頻寬', 'Total peak bandwidth'), fmtBW(bwSys)]];
      sysNote = v.ndev + t(' 顆 × x', ' devices × x') + v.io;
    } else {
      const stCap = v.dies * bits / 8, stBW = v.rate * v.ifw / 8;
      capB = stCap * v.stacks; bwSys = stBW * v.stacks;
      sys = [[t('每堆疊容量', 'Capacity per stack'), fmtB(stCap)], [t('每堆疊頻寬', 'Bandwidth per stack'), fmtBW(stBW)], [t('堆疊數', 'Stacks'), v.stacks], [t('總容量', 'Total capacity'), fmtB(capB)], [t('總峰值頻寬', 'Total peak bandwidth'), fmtBW(bwSys)]];
      sysNote = v.stacks + ' × ' + v.dies + '-Hi';
    }
    table('ds-sys', sys);
    metrics([
      {l:t('晶粒峰值頻寬', 'Peak bandwidth per die'), v:fmtBW(bwDev).split(' ')[0], u:fmtBW(bwDev).split(' ')[1], s:'x' + v.io + ' @ ' + v.rate + ' MT/s'},
      {l:t('系統峰值頻寬', 'System peak bandwidth'), v:fmtBW(bwSys).split(' ')[0], u:fmtBW(bwSys).split(' ')[1], s:sysNote + ' · ' + fmtB(capB)},
      {l:t('估計晶粒面積', 'Estimated die area'), v:r(dieA, 1), u:'mm²', s:r(v.den / dieA, 2) + t(' Gb/mm² · 每片晶圓約 ', ' Gb/mm² · ~') + dpw(dieA) + t(' 顆', ' dies')},
      {l:t('感測訊號 ΔV', 'Sense signal ΔV'), v:r(dv, 0), u:'mV', cls: margin > 60 ? 'ok' : margin > 25 ? 'warn' : 'bad', s:t('扣除偏移後 ', 'After offset ') + r(margin, 0) + ' mV'},
      {l:t('Refresh 開銷', 'Refresh overhead'), v:r(ovh * 100, 1), u:'%', cls: ovh < 0.06 ? 'ok' : ovh < 0.12 ? 'warn' : 'bad', s:'tREFI ' + r(trefi, 2) + ' µs'},
      {l:t('陣列核心週期', 'Array core cycle'), v:r(core, 0), u:'MHz', s:t('速率 ÷ BL', 'Data rate ÷ BL') + v.bl}
    ]);
    $('ds-addr-sub').textContent = (bgB + baB + rB + cB) + t(' bit（每晶粒）', ' bits (per die)');
    addrBar([{n:'BG', bits:bgB}, {n:'BA', bits:baB}, {n:'Row', bits:rB, note: pow2(rows) ? '' : t('列數 ', 'Row count ') + rows.toLocaleString() + t(' 非 2 的次方：最高列位址只用到 ', ' is not a power of 2: top row address only ') + r(rows / Math.pow(2, rB) * 100, 0) + '%'}, {n:'Column', bits:cB}].filter(g => g.bits > 0), bgB + baB + rB + cB);
    table('ds-org', [[t('Bank 數', 'Banks'), banks + t('（', ' (') + v.bg + ' BG × ' + v.bpg + t('）', ')')], [t('每 bank 列數', 'Rows per bank'), rows.toLocaleString()], [t('每列行數（x', 'Columns per row (x') + v.io + t('）', ')'), cols.toLocaleString()], [t('Page 大小', 'Page size'), v.page + ' KB'], [t('每次 refresh 每 bank 更新列數', 'Rows refreshed per REF per bank'), r(rowsPerRef, 2)], [t('C<sub>BL</sub> 估計', 'Estimated C<sub>BL</sub>'), r(cbl, 1) + ' fF'], ['tCK', r(tck, 4) + ' ns']]);
    // floorplan
    const asp = 1.6, Wmm = Math.sqrt(dieA * asp), Hmm = dieA / Wmm;
    floorDram(banks, v.eff / 100, Wmm, Hmm);
    $('ds-fp-sub').textContent = r(Wmm, 2) + ' × ' + r(Hmm, 2) + ' mm';
    // trade-off: ΔV vs cells per BL
    const curve = k => { const a = []; for(let c = 128; c <= 2048; c *= 1.05){ a.push([c, v.vdd / 2 * (v.cs * k) / (v.cs * k + cblOf(c)) * 1000]); } return a; };
    $('ds-trade-h').innerHTML = t('取捨：位元線長度 vs 感測訊號', 'Trade-off: bit-line length vs sense signal');
    plot($('ds-trade'), {W:420, H:300, m:{l:52, r:12, t:12, b:44}, x:[128, 2048], logx:true, y:[0, Math.max(150, curve(1.3)[0][1] * 1.1)], xticks:[128, 256, 512, 1024, 2048], xfmt:v => String(v),
      xlabel:t('每條位元線單元數', 'Cells per bit line'), ylabel:'ΔV (mV)',
      series:[{pts:curve(0.7), color:'var(--s2)', w:1.6}, {pts:curve(1), color:'var(--accent)', w:2.6}, {pts:curve(1.3), color:'var(--s3)', w:1.6}],
      hlines:[{y:v.off, color:'var(--bad)', label:t('SA 偏移', 'SA offset')}, {y:v.off + 50, color:'var(--warn)', label:t('偏移 + 50 mV 裕度', 'offset + 50 mV margin')}],
      vlines:[{x:v.cpb, color:'var(--ink)', dash:false, w:1.2, label:t('目前', 'now')}]});
    $('ds-trade-leg').innerHTML = '<span><i style="background:var(--s2)"></i>C<sub>s</sub> × 0.7</span><span><i style="background:var(--accent)"></i>C<sub>s</sub> = ' + v.cs + t(' fF</span><span><i style="background:var(--s3)"></i>C<sub>s</sub> × 1.3</span><span>位元線越長 → 陣列效率越高，但 ΔV 越小</span>', ' fF</span><span><i style="background:var(--s3)"></i>C<sub>s</sub> × 1.3</span><span>Longer bit lines → better array efficiency, smaller ΔV</span>');
    const c = [];
    c.push(margin > 60 ? ['ok', t('感測裕度 ', 'Sense margin ') + r(margin, 0) + t(' mV，充足', ' mV, plenty')] : margin > 25 ? ['warn', t('感測裕度只有 ', 'Sense margin only ') + r(margin, 0) + t(' mV，需要低偏移 SA 或更短的位元線', ' mV: needs a low-offset SA or shorter bit lines')] : ['bad', t('感測裕度 ', 'Sense margin ') + r(margin, 0) + t(' mV：無法可靠讀取，請增加 C<sub>s</sub>、縮短位元線或降低 SA 偏移', ' mV: cannot read reliably — raise C<sub>s</sub>, shorten bit lines or cut SA offset')]);
    c.push(ovh < 0.06 ? ['ok', t('Refresh 開銷 ', 'Refresh overhead ') + r(ovh * 100, 1) + '%'] : ovh < 0.12 ? ['warn', t('Refresh 開銷 ', 'Refresh overhead ') + r(ovh * 100, 1) + t('%：考慮 same-bank / per-bank refresh', '%: consider same-bank / per-bank refresh')] : ['bad', t('Refresh 開銷 ', 'Refresh overhead ') + r(ovh * 100, 1) + t('% 過高', '% is too high')]);
    c.push(pow2(rows) ? ['ok', t('列數為 2 的次方，位址空間完整使用', 'Row count is a power of 2; address space fully used')] : ['warn', t('列數 ', 'Row count ') + rows.toLocaleString() + t(' 不是 2 的次方（如 24 Gb），最高列位址部分未使用', ' is not a power of 2 (e.g. 24 Gb); top row addresses partly unused')]);
    if(cols < 64) c.push(['warn', t('每列只有 ', 'Only ') + cols + t(' 行，page 太小，連續存取效率差', ' columns per row: page too small for efficient bursts')]);
    if(core > 600) c.push(['warn', t('陣列核心週期 ', 'Array core cycle ') + r(core, 0) + t(' MHz 偏高，需更長的 burst / 預取', ' MHz is high; needs a longer burst / prefetch')]);
    else c.push(['ok', t('陣列核心週期 ', 'Array core cycle ') + r(core, 0) + t(' MHz，在陣列可達範圍內', ' MHz, achievable by the array')]);
    if(dieA > 120) c.push(['warn', t('晶粒面積 ', 'Die area ') + r(dieA, 0) + t(' mm² 偏大，良率與成本壓力高', ' mm² is large; heavy yield and cost pressure')]);
    checks(c);
    const cyc = ns => ceil(ns / tck - 1e-9);
    outputs([
      [t('規格摘要', 'Spec summary'), [
        '# DRAM device spec (first-order estimate)',
        'density:        ' + v.den + ' Gb',
        'organization:   x' + v.io + ', ' + banks + ' banks (' + v.bg + ' BG x ' + v.bpg + ')',
        'rows_per_bank:  ' + rows + '   # row address ' + rB + ' bits',
        'cols_per_row:   ' + cols + '   # column address ' + cB + ' bits',
        'page_size:      ' + v.page + ' KB',
        'data_rate:      ' + v.rate + ' MT/s   # tCK = ' + r(tck, 4) + ' ns',
        'burst_length:   ' + v.bl,
        'peak_bw_device: ' + fmtBW(bwDev),
        'cell:           ' + v.cellF + 'F^2 @ F = ' + v.F + ' nm  -> ' + r(cellA * 1e6, 0) + ' nm^2',
        'die_area:       ' + r(dieA, 1) + ' mm^2   # array efficiency ' + v.eff + '%',
        'gross_die/wafer:' + dpw(dieA) + '   # 300 mm',
        'sense:',
        '  Cs: ' + v.cs + ' fF',
        '  Cbl: ' + r(cbl, 1) + ' fF   # ' + v.cpb + ' cells/BL',
        '  dV: ' + r(dv, 1) + ' mV, SA offset ' + v.off + ' mV, margin ' + r(margin, 1) + ' mV',
        'refresh:',
        '  tREFW: ' + v.trefw + ' ms, tREFI: ' + r(trefi, 3) + ' us, tRFC: ' + v.trfc + ' ns',
        '  overhead: ' + r(ovh * 100, 2) + ' %',
        'system: ' + sysNote + ', ' + fmtB(capB) + ', ' + fmtBW(bwSys)
      ].join('\n')],
      [t('控制器時序（cycles）', 'Controller timings (cycles)'), [
        '// Typical array-limited timings converted to clock cycles at tCK = ' + r(tck, 4) + ' ns',
        '// (ns values are generation-typical, not from a specific datasheet)',
        'tRCD = ' + cyc(16) + '   // 16 ns',
        'CL   = ' + cyc(16) + '   // 16 ns',
        'tRP  = ' + cyc(16) + '   // 16 ns',
        'tRAS = ' + cyc(32) + '   // 32 ns',
        'tRC  = ' + cyc(48) + '   // 48 ns',
        'tWR  = ' + cyc(30) + '   // 30 ns',
        'tRFC = ' + cyc(v.trfc) + '   // ' + v.trfc + ' ns',
        'tREFI= ' + cyc(trefi * 1000) + '   // ' + r(trefi, 3) + ' us',
        'BL   = ' + v.bl + '   // data burst = ' + r(v.bl / 2, 1) + ' tCK'
      ].join('\n')]
    ]);
  }
  function floorDram(banks, eff, Wmm, Hmm){
    const SW = 420, SH = 300, pad = 16, sc = Math.min((SW - 2 * pad) / Wmm, (SH - 2 * pad - 20) / Hmm);
    const w = Wmm * sc, h = Hmm * sc, x0 = (SW - w) / 2, y0 = pad;
    const half = Math.ceil(banks / 2), nc = Math.min(half, Math.max(2, Math.round(Math.sqrt(half * 2.2)))), nr = Math.ceil(half / nc);
    const arrH = eff * w * h / (w * 0.94), stripe = Math.max(10, h - arrH - h * 0.04), hh = (h - stripe - h * 0.04) / 2;
    const tw = (w * 0.94 - (nc - 1) * 3) / nc, th = (hh - (nr - 1) * 3) / nr;
    let s = '<rect x="' + x0 + '" y="' + y0 + '" width="' + w + '" height="' + h + '" rx="3" class="boxi"/>';
    let n = 0;
    [0, 1].forEach(side => {
      const yb = side ? y0 + h * 0.02 + hh + stripe : y0 + h * 0.02;
      for(let i = 0; i < nr; i++) for(let j = 0; j < nc; j++){
        if(n >= banks) return;
        s += '<rect x="' + (x0 + w * 0.03 + j * (tw + 3)).toFixed(1) + '" y="' + (yb + i * (th + 3)).toFixed(1) + '" width="' + tw.toFixed(1) + '" height="' + th.toFixed(1) + '" class="c1" style="stroke-width:1"/>';
        if(tw > 26 && th > 14) s += '<text x="' + (x0 + w * 0.03 + j * (tw + 3) + tw / 2).toFixed(1) + '" y="' + (yb + i * (th + 3) + th / 2 + 4).toFixed(1) + '" text-anchor="middle" class="ts">B' + n + '</text>';
        n++;
      }
    });
    s += '<rect x="' + (x0 + w * 0.03) + '" y="' + (y0 + h * 0.02 + hh + 2) + '" width="' + (w * 0.94) + '" height="' + (stripe - 4) + '" class="c6" style="stroke-width:1"/>' +
      '<text x="' + (x0 + w / 2) + '" y="' + (y0 + h * 0.02 + hh + stripe / 2 + 4) + t('" text-anchor="middle" class="ts">周邊：I/O、指令解碼、DLL、Pad</text>', '" text-anchor="middle" class="ts">Periphery: I/O, command decode, DLL, pads</text>') +
      '<text x="' + (SW / 2) + '" y="' + (SH - 8) + '" text-anchor="middle" class="ts t-mut">' + banks + t(' 個 bank · 陣列效率 ', ' banks · array efficiency ') + Math.round(eff * 100) + '%</text>';
    const svg = $('ds-fp'); svg.setAttribute('viewBox', '0 0 ' + SW + ' ' + SH); svg.innerHTML = s;
  }

  /* ===================== NAND ===================== */
  function nand(){
    const v = V, bytesDie = v.cap * Math.pow(2, 30) / 8, pageB = v.page * 1024;
    const ppb = v.layers * v.spb * v.bpc, blockB = ppb * pageB;
    const bpp = bytesDie / (v.planes * blockB);
    const density = 0.021 * v.layers * v.bpc, dieA = v.cap / density;
    const wDie = v.planes * pageB * v.bpc / v.tprog;      // bytes/µs = MB/s
    const rArr = v.planes * pageB / v.tr, rDie = Math.min(rArr, v.rate);
    const dies = v.ch * v.dpc, raw = dies * bytesDie, user = raw / (1 + v.op / 100);
    const chBW = v.ch * v.rate, host = v.pcie * 1000;
    const sw = Math.min(dies * wDie, chBW, host), sr = Math.min(dies * rArr, chBW, host);
    const wLim = sw === host ? t('主機介面', 'host interface') : sw === chBW ? t('通道頻寬', 'channel bandwidth') : t('NAND 寫入', 'NAND program'), rLim = sr === host ? t('主機介面', 'host interface') : sr === chBW ? t('通道頻寬', 'channel bandwidth') : t('NAND 讀取', 'NAND read');
    const tbw = user / 1e12 * v.pe / v.waf, dwpd = tbw / (user / 1e12 * 365 * 5);
    table('ds-sys', [[t('晶粒數', 'Dies'), dies + t('（', ' (') + v.ch + ' ch × ' + v.dpc + t('）', ')')], [t('原始容量', 'Raw capacity'), fmtB(raw)], [t('使用者容量（OP ', 'User capacity (OP ') + v.op + t('%）', '%)'), fmtB(user)], [t('循序寫入', 'Sequential write'), fmtBW(sw) + t('（受限於', ' (limited by ') + wLim + t('）', ')')], [t('循序讀取', 'Sequential read'), fmtBW(sr) + t('（受限於', ' (limited by ') + rLim + t('）', ')')], [t('TBW / DWPD（5 年）', 'TBW / DWPD (5 years)'), r(tbw, 0).toLocaleString() + ' TB / ' + r(dwpd, 2)]]);
    metrics([
      {l:t('Block 大小', 'Block size'), v:fmtB(blockB).split(' ')[0], u:fmtB(blockB).split(' ')[1], s:ppb.toLocaleString() + ' pages / block'},
      {l:t('估計晶粒面積', 'Estimated die area'), v:r(dieA, 1), u:'mm²', s:r(density, 1) + t(' Gb/mm²（以層數 × bit/cell 估算）', ' Gb/mm² (scaled by layers × bits/cell)')},
      {l:t('單晶粒寫入', 'Write per die'), v:r(wDie, 0), u:'MB/s', s:v.planes + t(' plane 平行', ' planes in parallel')},
      {l:t('單晶粒讀取', 'Read per die'), v:r(rDie, 0), u:'MB/s', s: rArr > v.rate ? t('受限於介面 ', 'Limited by interface ') + v.rate + ' MT/s' : t('受限於 t<sub>R</sub>', 'Limited by t<sub>R</sub>')},
      {l:t('SSD 循序寫入', 'SSD sequential write'), v:fmtBW(sw).split(' ')[0], u:fmtBW(sw).split(' ')[1], s:t('瓶頸：', 'Bottleneck: ') + wLim, cls: wLim === t('主機介面', 'host interface') ? 'ok' : 'warn'},
      {l:t('SSD 循序讀取', 'SSD sequential read'), v:fmtBW(sr).split(' ')[0], u:fmtBW(sr).split(' ')[1], s:t('瓶頸：', 'Bottleneck: ') + rLim, cls: rLim === t('主機介面', 'host interface') ? 'ok' : 'warn'}
    ]);
    const colB = ceil(log2(pageB)), pgB = ceil(log2(ppb)), blB = ceil(log2(bpp)), plB = ceil(log2(v.planes));
    $('ds-addr-sub').textContent = (colB + pgB + blB + plB) + t(' bit（每晶粒，位元組定址）', ' bits (per die, byte addressed)');
    addrBar([{n:'Block', bits:blB}, {n:'Plane', bits:plB}, {n:'Page', bits:pgB}, {n:'Column', bits:colB, note: pow2(ppb) ? '' : t('每 block ', '') + ppb + t(' 頁非 2 的次方，page 位址未完全使用', ' pages per block is not a power of 2; page address partly unused')}].filter(g => g.bits > 0), colB + pgB + blB + plB);
    table('ds-org', [['Plane', v.planes], [t('每 plane block 數', 'Blocks per plane'), r(bpp, 0).toLocaleString()], [t('每 block 頁數', 'Pages per block'), ppb.toLocaleString() + t('（', ' (') + v.layers + t(' 層 × ', ' layers × ') + v.spb + ' × ' + v.bpc + t('）', ')')], [t('Page 大小', 'Page size'), v.page + t(' KB（另有 spare 區給 ECC）', ' KB (plus spare area for ECC)')], [t('每 plane 位元線數', 'Bit lines per plane'), (pageB * 8).toLocaleString()], [t('V<sub>t</sub> 狀態數', 'V<sub>t</sub> states'), Math.pow(2, v.bpc)]]);
    floorNand(v.planes, dieA);
    // trade-off: throughput vs number of dies
    $('ds-trade-h').innerHTML = t('取捨：晶粒平行度 vs SSD 吞吐量', 'Trade-off: die parallelism vs SSD throughput');
    const ws = [], rs = [];
    for(let d = 1; d <= 256; d *= 1.08){ ws.push([d, Math.min(d * wDie, chBW, host) / 1000]); rs.push([d, Math.min(d * rArr, chBW, host) / 1000]); }
    plot($('ds-trade'), {W:420, H:300, m:{l:52, r:12, t:12, b:44}, x:[1, 256], logx:true, xticks:[1, 4, 16, 64, 256], xfmt:v => String(v), y:[0, Math.max(host, chBW) / 1000 * 1.12],
      xlabel:t('晶粒數（通道 × 每通道晶粒）', 'Dies (channels × dies per channel)'), ylabel:'GB/s',
      series:[{pts:rs, color:'var(--s3)', w:2.2}, {pts:ws, color:'var(--accent)', w:2.6}],
      hlines:[{y:host / 1000, color:'var(--bad)', label:t('主機介面', 'host interface')}, {y:chBW / 1000, color:'var(--warn)', label:t('通道總頻寬', 'channel bandwidth')}],
      vlines:[{x:dies, color:'var(--ink)', dash:false, w:1.2, label:t('目前 ', 'now ') + dies}]});
    $('ds-trade-leg').innerHTML = t('<span><i style="background:var(--accent)"></i>循序寫入</span><span><i style="background:var(--s3)"></i>循序讀取</span><span>寫入要很多晶粒平行才能填滿介面</span>', '<span><i style="background:var(--accent)"></i>Sequential write</span><span><i style="background:var(--s3)"></i>Sequential read</span><span>Writes need many dies in parallel to fill the link</span>');
    const needDies = ceil(Math.min(host, chBW) / wDie);
    const c = [];
    c.push(dies >= needDies ? ['ok', t('晶粒數足以讓寫入達到介面上限（需約 ', 'Enough dies for writes to saturate the link (needs ~') + needDies + t(' 顆）', ' ECC devices)')] : ['warn', t('寫入受限於 NAND：至少約 ', 'Writes limited by NAND: needs at least ~') + needDies + t(' 顆晶粒才能填滿介面，目前 ', ' dies to fill the link, have ') + dies + t(' 顆', ' dies')]);
    c.push(chBW >= host ? ['ok', t('通道總頻寬 ', 'Channel bandwidth ') + fmtBW(chBW) + t(' ≥ 主機介面', ' ≥ host interface')] : ['warn', t('通道總頻寬 ', 'Channel bandwidth ') + fmtBW(chBW) + t(' 低於主機介面，增加通道或提高介面速率', ' is below the host link; add channels or raise interface speed')]);
    c.push(blockB > 64 * 1048576 ? ['warn', 'Block ' + fmtB(blockB) + t(' 很大：GC 單位粗、寫入放大可能上升', ' is large: coarse GC unit, WAF may rise')] : ['ok', t('Block 大小 ', 'Block size ') + fmtB(blockB)]);
    c.push(dwpd >= 1 ? ['ok', t('耐寫 ', 'Endurance ') + r(dwpd, 2) + t(' DWPD（5 年）', ' DWPD (5 years)')] : dwpd >= 0.3 ? ['warn', t('耐寫 ', 'Endurance ') + r(dwpd, 2) + t(' DWPD，適合讀取為主的應用', ' DWPD: suits read-mostly workloads')] : ['bad', t('耐寫只有 ', 'Endurance only ') + r(dwpd, 2) + ' DWPD']);
    if(v.op < 7) c.push(['warn', t('OP 低於 7%，隨機寫入時 WAF 會明顯上升', 'OP below 7%: WAF rises sharply under random writes')]);
    checks(c);
    outputs([
      [t('規格摘要', 'Spec summary'), [
        '# 3D NAND die + SSD (first-order estimate)',
        'die:',
        '  capacity: ' + v.cap + ' Gb, ' + ['', 'SLC', 'MLC', 'TLC', 'QLC'][v.bpc] + ', ' + v.layers + ' layers',
        '  planes: ' + v.planes + ', blocks_per_plane: ' + r(bpp, 0) + ', pages_per_block: ' + ppb + ', page: ' + v.page + ' KB',
        '  block_size: ' + fmtB(blockB),
        '  area: ' + r(dieA, 1) + ' mm^2  (~' + r(density, 1) + ' Gb/mm^2)',
        '  tPROG: ' + v.tprog + ' us  -> write ' + r(wDie, 0) + ' MB/s/die',
        '  tR: ' + v.tr + ' us  -> read ' + r(rDie, 0) + ' MB/s/die (interface ' + v.rate + ' MT/s)',
        'ssd:',
        '  dies: ' + dies + ' (' + v.ch + ' ch x ' + v.dpc + ')',
        '  raw: ' + fmtB(raw) + ', user: ' + fmtB(user) + ' (OP ' + v.op + '%)',
        '  seq_write: ' + fmtBW(sw) + '  # limited by ' + wLim,
        '  seq_read: ' + fmtBW(sr) + '  # limited by ' + rLim,
        '  endurance: ' + v.pe + ' P/E, WAF ' + v.waf + ' -> TBW ' + r(tbw, 0) + ' TB, ' + r(dwpd, 2) + ' DWPD (5 yr)'
      ].join('\n')],
      [t('ONFI 風格幾何', 'ONFI-style geometry'), [
        '// Geometry parameters as a controller would read them (illustrative)',
        'Number of data bytes per page      : ' + pageB,
        'Number of pages per block          : ' + ppb,
        'Number of blocks per LUN           : ' + r(bpp * v.planes, 0),
        'Number of planes (interleaved)     : ' + v.planes,
        'Number of bits per cell            : ' + v.bpc,
        'Column address cycles / bits       : ' + ceil(colB / 8) + ' / ' + colB,
        'Row address cycles / bits          : ' + ceil((pgB + blB + plB) / 8) + ' / ' + (pgB + blB + plB),
        'tPROG (typ)                        : ' + v.tprog + ' us',
        'tR (typ)                           : ' + v.tr + ' us',
        'Interface                          : ' + v.rate + ' MT/s x8'
      ].join('\n')]
    ]);
  }
  function floorNand(planes, dieA){
    const SW = 420, SH = 300, asp = 1.35, Wmm = Math.sqrt(dieA * asp), Hmm = dieA / Wmm;
    const sc = Math.min((SW - 32) / Wmm, (SH - 52) / Hmm), w = Wmm * sc, h = Hmm * sc, x0 = (SW - w) / 2, y0 = 14;
    const cols = planes <= 4 ? planes : Math.ceil(planes / 2), rows = planes <= 4 ? 1 : 2;
    const padH = h * 0.08, gw = (w - 8 - (cols - 1) * 4) / cols, gh = (h - padH - 8 - (rows - 1) * 4) / rows;
    let s = '<rect x="' + x0 + '" y="' + y0 + '" width="' + w + '" height="' + h + '" rx="3" class="boxi"/>', n = 0;
    for(let i = 0; i < rows; i++) for(let j = 0; j < cols; j++){
      if(n >= planes) break;
      const x = x0 + 4 + j * (gw + 4), y = y0 + 4 + i * (gh + 4), stair = Math.max(4, gw * 0.06), pb = Math.max(6, gh * 0.12);
      s += '<rect x="' + x + '" y="' + y + '" width="' + stair + '" height="' + (gh - pb) + '" class="c5" style="stroke-width:1"/>' +
           '<rect x="' + (x + gw - stair) + '" y="' + y + '" width="' + stair + '" height="' + (gh - pb) + '" class="c5" style="stroke-width:1"/>' +
           '<rect x="' + (x + stair) + '" y="' + y + '" width="' + (gw - 2 * stair) + '" height="' + (gh - pb) + '" class="c1" style="stroke-width:1"/>' +
           '<rect x="' + x + '" y="' + (y + gh - pb) + '" width="' + gw + '" height="' + pb + '" class="c2" style="stroke-width:1"/>' +
           '<text x="' + (x + gw / 2) + '" y="' + (y + (gh - pb) / 2 + 4) + '" text-anchor="middle" class="ts">Plane ' + n + '</text>';
      n++;
    }
    s += '<rect x="' + (x0 + 4) + '" y="' + (y0 + h - padH) + '" width="' + (w - 8) + '" height="' + (padH - 4) + '" class="c6" style="stroke-width:1"/>' +
      '<text x="' + (SW / 2) + '" y="' + (y0 + h - padH / 2 + 3) + '" text-anchor="middle" class="ts">Pad / I/O</text>' +
      '<text x="' + (SW / 2) + '" y="' + (SH - 22) + t('" text-anchor="middle" class="ts t-mut">紫：階梯區 + WL 解碼　橘：page buffer</text>', '" text-anchor="middle" class="ts t-mut">Purple: staircase + WL decode   Orange: page buffer</text>') +
      '<text x="' + (SW / 2) + '" y="' + (SH - 6) + t('" text-anchor="middle" class="ts t-mut">CMOS 周邊位於陣列下方（CuA）或另一片晶圓（CBA）</text>', '" text-anchor="middle" class="ts t-mut">CMOS periphery under the array (CuA) or on a bonded wafer (CBA)</text>');
    const svg = $('ds-fp'); svg.setAttribute('viewBox', '0 0 ' + SW + ' ' + SH); svg.innerHTML = s;
    $('ds-fp-sub').textContent = r(Wmm, 2) + ' × ' + r(Hmm, 2) + ' mm';
  }

  /* ===================== SRAM ===================== */
  function sramTiming(rows, v){
    const cbl = rows * v.cbit + 1;                      // fF
    const tbl = cbl * v.dv / v.icell;                   // fF·mV/µA = ps
    const tdec = 40 + 12 * log2(Math.max(2, rows));     // ps
    const tsa = 35, tout = 45 + 6 * log2(Math.max(2, v.bits));
    return {cbl, tbl, tdec, total: tdec + tbl + tsa + tout};
  }
  function sram(){
    const v = V, bitsTot = v.words * v.bits, wpb = v.words / v.banks;
    const rows = wpb / v.mux, cols = v.bits * v.mux;
    const cellA = +v.node;
    const area = bitsTot * cellA / (v.eff / 100);       // µm²
    const T = sramTiming(rows, v), cycle = 1e6 / v.freq; // ps
    const leakmW = bitsTot * v.leak * 1e-12 * v.vdd * 1e3;
    const eRead = cols * T.cbl * v.vdd * v.dv / 1000 / 1000;   // fF·V·mV -> fJ/1000 = pJ
    const bankB = ceil(log2(v.banks)), rowB = ceil(log2(rows)), colB = ceil(log2(v.mux));
    metrics([
      {l:t('容量', 'Capacity'), v:fmtB(bitsTot / 8).split(' ')[0], u:fmtB(bitsTot / 8).split(' ')[1], s:v.words.toLocaleString() + ' × ' + v.bits + ' bit'},
      {l:t('估計巨集面積', 'Estimated macro area'), v:area >= 1e5 ? r(area / 1e6, 3) : r(area, 0), u:area >= 1e5 ? 'mm²' : 'µm²', s:r(bitsTot / 1e6 / (area / 1e6), 1) + ' Mb/mm²'},
      {l:t('位元線發展時間', 'Bit-line development time'), v:r(T.tbl, 0), u:'ps', s:'C<sub>BL</sub> ' + r(T.cbl, 1) + ' fF · ΔV ' + v.dv + ' mV'},
      {l:t('估計存取時間', 'Estimated access time'), v:r(T.total, 0), u:'ps', cls: T.total < cycle * 0.8 ? 'ok' : T.total < cycle ? 'warn' : 'bad', s:t('週期 ', 'Cycle ') + r(cycle, 0) + ' ps @ ' + v.freq + ' MHz'},
      {l:t('讀取能量（位元線）', 'Read energy (bit lines)'), v:r(eRead, 2), u:'pJ', s:cols + t(' 條位元線同時放電', ' bit lines discharge per read')},
      {l:t('待機漏電', 'Standby leakage'), v:leakmW >= 1 ? r(leakmW, 2) : r(leakmW * 1000, 1), u:leakmW >= 1 ? 'mW' : 'µW', s:v.leak + ' pA/bit @ ' + v.vdd + ' V'}
    ]);
    $('ds-addr-sub').textContent = (bankB + rowB + colB) + t(' bit 字位址', '-bit word address');
    addrBar([{n:'Bank', bits:bankB}, {n:'Row', bits:rowB}, {n:'Col mux', bits:colB, note: pow2(rows) ? '' : t('每 bank 列數 ', 'Rows per bank ') + rows + t(' 非 2 的次方', ' is not a power of 2')}].filter(g => g.bits > 0), bankB + rowB + colB);
    table('ds-org', [[t('每 bank 字數', 'Words per bank'), wpb.toLocaleString()], [t('每 bank 列 × 行', 'Rows × columns per bank'), rows.toLocaleString() + ' × ' + cols.toLocaleString()], [t('行多工', 'Column mux'), v.mux + ' : 1'], [t('位元胞', 'Bitcell'), cellA + ' µm²'], [t('位元線電容', 'Bit-line capacitance'), r(T.cbl, 1) + ' fF'], [t('解碼延遲估計', 'Estimated decode delay'), r(T.tdec, 0) + ' ps']]);
    floorSram(v.banks, rows, cols, cellA, area);
    // trade-off: access time vs rows per bank for each mux choice at same capacity per bank
    $('ds-trade-h').innerHTML = t('取捨：子陣列切分 / 行多工 vs 存取時間', 'Trade-off: sub-array split / column mux vs access time');
    const series = [], colsC = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)'];
    [2, 4, 8, 16, 32].forEach((m, i) => { const pts = []; for(let b = 1; b <= 256; b *= 2){ const rw = v.words / b / m; if(rw >= 4) pts.push([b, sramTiming(rw, v).total]); } series.push({pts, color:colsC[i], w: m === v.mux ? 3 : 1.4}); });
    plot($('ds-trade'), {W:420, H:300, m:{l:56, r:12, t:12, b:44}, x:[1, 256], logx:true, xticks:[1, 4, 16, 64, 256], xfmt:v => String(v), y:[0, Math.max(cycle * 1.6, T.total * 1.8)],
      xlabel:t('Bank / 子陣列數（同容量切越多 → 位元線越短）', 'Banks / sub-arrays (more splits → shorter bit lines)'), ylabel:t('存取時間 (ps)', 'Access time (ps)'), series,
      hlines:[{y:cycle, color:'var(--bad)', label:t('週期 ', 'Cycle ') + r(cycle, 0) + ' ps'}],
      vlines:[{x:v.banks, color:'var(--ink)', dash:false, w:1.2, label:t('目前', 'now')}]});
    $('ds-trade-leg').innerHTML = [2, 4, 8, 16, 32].map((m, i) => '<span><i style="background:' + colsC[i] + '"></i>mux ' + m + '</span>').join('') + t('<span>粗線 = 目前的 mux；切越細越快，但周邊電路面積增加</span>', '<span>Thick line = current mux; finer splits are faster but add periphery area</span>');
    const c = [];
    c.push(T.total < cycle * 0.8 ? ['ok', t('存取時間 ', 'Access time ') + r(T.total, 0) + t(' ps，在 ', ' ps fits the ') + v.freq + t(' MHz 週期內有餘裕', ' MHz cycle with margin')] : T.total < cycle ? ['warn', t('存取時間 ', 'Access time ') + r(T.total, 0) + t(' ps 接近週期，餘裕不足 20%', ' ps is close to the cycle; under 20% margin')] : ['bad', t('存取時間 ', 'Access time ') + r(T.total, 0) + t(' ps 超過週期 ', ' ps exceeds the cycle of ') + r(cycle, 0) + t(' ps：增加 bank、提高 mux 或做管線化', ' ps: add banks, raise the mux or pipeline')]);
    c.push(rows > 512 ? ['warn', t('每 bank ', '') + rows + t(' 列偏多，位元線長、慢且 ΔV 難以建立', ' rows per bank is a lot: long, slow bit lines and hard-to-build ΔV')] : rows < 32 ? ['warn', t('每 bank 只有 ', 'Only ') + rows + t(' 列，周邊電路比例高、面積效率差', ' rows per bank: periphery dominates, poor area efficiency')] : ['ok', t('每 bank ', '') + rows + t(' 列，位元線長度適中', ' rows per bank: reasonable bit-line length')]);
    c.push(cols > 1024 ? ['warn', t('每列 ', '') + cols + t(' 行，字元線很長，考慮拆分', ' columns per row: very long word line, consider splitting')] : ['ok', t('每列 ', '') + cols + t(' 行', ' columns per row')]);
    if(!Number.isInteger(rows)) c.push(['bad', t('字數無法被 bank × mux 整除', 'Words are not divisible by banks × mux')]);
    if(v.vdd < 0.65) c.push(['warn', 'V<sub>DD</sub> ' + v.vdd + t(' V 偏低，需要讀寫輔助電路（見設計章節）', ' V is low; read/write assist needed (see Design chapter)')]);
    checks(c);
    table('ds-sys', [[t('總位元數', 'Total bits'), bitsTot.toLocaleString()], [t('讀取頻寬（每埠）', 'Read bandwidth (per port)'), fmtBW(v.bits / 8 * v.freq)], [t('每次讀取能量 / bit', 'Read energy per bit'), r(eRead / v.bits * 1000, 1) + ' fJ'], [t('漏電佔比（@ 50% 存取率）', 'Leakage share (@ 50% activity)'), r(leakmW / (leakmW + eRead * v.freq * 0.5 * 1e-3) * 100, 1) + '%']]);
    const name = 'sram_' + v.words + 'x' + v.bits;
    outputs([
      [t('規格摘要', 'Spec summary'), [
        '# SRAM macro (first-order estimate)',
        'name: ' + name,
        'words: ' + v.words + ', bits: ' + v.bits + ', banks: ' + v.banks + ', column_mux: ' + v.mux,
        'per_bank_array: ' + rows + ' rows x ' + cols + ' cols',
        'bitcell: ' + cellA + ' um^2, area_efficiency: ' + v.eff + '%',
        'macro_area: ' + r(area, 0) + ' um^2 (' + r(area / 1e6, 4) + ' mm^2)',
        'vdd: ' + v.vdd + ' V',
        'timing_ps: { decode: ' + r(T.tdec, 0) + ', bitline: ' + r(T.tbl, 0) + ', sense: 35, output: ' + r(T.total - T.tdec - T.tbl - 35, 0) + ', total: ' + r(T.total, 0) + ' }',
        'target_cycle_ps: ' + r(cycle, 0),
        'read_energy_pJ: ' + r(eRead, 3),
        'leakage: ' + r(leakmW * 1000, 1) + ' uW'
      ].join('\n')],
      [t('Verilog 行為模型', 'Verilog behavioural model'), [
        '// Behavioural model: ' + v.words + ' x ' + v.bits + ', single port, synchronous read/write',
        '// Generated by Memory Notes spec designer — for simulation only, not a compiled macro.',
        'module ' + name + ' #(',
        '  parameter WORDS = ' + v.words + ',',
        '  parameter BITS  = ' + v.bits + ',',
        '  parameter AW    = ' + ceil(log2(v.words)),
        ') (',
        '  input  wire            clk,',
        '  input  wire            cen,   // chip enable, active low',
        '  input  wire            wen,   // write enable, active low',
        '  input  wire [AW-1:0]   addr,',
        '  input  wire [BITS-1:0] din,',
        '  input  wire [BITS-1:0] bwen,  // bit write enable, active low',
        '  output reg  [BITS-1:0] dout',
        ');',
        '  reg [BITS-1:0] mem [0:WORDS-1];',
        '  always @(posedge clk) begin',
        '    if (!cen) begin',
        '      if (!wen) mem[addr] <= (mem[addr] & bwen) | (din & ~bwen);',
        '      else      dout      <= mem[addr];',
        '    end',
        '  end',
        'endmodule'
      ].join('\n')]
    ]);
  }
  function floorSram(banks, rows, cols, cellA, area){
    const SW = 420, SH = 300;
    const cw = Math.sqrt(cellA * 2.2), ch = cellA / cw;      // bitcell ~2.2:1
    const aw = cols * cw, ah = rows * ch;                     // per-bank array µm
    const dec = aw * 0.08, io = ah * 0.18;
    const bc = banks <= 2 ? banks : Math.ceil(Math.sqrt(banks * 2)), br = Math.ceil(banks / bc);
    const ctrl = Math.max(aw, ah) * 0.12;
    const totW = bc * (aw + dec) + ctrl, totH = br * (ah + io);
    const stretch = Math.max(1, totW / totH / 2.5);  // flat macros are drawn taller so the banks stay readable
    const sc = Math.min((SW - 24) / totW, (SH - 60) / (totH * stretch));
    const x0 = (SW - totW * sc) / 2, y0 = 10;
    let s = '', n = 0;
    for(let i = 0; i < br; i++) for(let j = 0; j < bc; j++){
      if(n >= banks) break;
      const x = x0 + (j < bc / 2 ? j * (aw + dec) : j * (aw + dec) + ctrl) * sc, y = y0 + i * (ah + io) * sc * stretch;
      s += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + (dec * sc).toFixed(1) + '" height="' + (ah * sc * stretch).toFixed(1) + '" class="c5" style="stroke-width:1"/>' +
        '<rect x="' + (x + dec * sc).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + (aw * sc).toFixed(1) + '" height="' + (ah * sc * stretch).toFixed(1) + '" class="c1" style="stroke-width:1"/>' +
        '<rect x="' + (x + dec * sc).toFixed(1) + '" y="' + (y + ah * sc * stretch).toFixed(1) + '" width="' + (aw * sc).toFixed(1) + '" height="' + (io * sc * stretch).toFixed(1) + '" class="c2" style="stroke-width:1"/>';
      if(aw * sc > 40 && ah * sc * stretch > 18) s += '<text x="' + (x + (dec + aw / 2) * sc).toFixed(1) + '" y="' + (y + ah * sc * stretch / 2 + 4).toFixed(1) + '" text-anchor="middle" class="ts">Bank ' + n + '</text>';
      n++;
    }
    const cx = x0 + Math.floor(bc / 2) * (aw + dec) * sc;
    s += '<rect x="' + cx.toFixed(1) + '" y="' + y0 + '" width="' + (ctrl * sc).toFixed(1) + '" height="' + (totH * sc * stretch).toFixed(1) + '" class="c6" style="stroke-width:1"/>' +
      '<text x="' + (SW / 2) + '" y="' + (SH - 26) + t('" text-anchor="middle" class="ts t-mut">每個 bank 陣列 ', '" text-anchor="middle" class="ts t-mut">Each bank array ') + r(aw, 1) + ' × ' + r(ah, 1) + t(' µm（', ' µm (') + rows + t(' 列 × ', ' rows × ') + cols + t(' 行）', ' cols)') + (stretch > 1.05 ? t('，縱向放大 ', ', vertical scale ') + r(stretch, 1) + '×' : '') + '</text>' +
      '<text x="' + (SW / 2) + '" y="' + (SH - 8) + t('" text-anchor="middle" class="ts t-mut">藍：陣列　紫：列解碼 / WL 驅動　橘：行多工 + SA + 寫入　黃：控制</text>', '" text-anchor="middle" class="ts t-mut">Blue: array  Purple: row decode / WL drivers  Orange: mux + SA + write  Yellow: control</text>');
    const svg = $('ds-fp'); svg.setAttribute('viewBox', '0 0 ' + SW + ' ' + SH); svg.innerHTML = s;
    $('ds-fp-sub').textContent = t('總面積 ', 'Total area ') + r(area, 0).toLocaleString() + ' µm²';
  }

  function update(){
    const p = $('preset');
    const match = PRESETS[type].findIndex(pr => Object.keys(pr[1]).every(k => V[k] === undefined || String(V[k]) === String(pr[1][k])));
    p.value = match >= 0 ? String(match) : 'custom';
    try { ({dram, nand, sram})[type](); }
    catch(e){ checks([['bad', t('參數無法計算：', 'Cannot compute with these inputs: ') + e.message]]); }
  }
  window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if(SCHEMA[h] && h !== type) switchType(h); });
  switchType(location.hash.slice(1) || 'dram');
})();
