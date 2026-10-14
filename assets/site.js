/* Memory Notes — shared chrome: top bar, theme, table of contents, pager, site-wide find (Ctrl+K). */
(function(){
  const PAGES = [
    {id:'index',  href:'index.html',       label:'首頁'},
    {id:'device', href:'device.html',      label:'元件',   ch:'dev', en:'Devices'},
    {id:'design', href:'design.html',      label:'設計',   ch:'des', en:'Circuit design'},
    {id:'app',    href:'application.html', label:'應用',   ch:'app', en:'Applications'},
    {id:'fab',    href:'process.html',     label:'製程',   ch:'fab', en:'Process'},
    {id:'test',   href:'test.html',        label:'封測',   ch:'tst', en:'Test & packaging'},
    {id:'rel',    href:'reliability.html', label:'可靠度', ch:'rel', en:'Reliability'},
    {sep:true},
    {id:'lab',      href:'lab.html',      label:'互動實驗室'},
    {id:'designer', href:'designer.html', label:'規格設計器'},
    {sep:true},
    {id:'roles',    href:'roles.html',    label:'職務地圖'},
    {id:'quiz',     href:'quiz.html',     label:'測驗'}
  ];
  const CHAPTERS = PAGES.filter(p => p.ch);
  const page = document.body.dataset.page || 'index';

  const ICON = {
    chip:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="5" width="14" height="14" rx="2"/><rect x="8.5" y="8.5" width="7" height="7" rx="1" fill="currentColor" opacity=".25"/><path d="M9 2v3M12 2v3M15 2v3M9 19v3M12 19v3M15 19v3M2 9h3M2 12h3M2 15h3M19 9h3M19 12h3M19 15h3"/></svg>',
    find:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    sun:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>'
  };

  /* ---------- theme ---------- */
  const root = document.documentElement;
  function store(k, v){ try{ if(v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); }catch(e){ return null; } }
  const saved = store('mem-theme');
  if(saved === 'light' || saved === 'dark') root.dataset.theme = saved;
  function isDark(){
    if(root.dataset.theme) return root.dataset.theme === 'dark';
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
  }

  /* ---------- header ---------- */
  const hdr = document.createElement('header');
  hdr.className = 'top';
  hdr.innerHTML = '<div class="top-in">' +
    '<a class="brand" href="index.html" aria-label="Memory Notes 首頁">' + ICON.chip + '<span>Memory Notes</span></a>' +
    '<nav class="nav" aria-label="章節">' + PAGES.filter(p => p.id !== 'index').map(p => p.sep ? '<span class="sep"></span>' :
      '<a href="' + p.href + '"' + (p.id === page ? ' aria-current="page"' : '') + '>' + p.label + '</a>').join('') + '</nav>' +
    '<button class="tbtn" id="findBtn" type="button" title="搜尋 (Ctrl+K)">' + ICON.find + '<span class="lbl">搜尋</span></button>' +
    '<button class="tbtn" id="themeBtn" type="button" title="切換深淺色"></button>' +
    '</div>';
  document.body.prepend(hdr);
  const themeBtn = hdr.querySelector('#themeBtn');
  function paintThemeBtn(){ themeBtn.innerHTML = isDark() ? ICON.sun : ICON.moon; themeBtn.setAttribute('aria-label', isDark() ? '切換為淺色' : '切換為深色'); }
  paintThemeBtn();
  themeBtn.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    root.dataset.theme = next; store('mem-theme', next); paintThemeBtn();
    document.dispatchEvent(new CustomEvent('themechange'));
  });
  if(window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { paintThemeBtn(); document.dispatchEvent(new CustomEvent('themechange')); });
  const navCur = hdr.querySelector('.nav a[aria-current]');
  if(navCur) navCur.scrollIntoView({block:'nearest', inline:'center'});

  /* ---------- TOC + scrollspy ---------- */
  const toc = document.querySelector('.toc');
  const heads = [...document.querySelectorAll('article h2[id]')];
  if(toc && heads.length){
    toc.innerHTML = '<b>本章目錄</b>' + heads.map(h => '<a href="#' + h.id + '">' + h.textContent + '</a>').join('');
    const links = new Map([...toc.querySelectorAll('a')].map(a => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver(es => {
      es.forEach(e => { if(e.isIntersecting){ links.forEach(a => a.classList.remove('on')); const a = links.get(e.target.id); if(a) a.classList.add('on'); } });
    }, {rootMargin:'-20% 0px -70% 0px'});
    heads.forEach(h => io.observe(h));
  }
  heads.forEach((h, i) => { if(!h.querySelector('.num')) h.insertAdjacentHTML('afterbegin', '<span class="num">' + String(i + 1).padStart(2, '0') + '</span>'); });

  /* ---------- pager ---------- */
  const pager = document.querySelector('.pager');
  const ci = CHAPTERS.findIndex(c => c.id === page);
  if(pager && ci >= 0){
    const prev = CHAPTERS[ci - 1], next = CHAPTERS[ci + 1];
    pager.innerHTML = (prev ? '<a href="' + prev.href + '"><small>← 上一章</small>' + prev.label + ' · ' + prev.en + '</a>' : '<span></span>') +
      (next ? '<a class="next" href="' + next.href + '"><small>下一章 →</small>' + next.label + ' · ' + next.en + '</a>'
            : '<a class="next" href="lab.html"><small>動手試試 →</small>互動實驗室</a>');
  }

  /* ---------- find ---------- */
  const PAGE_LABEL = {device:'元件', design:'設計', app:'應用', fab:'製程', test:'封測', rel:'可靠度', lab:'實驗室', designer:'設計器', roles:'職務', quiz:'測驗', index:'首頁'};
  const PAGE_TAG = {device:'dev', design:'des', app:'app', fab:'fab', test:'tst', rel:'rel', lab:'lab', designer:'dsg', roles:'dsg', quiz:'dsg', index:'lab'};
  const ov = document.createElement('div');
  ov.className = 'find-ov'; ov.hidden = true;
  ov.innerHTML = '<div class="find-box" role="dialog" aria-modal="true" aria-label="全站搜尋">' +
    '<input id="findQ" type="search" placeholder="搜尋：DRAM、sense amp、March C-、HBM、row hammer…" autocomplete="off">' +
    '<div class="find-meta" id="findMeta"></div><div class="find-res" id="findRes" role="listbox"></div></div>';
  document.body.appendChild(ov);
  const q = ov.querySelector('#findQ'), res = ov.querySelector('#findRes'), meta = ov.querySelector('#findMeta');
  let sel = 0, hits = [];
  const esc = s => s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function hl(s, terms){
    let out = esc(s);
    terms.forEach(t => { if(!t) return; const re = new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'); out = out.replace(re, '<mark>$1</mark>'); });
    return out;
  }
  function run(){
    const idx = window.SEARCH_INDEX || [];
    const terms = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if(!terms.length){ hits = idx.filter(e => e.lv === 1).slice(0, 40); }
    else {
      hits = idx.map(e => {
        const t = e.t.toLowerCase(), s = (e.s || '').toLowerCase();
        let score = 0;
        for(const w of terms){
          if(t.includes(w)) score += t.startsWith(w) ? 6 : 4;
          else if(s.includes(w)) score += 1;
          else return null;
        }
        if(e.lv === 1) score += .5;
        return {e, score};
      }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 60).map(x => x.e);
    }
    sel = 0;
    meta.textContent = terms.length ? (hits.length + ' 筆結果') : '所有章節 — 輸入關鍵字（中英文皆可）';
    res.innerHTML = hits.map((e, i) => {
      const snip = e.s ? e.s.slice(0, 110) : '';
      return '<a role="option" href="' + e.p + (e.a ? '#' + e.a : '') + '"' + (i === 0 ? ' class="sel"' : '') + '>' +
        '<span class="tag ' + (PAGE_TAG[e.g] || 'lab') + '">' + (PAGE_LABEL[e.g] || '') + '</span>' + hl(e.t, terms) +
        (snip ? '<small>' + hl(snip, terms) + '</small>' : '') + '</a>';
    }).join('') || '<div class="find-meta">找不到符合的內容</div>';
  }
  function openFind(){ ov.hidden = false; q.value = ''; run(); q.focus(); }
  function closeFind(){ ov.hidden = true; }
  function mark(){ [...res.children].forEach((a, i) => a.classList.toggle('sel', i === sel)); const a = res.children[sel]; if(a) a.scrollIntoView({block:'nearest'}); }
  q.addEventListener('input', run);
  q.addEventListener('keydown', e => {
    if(e.key === 'ArrowDown'){ e.preventDefault(); sel = Math.min(sel + 1, hits.length - 1); mark(); }
    else if(e.key === 'ArrowUp'){ e.preventDefault(); sel = Math.max(sel - 1, 0); mark(); }
    else if(e.key === 'Enter'){ const a = res.children[sel]; if(a && a.href){ closeFind(); location.href = a.href; } }
  });
  res.addEventListener('click', e => { if(e.target.closest('a')) closeFind(); });
  ov.addEventListener('click', e => { if(e.target === ov) closeFind(); });
  document.addEventListener('keydown', e => {
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'){ e.preventDefault(); ov.hidden ? openFind() : closeFind(); }
    else if(e.key === '/' && ov.hidden && !/input|textarea|select/i.test(document.activeElement.tagName)){ e.preventDefault(); openFind(); }
    else if(e.key === 'Escape' && !ov.hidden) closeFind();
  });
  hdr.querySelector('#findBtn').addEventListener('click', openFind);
  document.querySelectorAll('[data-open-find]').forEach(b => b.addEventListener('click', openFind));
  window.MemSite = {openFind, isDark};
})();
