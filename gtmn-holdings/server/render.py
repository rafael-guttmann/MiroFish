"""Turns Markdown deliverables into readable PDF, Word, Excel, PowerPoint and JPEG files."""
import html
import io
import re
import textwrap

MIME = {
    "PDF": ("application/pdf", "pdf"),
    "Word": ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"),
    "Excel": ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"),
    "PowerPoint": ("application/vnd.openxmlformats-officedocument.presentationml.presentation", "pptx"),
    "JPEG": ("image/jpeg", "jpg"),
}

_EMOJI = re.compile("[\U0001F000-\U0001FAFF\U00002600-\U000027BF]")
_REPLACEMENTS = {
    "✅": "[OK]", "☑": "[OK]", "✔": "[OK]", "✓": "[OK]", "❌": "[x]", "✗": "[x]",
    "🔴": "HIGH", "🟠": "HIGH", "🟡": "MEDIUM", "🟢": "LOW",
    "→": "->", "←": "<-", "≥": ">=", "≤": "<=", "—": "—", "–": "–",
    "■": "•", "": "-", "\u00a0": " ",
}


def _safe_unicode(value):
    value = str(value).translate(str.maketrans(_REPLACEMENTS))
    value = re.sub(r"[\uFE00-\uFE0F\u200D]", "", value)
    return _EMOJI.sub("", value)


def _cells(line):
    line = line.strip()
    if line.startswith("|"):
        line = line[1:]
    if line.endswith("|"):
        line = line[:-1]
    return [c.strip().replace("<br>", "\n").replace("<br/>", "\n").replace("<br />", "\n")
            for c in re.split(r"(?<!\\)\|", line)]


def _is_separator(line):
    cells = _cells(line)
    return bool(cells) and all(re.fullmatch(r":?-{2,}:?", c.strip()) for c in cells if c.strip())


def _list_line(line):
    m = re.match(r"^(\s*)([-*+]|\d+[.)])\s+(.*)$", line)
    if not m:
        return None
    marker = m[2]
    return len(m[1].expandtabs(2)) // 2, marker, m[3]


def parse(md, title=None):
    """Parse common Markdown blocks without interpreting code as headings or prose."""
    out, lines, i = [], str(md).replace("\r\n", "\n").replace("\r", "\n").split("\n"), 0
    while i < len(lines):
        ln = lines[i].rstrip()
        if not ln.strip() or re.fullmatch(r"\s*-{3,}\s*", ln):
            i += 1
            continue
        fence = re.match(r"^\s*(```+|~~~+)", ln)
        if fence:
            marker = fence[1][0]
            i += 1
            code = []
            while i < len(lines) and not re.match(r"^\s*" + re.escape(marker) + r"{3,}\s*$", lines[i]):
                code.append(lines[i].rstrip("\n"))
                i += 1
            if i < len(lines):
                i += 1
            out.append(("code", "\n".join(code).rstrip()))
            continue
        if ln.lstrip().startswith(">"):
            quote = []
            while i < len(lines) and lines[i].lstrip().startswith(">"):
                quote.append(re.sub(r"^\s*>\s?", "", lines[i]).strip())
                i += 1
            out.append(("quote", " ".join(x for x in quote if x)))
            continue
        if ln.lstrip().startswith("|"):
            rows = []
            while i < len(lines) and lines[i].lstrip().startswith("|"):
                row = _cells(lines[i])
                if not _is_separator(lines[i]):
                    rows.append(row)
                i += 1
            if rows:
                out.append(("table", rows))
            continue
        item = _list_line(ln)
        if item:
            while i < len(lines):
                parsed = _list_line(lines[i].rstrip())
                if not parsed:
                    break
                depth, marker, value = parsed
                out.append(("li", value, depth, marker))
                i += 1
            continue
        heading = re.match(r"^\s*(#{1,6})\s+(.*?)\s*#*\s*$", ln)
        if heading:
            level, value = min(len(heading[1]), 3), heading[2].strip()
            if not (not out and level == 1 and title and plain(value).casefold() == plain(title).casefold()):
                out.append(("h", level, value))
            i += 1
            continue
        paragraph = [ln.strip()]
        i += 1
        while i < len(lines):
            nxt = lines[i].rstrip()
            if (not nxt.strip() or re.fullmatch(r"\s*-{3,}\s*", nxt) or
                    re.match(r"^\s*(```+|~~~+)", nxt) or nxt.lstrip().startswith((">", "|")) or
                    _list_line(nxt) or re.match(r"^\s*#{1,6}\s+", nxt)):
                break
            paragraph.append(nxt.strip())
            i += 1
        out.append(("p", " ".join(paragraph)))
    return out


