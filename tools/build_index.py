"""Build assets/search-index.js (Chinese, root pages) and assets/search-index-en.js (English, en/ pages).

Indexes every <h2 id>/<h3 id> (with the text that follows it) and every glossary <dt>/<dd>.
Run after editing any page:  python tools/build_index.py
"""
import json
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES = [  # (file, group id used by site.js for the coloured tag)
    ("device.html", "device"),
    ("design.html", "design"),
    ("application.html", "app"),
    ("process.html", "fab"),
    ("test.html", "test"),
    ("reliability.html", "rel"),
    ("roles.html", "roles"),
    ("lessons.html", "lessons"),
]
EXTRA = [  # interactive pages, written by hand
    {"p": "lab.html", "a": "dram", "t": "DRAM 讀取模擬", "s": "電荷分享 ΔV、SA 偏移、保存時間、溫度、回寫 波形 charge sharing sense amplifier", "g": "lab", "lv": 1},
    {"p": "lab.html", "a": "sram", "t": "SRAM 蝴蝶曲線與 SNM", "s": "butterfly curve static noise margin cell ratio β Vmin 失配 read hold", "g": "lab", "lv": 1},
    {"p": "lab.html", "a": "nand", "t": "NAND Vt 分佈與 RBER", "s": "SLC MLC TLC QLC ISPP P/E 保存 read retry LDPC", "g": "lab", "lv": 1},
    {"p": "lab.html", "a": "retention", "t": "DRAM 保存與 Refresh", "s": "retention tREFW tREFI tRFC 溫度 refresh overhead 失效位元", "g": "lab", "lv": 1},
    {"p": "lab.html", "a": "march", "t": "March 測試故障模擬", "s": "MATS+ March C- March B checkerboard SAF TF CF AF 故障注入 覆蓋率 coverage", "g": "lab", "lv": 1},
    {"p": "lab.html", "a": "rowhammer", "t": "Row Hammer 緩解模擬", "s": "TRR RFM PRAC TRRespass 多邊攻擊 HCfirst 位元翻轉 refresh 視窗", "g": "lab", "lv": 1},
    {"p": "lab.html", "a": "wafer", "t": "晶圓良率模擬", "s": "wafer map 晶圓圖 Poisson 負二項 negative binomial 缺陷密度 D0 群聚 修補 redundancy", "g": "lab", "lv": 1},
    {"p": "lab.html", "a": "hbm", "t": "HBM 堆疊良率", "s": "KGD 測試漏網 TSV 修補 堆疊層數 12-Hi 16-Hi 接合良率", "g": "lab", "lv": 1},
    {"p": "lab.html", "a": "cost", "t": "每 Gb 成本模型", "s": "cost per bit 晶圓成本 dies per wafer DPW 良率 微縮 下一代節點 bit cost reduction", "g": "lab", "lv": 1},
    {"p": "lab.html", "a": "shmoo", "t": "Shmoo 圖與 guard band 模擬", "s": "shmoo plot 溫度反轉 temperature inversion guard band overkill 漏網 escape 速度分級 speed bin Vmin", "g": "lab", "lv": 1},
    {"p": "quiz.html", "a": "", "t": "記憶體測驗", "s": "quiz 題庫 自我檢查 元件 設計 應用 製程 封測 可靠度", "g": "quiz", "lv": 1},
    {"p": "designer.html", "a": "", "t": "記憶體規格設計器", "s": "DRAM NAND SRAM HBM 容量 位址 bank page 頻寬 die size 面積 感測裕度 refresh 計算器", "g": "designer", "lv": 1},
]

