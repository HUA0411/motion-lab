#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MOTION LAB · A 节静态一致性扫描器（verifier 专用，只读业务文件，只写 audit/）

用法：
    python audit/scan_static.py                 # 人类可读摘要 + 写 audit/static-scan.txt/json
    python audit/scan_static.py --json-only     # 只写 JSON

覆盖检查（对应验证清单 A 节）：
  A1  14 个页面文件是否齐全
  A2  DOCTYPE / lang=zh-CN / 唯一 h1 / main#main / a.skip-link / data-page 映射
  A3  站内 a[href] / link[href] / script[src] / img[src] 是否存在（死链）
  A4  每页必备 CSS/JS 引用（tokens/motion/site + 自己 pages CSS/JS + motion.js/ui.js/site.js）
  A5  img 是否都有 alt；正文 emoji；console.log(
  A6  assets/css/pages/*.css 裸 hex 颜色（注释外）
  A7  外部网络请求（http(s):// script/link stylesheet，Google Fonts 除外）
  A8  标签闭合 / 标题层级不跳级（附加）
"""
import json
import os
import re
import sys
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# CONTRACT.md §4：data-page -> 页面文件
PAGE_MAP = [
    ("index", "index.html"),
    ("atlas", "atlas.html"),
    ("micro-interactions", "micro-interactions.html"),
    ("states-feedback", "states-feedback.html"),
    ("scroll-motion", "scroll-motion.html"),
    ("page-transitions", "page-transitions.html"),
    ("navigation", "navigation.html"),
    ("forms", "forms.html"),
    ("gestures", "gestures.html"),
    ("motion-physics", "motion-physics.html"),
    ("feedback", "feedback.html"),
    ("accessibility", "accessibility.html"),
    ("data-viz", "data-viz.html"),
    ("design-system", "design-system.html"),
]
SLUGS = [s for s, _ in PAGE_MAP]

VOID = {
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta",
    "param", "source", "track", "wbr",
}
# 允许省略闭合标签的元素（HTML5 可选闭合）
OPTIONAL_END = {"p", "li", "dt", "dd", "tr", "td", "th", "thead", "tbody", "tfoot",
                "option", "optgroup", "colgroup", "caption", "rt", "rp"}

EMOJI_RE = re.compile(
    "[\U0001F000-\U0001FAFF\u2600-\u27BF\u2B00-\u2BFF\uFE0F\u2190-\u21FF\u2300-\u23FF"
    "\u25A0-\u25FF\u2000-\u200F\uFE00-\uFE0F]"
)
# 仅取真正的“图形化”字符用于 FAIL 判定（箭头/几何/变体选择符等不算 emoji）
EMOJI_STRICT = re.compile(
    "[\U0001F000-\U0001FAFF\u2600-\u27BF\u2B00-\u2BFF\uFE0F\u2705\u274C\u26A0]"
)
HEX_RE = re.compile(r"#([0-9a-fA-F]{3,8})(?![0-9a-zA-Z_-])")
RGB_RE = re.compile(r"\brgba?\([^)]*\)|\bhsla?\([^)]*\)")
CSS_COMMENT_RE = re.compile(r"/\*.*?\*/", re.S)
EXTERNAL_RE = re.compile(r"^(?:https?:)?//", re.I)
GOOGLE_FONTS = ("fonts.googleapis.com", "fonts.gstatic.com")

results = []
notes = []


def rel(p):
    return os.path.relpath(p, ROOT).replace("\\", "/")


def strip_css_comments(css):
    """保留换行以便报告行号。"""
    return CSS_COMMENT_RE.sub(lambda m: re.sub(r"[^\n]", " ", m.group(0)), css)


class Auditor(HTMLParser):
    """收集结构信息 + 标签闭合 + 文本节点位置。"""

    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.path = path
        self.lines = open(path, encoding="utf-8", errors="replace").read().split("\n")
        self.stack = []
        self.tag_errors = []
        self.links = []        # a[href]
        self.link_tags = []    # link[href]
        self.scripts = []      # script[src]
        self.imgs = []         # (src, alt, has_alt)
        self.headings = []     # (level, text, line)
        self.ids = []
        self.classes = []
        self.inline_scripts = []
        self.emoji_hits = []
        self.console_logs = []
        self._text_stack = []
        self._in_script_style = None
        self._cur_script_attrs = None
        self._script_buf = []
        self._script_line = 0
        self.html_attrs = {}
        self.body_start_line = None

    # ---- helpers ----
    def _line(self):
        return self.getpos()[0]

    def _classof(self, attrs):
        d = dict(attrs)
        return d.get("class", "")

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if tag == "html":
            self.html_attrs = d
        if tag == "body":
            self.body_start_line = self._line()
        if d.get("id"):
            self.ids.append(d["id"])
        if d.get("class"):
            self.classes.append(d["class"])
        if tag not in VOID:
            self.stack.append((tag, self._line()))
        if tag == "a" and "href" in d:
            self.links.append((d["href"], self._line()))
        elif tag == "link" and "href" in d:
            self.link_tags.append((d["href"], d.get("rel", ""), d.get("as", ""), self._line()))
        elif tag == "script":
            if d.get("src"):
                self.scripts.append((d["src"], self._line(), bool(d.get("defer")), bool(d.get("async"))))
            else:
                self._in_script_style = "script"
                self._script_buf = []
                self._script_line = self._line()
        elif tag == "style":
            self._in_script_style = "style"
            self._script_buf = []
            self._script_line = self._line()
        elif tag == "img":
            self.imgs.append((d.get("src", ""), d.get("alt", None), "alt" in d, self._line()))
        elif tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
            self.headings.append([int(tag[1]), "", self._line()])

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if tag in ("script", "style") and self._in_script_style == tag:
            buf = "".join(self._script_buf)
            if tag == "script":
                self.inline_scripts.append({"line": self._script_line, "code": buf})
                for i, ln in enumerate(buf.split("\n")):
                    if re.search(r"\bconsole\.(log|debug|info|warn|error)\s*\(", ln):
                        self.console_logs.append({"line": self._script_line + i, "code": ln.strip()[:160]})
            self._in_script_style = None
            self._script_buf = []
        # 找到栈中最近的同名元素
        idx = None
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                idx = i
                break
        if idx is None:
            self.tag_errors.append({"kind": "stray-close", "tag": tag, "line": self._line()})
            return
        for t, ln in self.stack[idx + 1:]:
            if t not in OPTIONAL_END:
                self.tag_errors.append({"kind": "unclosed", "tag": t, "line": ln,
                                        "closed_by": tag, "close_line": self._line()})
        del self.stack[idx:]

    def handle_data(self, data):
        if self._in_script_style:
            self._script_buf.append(data)
            return
        # heading 文本
        if self.headings and self.stack and self.stack[-1][0] in ("h1", "h2", "h3", "h4", "h5", "h6"):
            if self.headings[-1][1] == "" or self.stack[-1][0] == "h%d" % self.headings[-1][0]:
                self.headings[-1][1] = (self.headings[-1][1] + data).strip()
        if not data.strip():
            return
        path_bits = [t for t, _ in self.stack]
        for m in EMOJI_STRICT.finditer(data):
            self.emoji_hits.append({
                "char": m.group(0),
                "codepoint": "U+%04X" % ord(m.group(0)[0]),
                "context": data[max(0, m.start() - 30):m.end() + 30].strip(),
                "line": self._line(),
                "ancestors": path_bits[-6:],
            })

    def close(self):
        super().close()
        for t, ln in self.stack:
            if t not in OPTIONAL_END:
                self.tag_errors.append({"kind": "never-closed", "tag": t, "line": ln})


def file_exists(relpath_from_root):
    return os.path.isfile(os.path.join(ROOT, relpath_from_root.replace("/", os.sep)))


def resolve_ref(page_rel, ref):
    """把页面里的引用解析成相对 ROOT 的 posix 路径（去掉 query/fragment）。"""
    if not ref:
        return None
    r = ref.strip()
    if r.startswith("#") or r.startswith("data:") or r.startswith("mailto:") or r.startswith("tel:"):
        return None
    if r.lower().startswith("javascript:"):
        return None
    r = r.split("#", 1)[0].split("?", 1)[0]
    if not r:
        return None
    if EXTERNAL_RE.match(r):
        return r
    base = os.path.dirname(page_rel)
    return os.path.normpath(os.path.join(base, r)).replace("\\", "/")


def scan_page(slug, filename):
    path = os.path.join(ROOT, filename)
    row = {"slug": slug, "file": filename, "exists": os.path.exists(path)}
    if not row["exists"]:
        row["status"] = "MISSING_FILE"
        results.append(row)
        return row
    raw = open(path, encoding="utf-8", errors="replace").read()
    a = Auditor(path)
    a.feed(raw)
    a.close()

    head = raw[:4000]
    row["doctype"] = bool(re.match(r"\s*<!DOCTYPE html>", raw, re.I))
    row["lang"] = a.html_attrs.get("lang")
    row["data_page"] = a.html_attrs.get("data-page")
    row["data_page_ok"] = row["data_page"] == slug
    row["data_motion"] = a.html_attrs.get("data-motion")
    row["data_theme"] = a.html_attrs.get("data-theme")

    h1s = [h for h in a.headings if h[0] == 1]
    row["h1_count"] = len(h1s)
    row["h1_text"] = h1s[0][1][:80] if h1s else None
    row["has_main_id"] = bool(re.search(r"<main[^>]*\bid=[\"']main[\"']", raw))
    row["has_skip_link"] = bool(re.search(r"<a[^>]*class=[\"'][^\"']*\bskip-link\b", raw))
    row["has_favicon_link"] = bool(re.search(r"<link[^>]*rel=[\"'][^\"']*\bicon\b", raw))
    row["heading_seq"] = ",".join("h%d" % h[0] for h in a.headings)
    skips = []
    prev = None
    for lvl, txt, ln in a.headings:
        if prev is not None and lvl > prev + 1:
            skips.append({"from": "h%d" % prev, "to": "h%d" % lvl, "line": ln, "text": txt[:40]})
        prev = lvl
    row["heading_skips"] = skips

    # 引用收集
    refs = []
    for href, ln in a.links:
        refs.append(("a[href]", href, ln))
    for href, relv, asv, ln in a.link_tags:
        refs.append(("link[%s]" % (relv or "?"), href, ln))
    for src, ln, _d, _as in a.scripts:
        refs.append(("script[src]", src, ln))
    for src, alt, has_alt, ln in a.imgs:
        refs.append(("img[src]", src, ln))

    dead = []
    externals = []
    for kind, ref, ln in refs:
        resolved = resolve_ref(filename, ref)
        if resolved is None:
            continue
        if EXTERNAL_RE.match(resolved):
            if not resolved.lower().startswith("http") and not resolved.lower().startswith("//"):
                externals.append({"kind": kind, "ref": ref, "line": ln})
            if "//" in resolved and not any(g in resolved for g in GOOGLE_FONTS) and kind in ("script[src]", "link[stylesheet]", "link[preload]"):
                externals.append({"kind": kind, "ref": ref, "line": ln, "protocol_relative": True})
            continue
        if not file_exists(resolved):
            dead.append({"kind": kind, "ref": ref, "resolved": resolved, "line": ln})
    row["dead_links"] = dead
    row["external_refs"] = externals

    # 必备引用
    own_css = "assets/css/pages/%s.css" % slug
    own_js = "assets/js/pages/%s.js" % slug
    own_inline = "assets/js/pages/%s.inline.js" % slug
    required = ["assets/css/tokens.css", "assets/css/motion.css", "assets/css/site.css"]
    row["missing_required_refs"] = []
    for req in required:
        if not re.search(r"href=[\"'][^\"']*" + re.escape(req), raw):
            row["missing_required_refs"].append(req)
    if file_exists(own_css) and not re.search(r"href=[\"'][^\"']*" + re.escape(own_css), raw):
        row["missing_required_refs"].append(own_css)
    for req in ["assets/js/motion.js", "assets/js/ui.js", "assets/js/site.js"]:
        if not re.search(r"src=[\"'][^\"']*" + re.escape(req), raw):
            row["missing_required_refs"].append(req)
    if file_exists(own_js) and not re.search(r"src=[\"'][^\"']*" + re.escape(own_js), raw):
        row["missing_required_refs"].append(own_js)
    if file_exists(own_inline) and not re.search(r"src=[\"'][^\"']*" + re.escape(own_inline), raw):
        row["missing_required_refs"].append(own_inline)
    # 反向：引用了不存在的 pages CSS/JS
    row["ref_missing_files"] = [d for d in dead if "pages/" in d["resolved"]]

    row["imgs_total"] = len(a.imgs)
    row["imgs_no_alt"] = [{"src": s, "line": ln} for s, _alt, has, ln in a.imgs if not has]
    row["emoji_hits"] = a.emoji_hits[:40]
    row["emoji_count"] = len(a.emoji_hits)
    row["console_logs"] = a.console_logs[:20]
    row["tag_errors"] = a.tag_errors[:20]
    row["inline_script_count"] = len(a.inline_scripts)
    row["status"] = "OK"
    results.append(row)
    return row


def scan_css_bare_hex():
    out = []
    pages_dir = os.path.join(ROOT, "assets", "css", "pages")
    if not os.path.isdir(pages_dir):
        return out
    for fn in sorted(os.listdir(pages_dir)):
        if not fn.endswith(".css"):
            continue
        p = os.path.join(pages_dir, fn)
        raw = open(p, encoding="utf-8", errors="replace").read()
        clean = strip_css_comments(raw)
        hexes = []
        for i, ln in enumerate(clean.split("\n"), 1):
            for m in HEX_RE.finditer(ln):
                hexes.append({"hex": "#" + m.group(1), "line": i,
                              "snippet": ln.strip()[:140]})
        rgbas = []
        for i, ln in enumerate(clean.split("\n"), 1):
            for m in RGB_RE.finditer(ln):
                rgbas.append({"lit": m.group(0), "line": i, "snippet": ln.strip()[:140]})
        # 注释内 hex（允许）
        commented = []
        for i, ln in enumerate(raw.split("\n"), 1):
            for m in HEX_RE.finditer(ln):
                commented.append("#" + m.group(1))
        out.append({"file": "assets/css/pages/" + fn, "bare_hex": hexes,
                    "rgba_literals": rgbas, "hex_anywhere_count": len(commented)})
    return out


def scan_js_console():
    """页面 JS / 内核 JS 里的 console.* 调用（站点代码不允许留调试输出）。"""
    out = []
    js_root = os.path.join(ROOT, "assets", "js")
    for dirpath, _dirs, files in os.walk(js_root):
        for fn in sorted(files):
            if not fn.endswith(".js"):
                continue
            p = os.path.join(dirpath, fn)
            raw = open(p, encoding="utf-8", errors="replace").read()
            hits = []
            for i, ln in enumerate(raw.split("\n"), 1):
                if re.search(r"\bconsole\.(log|debug|info|warn|error|trace|dir|table)\s*\(", ln):
                    hits.append({"line": i, "code": ln.strip()[:160]})
            if hits:
                out.append({"file": rel(p), "hits": hits})
    return out


def main():
    print("=" * 78)
    print("MOTION LAB · A 节静态一致性扫描  root=%s" % ROOT)
    print("=" * 78)
    missing_pages = []
    for slug, fn in PAGE_MAP:
        row = scan_page(slug, fn)
        if not row["exists"]:
            missing_pages.append(fn)

    A1 = "PASS" if not missing_pages else "FAIL"
    print("\n[A1] 14 个页面文件齐全：%s%s" % (A1, "" if not missing_pages else "  缺失: " + ", ".join(missing_pages)))

    # ---- A2 ----
    print("\n[A2] 结构门槛（DOCTYPE / lang / 唯一 h1 / main#main / skip-link / data-page）")
    a2_fail = []
    for row in results:
        if not row.get("exists"):
            continue
        problems = []
        if not row["doctype"]:
            problems.append("无 DOCTYPE")
        if row["lang"] != "zh-CN":
            problems.append("lang=%s" % row["lang"])
        if row["h1_count"] != 1:
            problems.append("h1 数量=%d" % row["h1_count"])
        if not row["has_main_id"]:
            problems.append("缺 main#main")
        if not row["has_skip_link"]:
            problems.append("缺 a.skip-link")
        if not row["data_page_ok"]:
            problems.append("data-page=%s（期望 %s）" % (row["data_page"], row["slug"]))
        if row["heading_skips"]:
            problems.append("标题跳级 %s" % [("%s→%s@%s" % (s["from"], s["to"], s["line"])) for s in row["heading_skips"]])
        row["a2_problems"] = problems
        if problems:
            a2_fail.append((row["file"], problems))
        print("   %-24s %s%s" % (row["file"], "PASS" if not problems else "FAIL", "" if not problems else "  ← " + "; ".join(problems)))

    # ---- A3 ----
    print("\n[A3] 站内引用存在性（死链）")
    a3_fail = []
    for row in results:
        if not row.get("exists"):
            continue
        if row["dead_links"]:
            a3_fail.append(row)
            for d in row["dead_links"]:
                print("   FAIL %-24s L%-5s %-14s %s  →  %s" % (row["file"], d["line"], d["kind"], d["ref"], d["resolved"]))
        else:
            print("   PASS %-24s 0 死链" % row["file"])

    # ---- A4 ----
    print("\n[A4] 必备引用（tokens/motion/site + 自己 pages CSS/JS + motion.js/ui.js/site.js）")
    a4_fail = []
    for row in results:
        if not row.get("exists"):
            continue
        miss = row["missing_required_refs"]
        if miss:
            a4_fail.append((row["file"], miss))
            print("   FAIL %-24s 缺引用: %s" % (row["file"], ", ".join(miss)))
        else:
            print("   PASS %-24s" % row["file"])

    # ---- A5 ----
    print("\n[A5] img alt / 正文 emoji / console.log(")
    a5_fail = []
    for row in results:
        if not row.get("exists"):
            continue
        probs = []
        if row["imgs_no_alt"]:
            probs.append("img 缺 alt: %s" % row["imgs_no_alt"])
        if row["emoji_count"]:
            probs.append("emoji %d 处: %s" % (row["emoji_count"], [(e["char"], e["codepoint"], e["line"]) for e in row["emoji_hits"][:6]]))
        if row["console_logs"]:
            probs.append("内联 console: %s" % [c["line"] for c in row["console_logs"]])
        if probs:
            a5_fail.append((row["file"], probs))
        print("   %-24s %s  imgs=%d noalt=%d emoji=%d console=%d" % (
            row["file"], "PASS" if not probs else "FAIL",
            row["imgs_total"], len(row["imgs_no_alt"]), row["emoji_count"], len(row["console_logs"])))

    js_console = scan_js_console()
    print("   -- JS 文件中的 console.* 调用 --")
    if not js_console:
        print("      PASS 0 处")
    for item in js_console:
        print("      %s: %d 处 %s" % (item["file"], len(item["hits"]), [h["line"] for h in item["hits"]]))

    # ---- A6 ----
    css_rows = scan_css_bare_hex()
    print("\n[A6] assets/css/pages/*.css 裸 hex 颜色（注释外）")
    a6_fail = []
    for row in css_rows:
        if row["bare_hex"]:
            a6_fail.append(row)
            print("   FAIL %-42s %d 处" % (row["file"], len(row["bare_hex"])))
            for h in row["bare_hex"][:8]:
                print("        L%-5d %-9s %s" % (h["line"], h["hex"], h["snippet"]))
        else:
            print("   PASS %-42s 0 处（含 rgba 字面量 %d）" % (row["file"], len(row["rgba_literals"])))

    # ---- A7 ----
    print("\n[A7] 外部网络请求（http(s):// script / stylesheet，Google Fonts 除外）")
    a7_fail = []
    for row in results:
        if not row.get("exists"):
            continue
        if row["external_refs"]:
            a7_fail.append((row["file"], row["external_refs"]))
            print("   FAIL %s %s" % (row["file"], row["external_refs"]))
    ext_in_css = []
    for fn in ["assets/css/tokens.css", "assets/css/motion.css", "assets/css/site.css"] + [r["file"] for r in css_rows]:
        p = os.path.join(ROOT, fn.replace("/", os.sep))
        if not os.path.exists(p):
            continue
        raw = open(p, encoding="utf-8", errors="replace").read()
        for i, ln in enumerate(raw.split("\n"), 1):
            for m in re.finditer(r"@import\s+(?:url\()?[\"']?(https?:)?//([^\"')\s]+)", ln):
                if not any(g in m.group(2) for g in GOOGLE_FONTS):
                    ext_in_css.append({"file": fn, "line": i, "url": m.group(2)})
    if ext_in_css:
        a7_fail.append(("css @import", ext_in_css))
        for e in ext_in_css:
            print("   FAIL %s L%s @import %s" % (e["file"], e["line"], e["url"]))
    if not a7_fail:
        print("   PASS 全站无第三方 http(s) 资源（Google Fonts 已白名单）")

    # ---- A8 ----
    print("\n[A8] 标签闭合")
    a8_fail = []
    for row in results:
        if not row.get("exists"):
            continue
        if row["tag_errors"]:
            a8_fail.append((row["file"], row["tag_errors"]))
            print("   FAIL %-24s %s" % (row["file"], row["tag_errors"][:5]))
        else:
            print("   PASS %-24s" % row["file"])

    # ---- A9 ----
    print("\n[A9] favicon 引用（缺 <link rel=icon> 会触发 /favicon.ico 404 控制台报错）")
    a9_fail = []
    for row in results:
        if not row.get("exists"):
            continue
        if not row["has_favicon_link"]:
            a9_fail.append(row["file"])
            print("   FAIL %-24s 无 <link rel=\"icon\">" % row["file"])
        else:
            print("   PASS %-24s" % row["file"])

    summary = {
        "generated": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
        "root": ROOT,
        "pages_found": [r["file"] for r in results if r.get("exists")],
        "pages_missing": missing_pages,
        "A1": {"verdict": A1, "missing": missing_pages},
        "A2": {"verdict": "PASS" if not a2_fail else "FAIL", "fail": a2_fail},
        "A3": {"verdict": "PASS" if not a3_fail else "FAIL",
               "fail": [{"file": r["file"], "dead": r["dead_links"]} for r in a3_fail]},
        "A4": {"verdict": "PASS" if not a4_fail else "FAIL", "fail": a4_fail},
        "A5": {"verdict": "PASS" if not a5_fail and not js_console else "FAIL",
               "fail": a5_fail, "js_console": js_console},
        "A6": {"verdict": "PASS" if not a6_fail else "FAIL", "fail": a6_fail},
        "A7": {"verdict": "PASS" if not a7_fail else "FAIL", "fail": a7_fail},
        "A8": {"verdict": "PASS" if not a8_fail else "FAIL", "fail": a8_fail},
        "A9": {"verdict": "PASS" if not a9_fail else "FAIL", "fail": a9_fail},
        "pages": results,
        "css": css_rows,
    }
    outdir = os.path.join(ROOT, "audit")
    os.makedirs(outdir, exist_ok=True)
    with open(os.path.join(outdir, "static-scan.json"), "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    with open(os.path.join(outdir, "static-scan.txt"), "w", encoding="utf-8") as f:
        f.write(json.dumps(summary, ensure_ascii=False, indent=2))
    print("\n[A 节汇总] A1=%s A2=%s A3=%s A4=%s A5=%s A6=%s A7=%s A8=%s A9=%s" % (
        summary["A1"]["verdict"], summary["A2"]["verdict"], summary["A3"]["verdict"],
        summary["A4"]["verdict"], summary["A5"]["verdict"], summary["A6"]["verdict"],
        summary["A7"]["verdict"], summary["A8"]["verdict"], summary["A9"]["verdict"]))
    print("JSON → audit/static-scan.json")


if __name__ == "__main__":
    main()