_INLINE = re.compile(
    r"(\[([^\]]+)\]\((https?://[^)\s]+)\)|\*\*(.+?)\*\*|`([^`]+)`|(?<!\w)\*([^*]+)\*(?!\w))"
)


def _inline_parts(value):
    value = _safe_unicode(value)
    parts, last = [], 0
    for m in _INLINE.finditer(value):
        if m.start() > last:
            parts.append((value[last:m.start()], ""))
        if m[2] is not None:
            parts.append((m[2], "link:" + m[3]))
        elif m[4] is not None:
            parts.append((m[4], "bold"))
        elif m[5] is not None:
            parts.append((m[5], "code"))
        else:
            parts.append((m[6], "italic"))
        last = m.end()
    if last < len(value):
        parts.append((value[last:], ""))
    return parts


def plain(value):
    value = _safe_unicode(value)
    value = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+)\)", r"\1 (\2)", value)
    return re.sub(r"[*_`]+", "", value)


def _rl(value):
    out = []
    for text, kind in _inline_parts(value):
        safe = html.escape(text, quote=False).replace("\n", "<br/>")
        if kind == "bold":
            safe = "<b>" + safe + "</b>"
        elif kind == "italic":
            safe = "<i>" + safe + "</i>"
        elif kind == "code":
            safe = '<font name="HoldingsMono">' + safe + "</font>"
        elif kind.startswith("link:"):
            href = html.escape(kind[5:], quote=True)
            safe = f'<link href="{href}" color="#315C82">{safe}</link>'
        out.append(safe)
    return "".join(out)


def _register_pdf_fonts():
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    if "HoldingsSans" in pdfmetrics.getRegisteredFontNames():
        return "HoldingsSans", "HoldingsSans-Bold", "HoldingsSerif", "HoldingsSerif-Bold", "HoldingsMono"
    import glob
    roots = [
        "/usr/share/fonts/truetype/liberation",
        "/usr/share/fonts/truetype/liberation2",
        "/usr/share/fonts/truetype/dejavu",
        "/System/Library/Fonts/Supplemental",
        "/Library/Fonts",
    ]
    candidates = {}
    patterns = {
        "sans": ("LiberationSans-Regular.ttf", "DejaVuSans.ttf", "Arial.ttf"),
        "sans_bold": ("LiberationSans-Bold.ttf", "DejaVuSans-Bold.ttf", "Arial Bold.ttf"),
        "serif": ("LiberationSerif-Regular.ttf", "DejaVuSerif.ttf", "Times New Roman.ttf"),
        "serif_bold": ("LiberationSerif-Bold.ttf", "DejaVuSerif-Bold.ttf", "Times New Roman Bold.ttf"),
        "mono": ("LiberationMono-Regular.ttf", "DejaVuSansMono.ttf", "Courier New.ttf"),
    }
    for key, names in patterns.items():
        for root in roots:
            for name in names:
                matches = glob.glob(root.rstrip("/") + "/**/" + name, recursive=True)
                if matches:
                    candidates[key] = matches[0]
                    break
            if key in candidates:
                break
    if len(candidates) != len(patterns):
        return "Helvetica", "Helvetica-Bold", "Times-Roman", "Times-Bold", "Courier"
    for name, key in (("HoldingsSans", "sans"), ("HoldingsSans-Bold", "sans_bold"),
                      ("HoldingsSerif", "serif"), ("HoldingsSerif-Bold", "serif_bold"),
                      ("HoldingsMono", "mono")):
        pdfmetrics.registerFont(TTFont(name, candidates[key]))
    pdfmetrics.registerFontFamily("HoldingsSans", normal="HoldingsSans", bold="HoldingsSans-Bold",
                                  italic="HoldingsSans", boldItalic="HoldingsSans-Bold")
    pdfmetrics.registerFontFamily("HoldingsSerif", normal="HoldingsSerif", bold="HoldingsSerif-Bold",
                                  italic="HoldingsSerif", boldItalic="HoldingsSerif-Bold")
    return "HoldingsSans", "HoldingsSans-Bold", "HoldingsSerif", "HoldingsSerif-Bold", "HoldingsMono"


