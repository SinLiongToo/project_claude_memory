/* Memory Notes — quiz. Question bank per chapter; each has 4 options (first is correct, shuffled at run time). */
(function(){
  const CH = {dev:'元件', des:'設計', app:'應用', fab:'製程', tst:'封測', rel:'可靠度'};
  const Q = [
    // ---------- 元件 ----------
    {c:'dev', q:'SRAM 6T 單元的讀取穩定度主要取決於哪個強度比？', o:['PD / PG（cell ratio）', 'PG / PU（pull-up ratio）', 'PU / PD', 'WL 電壓 / BL 電壓'], e:'讀取時 PG 會把存 0 的節點往上抬，PD 必須比 PG 強才能把它壓住。寫入則需要 PG 比 PU 強。', l:'device.html#sram-rw'},
    {c:'dev', q:'DRAM 為什麼需要定期 refresh？', o:['電容上的電荷會經由各種漏電路徑流失', '感測放大器需要定期校正偏移', '位元線預充電壓會漂移', '字元線電壓會隨時間下降'], e:'接面漏電、次臨界漏電、GIDL 等讓儲存電荷流失，尾端弱單元只能保存數十到數百毫秒。', l:'device.html#leakage'},
    {c:'dev', q:'C_s = 10 fF、C_BL = 40 fF、V_DD = 1.2 V，讀取存「1」的單元時位元線訊號 ΔV 約為？', o:['120 mV', '60 mV', '240 mV', '600 mV'], e:'ΔV = (1.2 − 0.6) × 10 / (10 + 40) = 0.6 × 0.2 = 120 mV。', l:'device.html#charge-sharing'},
    {c:'dev', q:'DRAM 讀取之後為什麼必須回寫（restore）？', o:['電荷分享後單元電壓已接近 V_DD/2，原資料被破壞', '為了降低位元線電容', '為了讓字元線可以關閉', '為了更新 ECC 檢查碼'], e:'DRAM 讀取是破壞性的。感測放大器放大到全擺幅時 WL 仍開著，順便把正確值寫回電容。', l:'device.html#destructive-read'},
    {c:'dev', q:'TLC NAND 每個單元需要區分幾個 V_t 狀態？', o:['8', '3', '6', '16'], e:'n 位元需要 2ⁿ 個狀態，TLC 是 3 位元，所以是 8 個。', l:'device.html#mlc'},
    {c:'dev', q:'電荷捕捉（charge trap）單元相對浮閘的主要優勢是？', o:['捕捉層是絕緣體，局部缺陷只影響附近電荷，更耐微縮', '寫入電壓低一個數量級', '可以做到無限次寫入', '不需要穿隧氧化層'], e:'浮閘是導體，一個缺陷可能讓整顆浮閘的電子漏光；SiN 捕捉層中的電子被各自的陷阱困住。', l:'device.html#flash'},
    {c:'dev', q:'NAND 串讀取時，未被選中的字元線要加什麼電壓？', o:['較高的 V_PASS，讓它們不論存什麼都導通', '0 V，讓它們關閉', '負電壓，避免干擾', '與選中字元線相同的 V_READ'], e:'這樣整串是否導通只取決於被選中的單元。V_PASS 反覆施加也是 read disturb 的來源。', l:'device.html#nor-nand'},
    {c:'dev', q:'STT-MRAM 用什麼物理量存資料？', o:['MTJ 自由層的磁化方向（平行 / 反平行 → 低 / 高電阻）', '硫屬化物的晶相', '氧空缺導電細絲', '鐵電層的極化方向'], e:'晶相是 PCM，細絲是 ReRAM，極化是 FeRAM。', l:'device.html#mram'},
    // ---------- 設計 ----------
    {c:'des', q:'現代 DRAM 主流的開放式位元線架構，單元面積是多少？', o:['6F²', '4F²', '8F²', '12F²'], e:'摺疊式需要 8F²；開放式可達 6F²，但雜訊無法完全以共模抵消。4F² 是 VCT 的目標。', l:'design.html#bitline-arch'},
    {c:'des', q:'DDR5 的預取（prefetch）是幾 n？', o:['16n', '2n', '4n', '8n'], e:'DDR5 採 16n 預取、BL16；DDR3/DDR4 是 8n。', l:'design.html#interface'},
    {c:'des', q:'tRAS（ACT 到 PRE 的最短時間）主要由什麼決定？', o:['回寫（restore）必須完成', '行解碼延遲', 'I/O 驅動器速度', 'ZQ 校準'], e:'讀取是破壞性的，列關閉前資料必須完整寫回電容。', l:'design.html#timing'},
    {c:'des', q:'如果存取的列已經在感測放大器中（row hit），主要只需要付出哪個延遲？', o:['CL', 'tRCD + CL', 'tRP + tRCD + CL', 'tRFC'], e:'Row miss 需要先 PRE（tRP）、再 ACT（tRCD），然後才是 CL。', l:'design.html#timing'},
    {c:'des', q:'DRAM 字元線為什麼要升到高於 V_DD 的 V_PP？', o:['存取電晶體 V_t 較高，要完全導通才能完整寫入與讀出「1」', '為了降低位元線電容', '為了加快 refresh', '為了降低漏電'], e:'若字元線只有 V_DD，寫入「1」時儲存節點最多只到 V_DD − V_t。', l:'design.html#sense-amp'},
    {c:'des', q:'關於 DDR5 on-die ECC，何者正確？', o:['在晶片內做單位元更正，補償單元變弱，不取代系統層級 ECC', '可以更正整顆晶片失效', '由記憶體控制器計算檢查碼', '只在 refresh 時啟用'], e:'它對控制器透明，用來維持微縮後的良率與可靠度；整顆晶片失效要靠 Chipkill 等系統 ECC。', l:'design.html#ecc'},
    {c:'des', q:'冗餘修補分析中的 must-repair 是指？', o:['某列失效位元數超過剩餘備用行數，這列必須用備用列修', '所有失效都必須用備用行修', '修補必須在封裝後進行', '只能用雷射熔絲修補'], e:'先處理必然的分配，再用搜尋演算法處理剩下的，可以大幅縮小搜尋空間。', l:'design.html#redundancy'},
    {c:'des', q:'SRAM 的負位元線（negative BL）寫入輔助是為了？', o:['加強 PG 的寫入能力', '削弱 PD 以提高讀取穩定度', '降低漏電', '加快位元線預充'], e:'BL 拉到 0 以下，PG 的 V_GS 變大，更容易打贏 PU。', l:'design.html#assist-types'},
    {c:'des', q:'NAND 的 ISPP 步進電壓變小，會怎樣？', o:['V_t 分佈變窄，但寫入時間變長', '分佈變寬，寫入變快', '只影響抹除', '不影響分佈'], e:'量化誤差約為步進 ÷ √12，步進越小越精準但需要更多脈衝與驗證。', l:'design.html#nand-design'},
    // ---------- 應用 ----------
    {c:'app', q:'一條 DDR5-6400 DIMM（64-bit 資料）的峰值頻寬是？', o:['51.2 GB/s', '25.6 GB/s', '102.4 GB/s', '6.4 GB/s'], e:'6.4 Gb/s × 64 ÷ 8 = 51.2 GB/s。', l:'application.html#bandwidth'},
    {c:'app', q:'HBM 達到每封裝最高頻寬主要靠什麼？', o:['極寬的介面（1024 / 2048 bit）加上中介層上的短走線', '最高的每腳速率', 'PAM4 調變', '最多的 bank 數'], e:'HBM 每腳速率其實比 GDDR 低，靠寬度與短連線取勝，每位元能耗也最低。', l:'application.html#dram-family'},
    {c:'app', q:'700 億參數、FP16 權重的模型，在 3.35 TB/s 的記憶體上、批次 1 的生成速度上限大約是？', o:['約 24 token/s', '約 2.4 token/s', '約 240 token/s', '約 2400 token/s'], e:'每個 token 要讀 140 GB 權重：3350 ÷ 140 ≈ 24。', l:'application.html#llm-decode'},
    {c:'app', q:'SSD 的寫入放大（WAF）定義是？', o:['NAND 實際寫入量 ÷ 主機寫入量', '主機寫入量 ÷ NAND 實際寫入量', '寫入延遲 ÷ 讀取延遲', 'P/E 次數 ÷ 保固年數'], e:'GC 搬移有效頁會讓 NAND 寫得比主機要求的多。', l:'application.html#ftl'},
    {c:'app', q:'增加 SSD 預留空間（OP）的主要效果是？', o:['GC 更有效率，降低 WAF、提高耐寫度與穩定效能', '增加使用者容量', '提高讀取頻寬', '降低 DRAM 用量'], e:'可用的空白空間越多，GC 挑到的 block 無效頁越多，要搬移的有效頁越少。', l:'application.html#ftl'},
    {c:'app', q:'2 TB TLC、P/E 3000 次、WAF 2.5，TBW 約為？', o:['2400 TB', '6000 TB', '750 TB', '15000 TB'], e:'TBW ≈ 容量 × P/E ÷ WAF = 2 × 3000 ÷ 2.5 = 2400 TB。', l:'application.html#ssd-endurance'},
    {c:'app', q:'28 nm 以下的 MCU 為什麼逐漸改用 eMRAM / ePCM / eReRAM？', o:['HKMG 製程難以整合浮閘 eFlash，新興 NVM 可做在後段金屬層', '新興 NVM 每位元成本比 NAND 低', 'eFlash 無法通過車規', '新興 NVM 不需要 ECC'], e:'新興記憶體在 BEOL 金屬層之間整合，不影響前段電晶體製程。', l:'application.html#embedded'},
    {c:'app', q:'CXL.mem 的主要用途是？', o:['透過 PCIe 實體層擴充與共用記憶體容量', '取代 HBM', '連接 SSD 的儲存協定', '手機記憶體介面'], e:'突破 DIMM 插槽限制，並可做多主機記憶體池；延遲比本地 DRAM 多約 100 ns 以上。', l:'application.html#cxl-pim'},
    // ---------- 製程 ----------
    {c:'fab', q:'DRAM 高深寬比電容製程的典型挑戰是？', o:['細高結構在濕製程乾燥時倒塌，需要支撐層', '電容太矮導致容量過大', '無法使用 ALD', '需要磊晶成長'], e:'除了倒塌（leaning），還有蝕刻彎曲（bowing）與底部變細。', l:'process.html#dram-cap'},
    {c:'fab', q:'DRAM 電容介電層 ZAZ 中間的 Al₂O₃ 夾層作用是？', o:['壓抑漏電', '提高介電常數', '作為電極', '當作蝕刻停止層'], e:'ZrO₂ 介電常數高但漏電較大，Al₂O₃ 能隙大，用來阻擋漏電路徑。', l:'process.html#dram-cap'},
    {c:'fab', q:'埋入式字元線（BCAT）的主要好處是？', o:['等效通道長度變長，漏電大幅下降', '字元線電阻變大', '可以省略 STI', '讓位元線變短'], e:'閘極埋在矽溝槽中，在極小面積下做出較長的有效通道。', l:'process.html#dram-flow'},
    {c:'fab', q:'3D NAND 的閘極置換（replacement gate）是指？', o:['先以 SiN 佔位，從縫隙挖空後再填入 W 或 Mo 作為字元線', '把多晶矽通道換成金屬', '把浮閘換成電荷捕捉層', '把穿隧氧化層換成高介電材料'], e:'ON 堆疊中的 SiN 是犧牲層，用熱磷酸移除後以 ALD 填入金屬。', l:'process.html#nand3d-flow'},
    {c:'fab', q:'CMOS bonded Array（CBA）相對 CuA 的優勢是？', o:['周邊電路在另一片晶圓製作，不必承受陣列的高溫製程，效能更好', '只需要一片晶圓', '不需要混合鍵合', '階梯區可以省略'], e:'兩片晶圓分別最佳化後再以混合鍵合接合。', l:'process.html#nand3d-flow'},
    {c:'fab', q:'Poisson 良率模型下，晶粒 1 cm²、D₀ = 0.1 /cm²，良率約為？', o:['90.5%', '99%', '81%', '10%'], e:'Y = e^(−0.1) ≈ 0.905。', l:'process.html#yield'},
    {c:'fab', q:'記憶體晶片為什麼能容忍比邏輯晶片更多的隨機缺陷？', o:['陣列中的缺陷可以用備用列 / 行修補', '記憶體製程缺陷密度為零', '記憶體不做功能測試', '記憶體晶粒比較小'], e:'真正致命的是周邊電路缺陷與超出修補能力的群聚缺陷。', l:'process.html#yield'},
    {c:'fab', q:'以下何者「不是」5 nm 之後 SRAM 位元胞微縮趨緩的原因？', o:['DRAM 電容高度的限制', '金屬間距與接觸的限制', 'V_t 變異', '維持 V_min 所需的最小尺寸'], e:'DRAM 電容與邏輯製程中的 SRAM 無關。', l:'process.html#logic-sram'},
    // ---------- 封測 ----------
    {c:'tst', q:'March C− 的複雜度是？', o:['10N', '5N', '6N', '4N²'], e:'{⇕(w0); ⇑(r0,w1); ⇑(r1,w0); ⇓(r0,w1); ⇓(r1,w0); ⇕(r0)}：1+2+2+2+2+1 = 10。', l:'test.html#march'},
    {c:'tst', q:'哪個演算法能偵測 SAF 與 AF，但不保證偵測所有轉換型故障（TF）？', o:['MATS+', 'March C−', 'March B', 'GALPAT'], e:'MATS+ 最後一個元素寫 0 之後沒有再讀，所以無法 1→0 的 TF 可能漏網。', l:'test.html#march'},
    {c:'tst', q:'失效位元圖上出現「整列失效」，最常指向？', o:['字元線斷線或子字元線驅動器（SWD）問題', '位元線或感測放大器問題', '微粒污染', '單一弱單元'], e:'整行失效才指向位元線 / SA；群聚指向微粒。', l:'test.html#bitmap'},
    {c:'tst', q:'KGD（Known Good Die）對 HBM 特別重要，因為？', o:['堆疊中一顆壞晶粒就讓整個昂貴的堆疊報廢', 'HBM 不需要封裝後測試', 'HBM 晶粒不能修補', 'HBM 沒有冗餘'], e:'堆疊良率約為每層良率的 n 次方。', l:'test.html#repair'},
    {c:'tst', q:'哪一種熔絲可以在封裝後寫入（例如 PPR）？', o:['電熔絲 / 反熔絲', '雷射熔絲', '兩者都不行', '兩者都只能在晶圓上'], e:'雷射熔絲需要開窗、只能在晶圓階段使用。', l:'test.html#repair'},
    {c:'tst', q:'HBM 堆疊的 MR-MUF 製程特徵是？', o:['先回流焊一次接合所有層，再注入液態模封材料填滿縫隙', '每層之間放非導電膜逐層熱壓', '沒有凸塊的 Cu–Cu 直接接合', '用打線連接各層'], e:'逐層熱壓加非導電膜是 TC-NCF；Cu–Cu 直接接合是混合鍵合。', l:'test.html#hbm-stack'},
    {c:'tst', q:'Burn-in 的主要目的是？', o:['在出貨前加速篩除早夭失效', '量測最高速度以分級', '修補失效位元', '校準輸出阻抗'], e:'高溫高壓讓潛在缺陷提早失效，對應浴缸曲線的早夭期。', l:'test.html#burnin'},
    {c:'tst', q:'March 測試為什麼要同時使用遞增與遞減兩種位址順序？', o:['確保任一對單元中，攻擊者都會在某個元素中先被操作、受害者後被讀取', '為了縮短測試時間', '為了測試 refresh', '為了配合 ATE 的硬體限制'], e:'只用一個方向，只能抓到攻擊者位址小於（或大於）受害者的耦合故障。', l:'test.html#march-why'},
    // ---------- 可靠度 ----------
    {c:'rel', q:'DDR5 的 PRAC 是什麼？', o:['每一列都有啟動計數器，到門檻時要求控制器給時間緩解', '控制器依 bank 啟動數發額外 refresh', 'DRAM 內部只追蹤少數可疑列', '降低 refresh 頻率的省電模式'], e:'依 bank 計數發指令的是 RFM，只追蹤少數列的是 TRR。', l:'reliability.html#rowhammer'},
    {c:'rel', q:'多邊 row hammer 攻擊（如 TRRespass）能繞過 TRR 的原因是？', o:['攻擊列數超過 TRR 追蹤表容量，追蹤被洗掉', 'TRR 只在高溫啟用', '多邊攻擊不需要啟動列', 'TRR 只保護 bank 0'], e:'可以在實驗室的 Row Hammer 分頁把攻擊列從 2 改成 20 試試看。', l:'lab.html#rowhammer'},
    {c:'rel', q:'DRAM 保存時間與溫度的關係大約是？', o:['每升高約 10 °C 減半', '每升高 10 °C 加倍', '與溫度無關', '每升高 1 °C 減半'], e:'漏電隨溫度呈 Arrhenius 關係，所以 85 °C 以上要加倍 refresh。', l:'reliability.html#dram-retention'},
    {c:'rel', q:'VRT（Variable Retention Time）指的是？', o:['某些單元的保存時間會在幾個值之間隨機跳動', '保存時間隨電壓線性變化', 'refresh 間隔可以動態調整', '保存時間隨寫入次數增加'], e:'這讓「測一次就知道誰是弱單元」不可靠。', l:'reliability.html#dram-retention'},
    {c:'rel', q:'JEDEC JESD218 對消費級（client）SSD 的保存要求是？', o:['寫到額定 TBW 後，斷電在 30 °C 下保存 1 年', '40 °C 下保存 3 個月', '85 °C 下保存 10 年', '25 °C 下永久保存'], e:'40 °C、3 個月是企業級的要求。', l:'reliability.html#flash-retention'},
    {c:'rel', q:'為什麼 SRAM 對軟錯誤特別敏感？', o:['節點電容小，臨界電荷 Q_crit 低', 'SRAM 不能使用 ECC', 'SRAM 用的電壓最高', 'SRAM 沒有 refresh'], e:'微縮後單一位元被擊中的機率下降，但多位元翻轉（MBU）比例上升。', l:'reliability.html#ser'},
    {c:'rel', q:'E_a = 0.7 eV，使用溫度 55 °C、測試溫度 125 °C，Arrhenius 加速因子約為？', o:['約 78', '約 8', '約 780', '約 2'], e:'AF = exp[(0.7/8.617e-5) × (1/328 − 1/398)] ≈ e^4.35 ≈ 78。', l:'reliability.html#arrhenius'},
    {c:'rel', q:'NAND 的 read disturb 主要造成什麼？', o:['同一串未選中單元承受 V_PASS 被輕微寫入，V_t 上移（特別是抹除態）', '選中單元被抹除', '位元線斷線', '電荷捕捉層崩潰'], e:'讀取密集的 block 要定期搬移資料。', l:'reliability.html#disturb'}
  ];

  const $ = id => document.getElementById(id);
  const store = (k, v) => { try { if(v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch(e){ return null; } };
  const shuffle = a => { for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const sel = new Set(Object.keys(CH));
  let run = null;

  function setup(){
    $('qz-chips').innerHTML = Object.entries(CH).map(([k, v]) => '<button class="btn" type="button" data-c="' + k + '" aria-pressed="true">' + v + ' <small style="opacity:.7">' + Q.filter(q => q.c === k).length + '</small></button>').join('');
    $('qz-chips').addEventListener('click', e => {
      const b = e.target.closest('button'); if(!b) return;
      const c = b.dataset.c;
      if(sel.has(c) && sel.size > 1) sel.delete(c); else sel.add(c);
      [...$('qz-chips').children].forEach(x => x.setAttribute('aria-pressed', sel.has(x.dataset.c) ? 'true' : 'false'));
      count();
    });
    $('qz-n').addEventListener('change', count);
    $('qz-start').addEventListener('click', start);
    count();
    const best = store('mem-quiz-best');
    $('qz-best').textContent = best ? '最佳紀錄：' + best : '';
  }
  function count(){ const n = Q.filter(q => sel.has(q.c)).length; $('qz-count').textContent = '題庫 ' + n + ' 題'; }
  function start(){
    const pool = shuffle(Q.filter(q => sel.has(q.c)).slice());
    const n = $('qz-n').value === 'all' ? pool.length : Math.min(+$('qz-n').value, pool.length);
    run = {qs: pool.slice(0, n).map(q => Object.assign({}, q, {opts: shuffle(q.o.map((t, i) => ({t, ok: i === 0})))})), i:0, score:0, wrong:[]};
    $('qz-setup').hidden = true; $('qz-end').hidden = true; $('qz-card').hidden = false;
    show();
  }
  function show(){
    const q = run.qs[run.i];
    $('qz-prog').style.width = (run.i / run.qs.length * 100) + '%';
    $('qz-meta').innerHTML = '<span class="tag ' + q.c + '">' + CH[q.c] + '</span>第 ' + (run.i + 1) + ' / ' + run.qs.length + ' 題 · 得分 ' + run.score;
    $('qz-q').textContent = q.q;
    $('qz-opts').innerHTML = q.opts.map((o, i) => '<button class="qopt" type="button" data-i="' + i + '"><b>' + 'ABCD'[i] + '</b><span>' + o.t + '</span></button>').join('');
    $('qz-fb').hidden = true;
    $('qz-opts').querySelector('button').focus({preventScroll:true});
  }
  function answer(i){
    const q = run.qs[run.i]; if(q.done) return; q.done = true;
    const ok = q.opts[i].ok;
    if(ok) run.score++; else run.wrong.push(q);
    [...$('qz-opts').children].forEach((b, k) => { b.disabled = true; if(q.opts[k].ok) b.classList.add('right'); else if(k === i) b.classList.add('wrong'); });
    $('qz-fb').hidden = false;
    $('qz-fb').innerHTML = '<p class="' + (ok ? 'okc' : 'badc') + '"><b>' + (ok ? '答對了' : '答錯了') + '</b></p><p>' + q.e + '</p><p><a href="' + q.l + '">複習這一節 →</a></p>' +
      '<button class="btn pri" id="qz-next" type="button">' + (run.i + 1 < run.qs.length ? '下一題 →' : '看結果') + '</button>';
    $('qz-next').addEventListener('click', next);
    $('qz-next').focus({preventScroll:true});
  }
  function next(){ run.i++; if(run.i < run.qs.length) show(); else end(); }
  function end(){
    $('qz-card').hidden = true; $('qz-end').hidden = false;
    const pct = Math.round(run.score / run.qs.length * 100);
    const prev = store('mem-quiz-best'), prevPct = prev ? parseInt(prev, 10) : -1;
    if(pct > prevPct) store('mem-quiz-best', pct + '%（' + run.score + '/' + run.qs.length + '）');
    const by = {};
    run.qs.forEach(q => { by[q.c] = by[q.c] || [0, 0]; by[q.c][1]++; if(!run.wrong.includes(q)) by[q.c][0]++; });
    $('qz-score').innerHTML = '<div class="metrics">' +
      '<div class="metric ' + (pct >= 80 ? 'ok' : pct >= 60 ? 'warn' : 'bad') + '"><div class="ml">得分</div><div class="mv">' + pct + ' <small>%</small></div><div class="ms">' + run.score + ' / ' + run.qs.length + ' 題</div></div>' +
      Object.entries(by).map(([c, v]) => '<div class="metric"><div class="ml">' + CH[c] + '</div><div class="mv">' + v[0] + ' <small>/ ' + v[1] + '</small></div></div>').join('') + '</div>';
    $('qz-review').innerHTML = run.wrong.length ? '<h3>答錯的題目</h3>' + run.wrong.map(q => '<div class="rev"><p><span class="tag ' + q.c + '">' + CH[q.c] + '</span>' + q.q + '</p><p class="note">正解：' + q.o[0] + '。' + q.e + ' <a href="' + q.l + '">複習 →</a></p></div>').join('') : '<p>全部答對，太強了。</p>';
    $('qz-best').textContent = '最佳紀錄：' + (store('mem-quiz-best') || pct + '%');
  }
  $('qz-opts').addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if(b) answer(+b.dataset.i); });
  document.addEventListener('keydown', e => {
    if(!run || $('qz-card').hidden || /input|select|textarea/i.test(document.activeElement.tagName)) return;
    const k = 'abcd'.indexOf(e.key.toLowerCase()), n = '1234'.indexOf(e.key);
    const i = k >= 0 ? k : n;
    if(i >= 0 && i < run.qs[run.i].opts.length && !run.qs[run.i].done) answer(i);
  });
  $('qz-again').addEventListener('click', start);
  $('qz-back').addEventListener('click', () => { $('qz-end').hidden = true; $('qz-setup').hidden = false; });
  setup();
})();