EXTRA_EN = [
    {"p": "lab.html", "a": "dram", "t": "DRAM read simulation", "s": "charge sharing ΔV, SA offset, retention, temperature, restore, waveforms, sense amplifier", "g": "lab", "lv": 1},
    {"p": "lab.html", "a": "sram", "t": "SRAM butterfly curve and SNM", "s": "static noise margin, cell ratio β, Vmin, mismatch, read, hold", "g": "lab", "lv": 1},
    {"p": "lab.html", "a": "nand", "t": "NAND Vt distributions and RBER", "s": "SLC MLC TLC QLC ISPP P/E retention read retry LDPC", "g": "lab", "lv": 1},
    {"p": "lab.html", "a": "retention", "t": "DRAM retention and refresh", "s": "retention tREFW tREFI tRFC temperature refresh overhead failing bits", "g": "lab", "lv": 1},
    {"p": "lab.html", "a": "march", "t": "March test fault simulation", "s": "MATS+ March C- March B checkerboard SAF TF CF AF fault injection coverage", "g": "lab", "lv": 1},
    {"p": "lab.html", "a": "rowhammer", "t": "Row hammer mitigation", "s": "TRR RFM PRAC TRRespass many-sided HCfirst bit flips refresh window", "g": "lab", "lv": 1},
    {"p": "lab.html", "a": "wafer", "t": "Wafer yield simulation", "s": "wafer map Poisson negative binomial defect density D0 clustering repair redundancy", "g": "lab", "lv": 1},
    {"p": "lab.html", "a": "hbm", "t": "HBM stack yield", "s": "KGD test escapes TSV repair stack height 12-Hi 16-Hi bond yield", "g": "lab", "lv": 1},
    {"p": "lab.html", "a": "cost", "t": "Cost per Gb model", "s": "cost per bit wafer cost dies per wafer DPW yield scaling next node bit cost reduction", "g": "lab", "lv": 1},
    {"p": "lab.html", "a": "shmoo", "t": "Shmoo plot and guard band simulation", "s": "shmoo plot temperature inversion guard band overkill escape speed bin Vmin", "g": "lab", "lv": 1},
    {"p": "quiz.html", "a": "", "t": "Memory quiz", "s": "quiz questions self-check devices design applications process test reliability", "g": "quiz", "lv": 1},
    {"p": "designer.html", "a": "", "t": "Memory spec designer", "s": "DRAM NAND SRAM HBM density address bank page bandwidth die size area sense margin refresh calculator", "g": "designer", "lv": 1},
]


class Collector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.entries = []
        self.cur = None          # entry being filled
        self.mode = None         # 'head' | 'body' | 'dt' | 'dd'
        self.section = ""        # id of the latest h2
        self.skip = 0            # depth inside svg/script/style
        self.in_article = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "article":
            self.in_article = True
        if not self.in_article:
            return
        if tag in ("svg", "script", "style", "figure"):
            self.skip += 1
            return
        if self.skip:
            return
        if tag in ("h2", "h3") and a.get("id"):
            if tag == "h2":
                self.section = a["id"]
            self.cur = {"a": a["id"], "t": "", "s": "", "lv": 1 if tag == "h2" else 2}
            self.entries.append(self.cur)
            self.mode = "head"
        elif tag == "dt":
            self.cur = {"a": self.section, "t": "", "s": "", "lv": 3}
            self.entries.append(self.cur)
            self.mode = "dt"
        elif tag == "dd":
            self.mode = "dd"

    def handle_endtag(self, tag):
        if tag == "article":
            self.in_article = False
        if tag in ("svg", "script", "style", "figure") and self.skip:
            self.skip -= 1
            return
        if tag in ("h2", "h3") and self.mode == "head":
            self.mode = "body"
        elif tag == "dt" and self.mode == "dt":
            self.mode = None
        elif tag == "dd":
            self.mode = None

    def handle_data(self, data):
        if self.skip or not self.cur or not self.mode:
            return
        if self.mode in ("head", "dt"):
            self.cur["t"] += data
        elif self.mode in ("body", "dd") and len(self.cur["s"]) < 260:
            self.cur["s"] += data


def clean(s):
    return re.sub(r"\s+", " ", s).strip()


def build(subdir, extra, out_name):
    out = []
    for fname, group in PAGES:
        c = Collector()
        c.feed((ROOT / subdir / fname).read_text(encoding="utf-8"))
        for e in c.entries:
            t = clean(e["t"])
            if not t:
                continue
            out.append({"p": fname, "a": e["a"], "t": t, "s": clean(e["s"])[:240], "g": group, "lv": e["lv"]})
    out.extend(extra)
    js = "/* Generated by tools/build_index.py — do not edit by hand. */\nwindow.SEARCH_INDEX = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n"
    (ROOT / "assets" / out_name).write_text(js, encoding="utf-8")
    print(f"{len(out)} entries -> assets/{out_name}")


def main():
    build("", EXTRA, "search-index.js")
    build("en", EXTRA_EN, "search-index-en.js")


if __name__ == "__main__":
    main()