def _code_text(code, width=92):
    wrapped = []
    for line in _safe_unicode(code).splitlines():
        wrapped.extend(textwrap.wrap(line, width=width, replace_whitespace=False, drop_whitespace=False,
                                     break_long_words=True, break_on_hyphens=False) or [""])
    return "\n".join(wrapped)


def to_pdf(title, md):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        ListFlowable, ListItem, Paragraph, Preformatted, SimpleDocTemplate, Spacer, Table, TableStyle,
    )
    sans, sans_bold, serif, serif_bold, mono = _register_pdf_fonts()
    styles = {
        "p": ParagraphStyle("holdings_p", fontName=serif, fontSize=10.5, leading=15, spaceAfter=7),
        "h1": ParagraphStyle("holdings_h1", fontName=serif_bold, fontSize=20, leading=25, spaceBefore=4, spaceAfter=10, keepWithNext=True),
        "h2": ParagraphStyle("holdings_h2", fontName=serif_bold, fontSize=15, leading=19, spaceBefore=13, spaceAfter=6, keepWithNext=True),
        "h3": ParagraphStyle("holdings_h3", fontName=serif_bold, fontSize=12, leading=16, spaceBefore=9, spaceAfter=4, keepWithNext=True),
        "small": ParagraphStyle("holdings_small", fontName=sans, fontSize=8.5, leading=11),
        "code": ParagraphStyle("holdings_code", fontName=mono, fontSize=7.6, leading=10, textColor=colors.HexColor("#20242B")),
        "quote": ParagraphStyle("holdings_quote", fontName=serif, fontSize=10, leading=14, leftIndent=8, rightIndent=8, textColor=colors.HexColor("#3D4652")),
    }
    story = []
    width = A4[0] - 40 * mm
    for block in parse(md, title):
        kind = block[0]
        if kind == "h":
            story.append(Paragraph(_rl(block[2]), styles[f"h{block[1]}"]))
        elif kind == "p":
            story.append(Paragraph(_rl(block[1]), styles["p"]))
        elif kind == "quote":
            q = Table([[Paragraph(_rl(block[1]), styles["quote"])]], colWidths=[width])
            q.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F2F4F6")),
                ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#D7DCE2")),
                ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]))
            story.extend([q, Spacer(1, 7)])
        elif kind == "code":
            code = Preformatted(_code_text(block[1]), styles["code"], maxLineLength=96)
            frame = Table([[code]], colWidths=[width], splitByRow=1, splitInRow=1)
            frame.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F1F3F5")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#D8DDE3")),
                ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]))
            story.extend([frame, Spacer(1, 8)])
        elif kind == "li":
            _, text, depth, marker = block
            ordered = bool(re.match(r"\d", marker))
            bullet = marker if ordered else "•"
            style = ParagraphStyle("li", parent=styles["p"], leftIndent=16 + depth * 12,
                                   firstLineIndent=-12, spaceAfter=3)
            story.append(Paragraph(_rl(text), style, bulletText=bullet))
        elif kind == "table":
            source_rows = block[1]
            n = max((len(row) for row in source_rows), default=0)
            if not n:
                continue
            lens = [max(8, min(48, max((len(plain(row[c])) for row in source_rows if c < len(row)), default=8)))
                    for c in range(n)]
            total = sum(lens)
            widths = [width * value / total for value in lens]
            rows = []
            for ri, row in enumerate(source_rows):
                cells = []
                for ci in range(n):
                    val = row[ci] if ci < len(row) else ""
                    if ri > 0 and val.strip().startswith("="):
                        val = "Calculated value"
                    cells.append(Paragraph(_rl(val).replace("\n", "<br/>"), styles["small"]))
                rows.append(cells)
            tbl = Table(rows, colWidths=widths, repeatRows=1, splitByRow=1, splitInRow=1, hAlign="LEFT")
            tbl.setStyle(TableStyle([
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#C8CDD3")),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E9EDF1")),
                ("FONTNAME", (0, 0), (-1, 0), sans_bold),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]))
            story.extend([tbl, Spacer(1, 8)])

    buf = io.BytesIO()

    def foot(canvas, doc):
        canvas.saveState()
        canvas.setFont(sans, 8)
        canvas.setFillColor(colors.HexColor("#626A75"))
        canvas.drawString(20 * mm, 10 * mm, "GTMN Holdings · Confidential")
        canvas.drawRightString(A4[0] - 20 * mm, 10 * mm, f"Page {doc.page}")
        canvas.restoreState()

    SimpleDocTemplate(buf, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm,
                      topMargin=18 * mm, bottomMargin=18 * mm, title=plain(title),
                      author="GTMN Holdings").build(story, onFirstPage=foot, onLaterPages=foot)
    return buf.getvalue()


def _set_run(run, bold=None, italic=None, code=False):
    from docx.shared import Pt
    run.font.name = "Courier New" if code else "Times New Roman"
    if bold is not None:
        run.bold = bold
    if italic is not None:
        run.italic = italic
    if code:
        run.font.size = Pt(9)
    return run


def _set_shading(element, fill):
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    props = element.get_or_add_pPr() if hasattr(element, "get_or_add_pPr") else element.get_or_add_tcPr()
    shade = OxmlElement("w:shd")
    shade.set(qn("w:fill"), fill)
    props.append(shade)


def to_docx(title, md):
    from docx import Document
    from docx.enum.text import WD_BREAK
    from docx.shared import Inches, Pt, RGBColor
    d = Document()
    d.core_properties.title, d.core_properties.author = plain(title), "GTMN Holdings"
    normal = d.styles["Normal"]
    normal.font.name, normal.font.size = "Times New Roman", Pt(11)
    normal.font.color.rgb = RGBColor(25, 28, 33)
    for style_name, size in (("Heading 1", 19), ("Heading 2", 15), ("Heading 3", 12)):
        style = d.styles[style_name]
        style.font.name, style.font.size, style.font.bold = "Times New Roman", Pt(size), True
        style.font.color.rgb = RGBColor(25, 28, 33)
    for block in parse(md, title):
        kind = block[0]
        if kind == "h":
            d.add_heading(plain(block[2]), block[1])
        elif kind in ("p", "li", "quote"):
            style = "List Bullet" if kind == "li" and not re.match(r"\d", block[3]) else None
            p = d.add_paragraph(style=style)
            if kind == "li":
                _, text, depth, marker = block
                p.paragraph_format.left_indent = Inches(0.25 + 0.2 * depth)
                if re.match(r"\d", marker):
                    p.add_run(marker + " ")
            else:
                text = block[1]
            if kind == "quote":
                p.paragraph_format.left_indent = Inches(0.25)
                for run in p.runs:
                    run.italic = True
            for value, fmt in _inline_parts(text):
                r = p.add_run(value)
                _set_run(r, bold=True if fmt == "bold" else None,
                         italic=True if fmt == "italic" or kind == "quote" else None,
                         code=fmt == "code")
        elif kind == "code":
            p = d.add_paragraph()
            p.paragraph_format.left_indent = Inches(0.12)
            p.paragraph_format.right_indent = Inches(0.12)
            _set_shading(p._p, "F1F3F5")
            for index, line in enumerate(_safe_unicode(block[1]).splitlines()):
                if index:
                    p.add_run().add_break(WD_BREAK.LINE)
                _set_run(p.add_run(line), code=True)
        elif kind == "table":
            source_rows = block[1]
            cols = max((len(row) for row in source_rows), default=0)
            if not cols:
                continue
            table = d.add_table(rows=len(source_rows), cols=cols)
            table.style = "Table Grid"
            table.autofit = True
            for ri, row in enumerate(source_rows):
                for ci in range(cols):
                    cell = table.cell(ri, ci)
                    cell.text = ""
                    for value, fmt in _inline_parts(row[ci] if ci < len(row) else ""):
                        r = cell.paragraphs[0].add_run(value)
                        _set_run(r, bold=(ri == 0 or fmt == "bold"), italic=fmt == "italic", code=fmt == "code")
                        r.font.size = Pt(9)
                    if ri == 0:
                        _set_shading(cell._tc, "E9EDF1")
            table.rows[0]._tr.get_or_add_trPr().append(
                __import__("docx").oxml.OxmlElement("w:tblHeader"))
            d.add_paragraph()
    section = d.sections[0]
    section.footer.paragraphs[0].text = "GTMN Holdings · Confidential"
    section.footer.paragraphs[0].runs[0].font.size = Pt(8)
    buf = io.BytesIO()
    d.save(buf)
    return buf.getvalue()


_NUM = re.compile(r"^([-+]?)\s*(US\$|R\$|\$|€)?\s*(\d[\d,]*(?:\.\d+)?)\s*(%|x|×)?$")


def _cell(value):
    """Excel formulas remain formulas; numeric cells become numeric values."""
    raw = str(value).strip().strip("`")
    if raw.startswith("=") and len(raw) > 1:
        return raw, None
    val = plain(value).strip()
    match = _NUM.match(val)
    if match:
        number = float(match[3].replace(",", ""))
        number = -number if match[1] == "-" else number
        if match[4] == "%":
            return number / 100, "0.0%"
        return (int(number) if number == int(number) else number), (
            "#,##0.00" if match[4] in ("x", "×") or "." in match[3] else "#,##0")
    return val, None


def to_xlsx(title, md):
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill
    wb = Workbook()
    ws = wb.active
    ws.title = "Summary"
    ws.append([plain(title)])
    ws["A1"].font = Font(bold=True, size=14)
    ws.append([])
    names, last, tables = {"summary"}, "", 0
    for block in parse(md, title):
        if block[0] == "table":
            tables += 1
            base = re.sub(r"[\[\]:*?/\\]", " ", plain(last))[:28].strip() or f"Table {tables}"
            name, k = base, 2
            while name.lower() in names:
                name = f"{base[:26]} {k}"
                k += 1
            names.add(name.lower())
            sheet = wb.create_sheet(name)
            for row in block[1]:
                sheet.append([_cell(value)[0] for value in row])
            for ri, row in enumerate(block[1], 1):
                for ci, value in enumerate(row, 1):
                    fmt = _cell(value)[1]
                    if ri > 1 and fmt:
                        sheet.cell(ri, ci).number_format = fmt
            for cell in sheet[1]:
                cell.font, cell.fill = Font(bold=True), PatternFill("solid", fgColor="E6E6E6")
            sheet.freeze_panes = "A2"
            for col in sheet.columns:
                sheet.column_dimensions[col[0].column_letter].width = min(
                    60, max(12, max(len(str(cell.value or "")) for cell in col) * 0.9))
                for cell in col:
                    cell.alignment = Alignment(wrap_text=True, vertical="top")
            ws.append([f"Sheet: {name}"])
        elif block[0] == "h":
            last = block[2]
            if block[1] <= 2:
                ws.append([plain(block[2])])
                ws.cell(ws.max_row, 1).font = Font(bold=True)
    ws.column_dimensions["A"].width = 90
    if not tables:
        ws.append(["No tables in this deliverable."])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def to_pptx(title, md):
    from pptx import Presentation
    from pptx.util import Inches, Pt
    pr = Presentation()
    slide = pr.slides.add_slide(pr.slide_layouts[0])
    slide.shapes.title.text = plain(title)
    slide.placeholders[1].text = "GTMN Holdings"
    current = None

    def new_slide(heading):
        nonlocal current
        current = pr.slides.add_slide(pr.slide_layouts[1])
        current.shapes.title.text = plain(heading)[:100]
        current.placeholders[1].text_frame.clear()
        return current

    for block in parse(md, title):
        if block[0] == "h":
            if block[1] <= 2:
                new_slide(block[2])
            continue
        if current is None:
            new_slide(title)
        if block[0] == "table":
            rows = block[1]
            columns = max((len(row) for row in rows), default=0)
            if rows and columns:
                shape = current.shapes.add_table(len(rows), columns, Inches(0.8), Inches(1.7),
                                                 Inches(8.4), Inches(4.7))
                table = shape.table
                for ri, row in enumerate(rows):
                    for ci in range(columns):
                        table.cell(ri, ci).text = plain(row[ci] if ci < len(row) else "")[:350]
                new_slide("Continued — " + title)
            continue
        if block[0] == "code":
            text = _safe_unicode(block[1])[:900]
        elif block[0] == "li":
            text = ("  " * block[2]) + (block[3] + " " if re.match(r"\d", block[3]) else "• ") + plain(block[1])
        elif block[0] == "quote":
            text = "“" + plain(block[1]) + "”"
        else:
            text = plain(block[1])
        tf = current.placeholders[1].text_frame
        paragraph = tf.paragraphs[0] if not tf.text else tf.add_paragraph()
        paragraph.text = text[:600]
        paragraph.font.size = Pt(12 if block[0] == "code" else 16)
        if block[0] == "code":
            paragraph.font.name = "Courier New"
    buf = io.BytesIO()
    pr.save(buf)
    return buf.getvalue()


def to_jpeg(title, md):
    from PIL import Image, ImageDraw, ImageFont
    im = Image.new("RGB", (1240, 1754), "white")
    draw = ImageDraw.Draw(im)

    def font(size):
        for path in ("/usr/share/fonts/truetype/liberation2/LiberationSerif-Regular.ttf",
                     "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf",
                     "/System/Library/Fonts/Supplemental/Times New Roman.ttf"):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                pass
        return ImageFont.load_default()

    y = 90
    draw.text((90, y), plain(title), fill="black", font=font(44))
    y += 80
    for block in parse(md, title):
        if y > 1650:
            break
        if block[0] == "h":
            value, size = plain(block[2]), (38 if block[1] == 1 else 30)
        elif block[0] == "li":
            value, size = (block[3] + " " if re.match(r"\d", block[3]) else "• ") + plain(block[1]), 24
        elif block[0] == "code":
            value, size = plain(block[1]), 18
        elif block[0] == "table":
            value, size = "\n".join("  |  ".join(plain(c) for c in row) for row in block[1]), 18
        else:
            value, size = plain(block[1]), 24
        for line in value.splitlines() or [""]:
            for wrapped in textwrap.wrap(line, width=85 if size < 30 else 52):
                draw.text((90, y), wrapped, fill="#222", font=font(size))
                y += size + 8
        y += 9
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=90)
    return buf.getvalue()


BUILD = {"PDF": to_pdf, "Word": to_docx, "Excel": to_xlsx, "PowerPoint": to_pptx, "JPEG": to_jpeg}
