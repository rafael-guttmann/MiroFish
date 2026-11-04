"""Turns a markdown deliverable into real files: PDF, Word, Excel, PowerPoint, JPEG."""
import io
import re

MIME = {
    "PDF": ("application/pdf", "pdf"),
    "Word": ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"),
    "Excel": ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"),
    "PowerPoint": ("application/vnd.openxmlformats-officedocument.presentationml.presentation", "pptx"),
    "JPEG": ("image/jpeg", "jpg"),
}


def parse(md):
    """Blocks: ('h',level,text) ('p',text) ('li',text) ('table',rows)."""
    out, lines, i = [], md.splitlines(), 0
    while i < len(lines):
        ln = lines[i].rstrip()
        if not ln.strip() or re.fullmatch(r"-{3,}", ln.strip()):
            i += 1
        elif ln.startswith("#"):
            m = re.match(r"(#+)\s*(.*)", ln)
            out.append(("h", min(len(m[1]), 3), m[2].strip()))
            i += 1
        elif ln.lstrip().startswith("|"):
            rows = []
            while i < len(lines) and lines[i].lstrip().startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-{2,}:?", c) for c in cells if c):
                    rows.append(cells)
                i += 1
            out.append(("table", rows))
        elif re.match(r"\s*([-*]|\d+\.)\s+", ln):
            out.append(("li", re.sub(r"^\s*([-*]|\d+\.)\s+", "", ln)))
            i += 1
        else:
            para = [ln.strip()]
            i += 1
            while i < len(lines) and lines[i].strip() and not re.match(r"\s*(#|\||[-*]\s|\d+\.\s)", lines[i]):
                para.append(lines[i].strip())
                i += 1
            out.append(("p", " ".join(para)))
    return out


def plain(t):
    return re.sub(r"[*_`]+", "", t)


def _runs(t):
    return [(p[2:-2], True) if p.startswith("**") and p.endswith("**") and len(p) > 4 else (p.replace("*", ""), False)
            for p in re.split(r"(\*\*[^*]+\*\*)", t) if p]


def _rl(t):
    from xml.sax.saxutils import escape
    return re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", escape(t)).replace("*", "")


def to_pdf(title, md):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import ListFlowable, ListItem, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    st = {
        "p": ParagraphStyle("p", fontName="Times-Roman", fontSize=10.5, leading=14.5, spaceAfter=6),
        "h1": ParagraphStyle("h1", fontName="Times-Bold", fontSize=18, leading=22, spaceBefore=4, spaceAfter=8),
        "h2": ParagraphStyle("h2", fontName="Times-Bold", fontSize=13.5, leading=17, spaceBefore=12, spaceAfter=5),
        "h3": ParagraphStyle("h3", fontName="Times-BoldItalic", fontSize=11.5, leading=15, spaceBefore=8, spaceAfter=3),
        "c": ParagraphStyle("c", fontName="Helvetica", fontSize=8.5, leading=11),
    }
    buf, story = io.BytesIO(), []
    for b in parse(md):
        if b[0] == "h":
            story.append(Paragraph(_rl(b[2]), st[f"h{b[1]}"]))
        elif b[0] == "p":
            story.append(Paragraph(_rl(b[1]), st["p"]))
        elif b[0] == "li":
            story.append(ListFlowable([ListItem(Paragraph(_rl(b[1]), st["p"]))], bulletType="bullet", leftIndent=14))
        else:
            rows = [[Paragraph(_rl(c), st["c"]) for c in r] for r in b[1]]
            n = max(len(r) for r in rows)
            rows = [r + [""] * (n - len(r)) for r in rows]
            t = Table(rows, colWidths=[(A4[0] - 40 * mm) / n] * n, repeatRows=1)
            t.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.4, colors.black), ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e6e6e6")),
                                   ("VALIGN", (0, 0), (-1, -1), "TOP")]))
            story += [t, Spacer(1, 8)]

    def foot(c, d):
        c.setFont("Helvetica", 8)
        c.drawString(20 * mm, 10 * mm, "GTMN Holdings")
        c.drawRightString(A4[0] - 20 * mm, 10 * mm, f"Page {d.page}")
    SimpleDocTemplate(buf, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=18 * mm, bottomMargin=18 * mm, title=title, author="GTMN Holdings").build(story, onFirstPage=foot, onLaterPages=foot)
    return buf.getvalue()


def to_docx(title, md):
    import docx
    from docx.shared import Pt
    d = docx.Document()
    d.core_properties.title, d.core_properties.author = title, "GTMN Holdings"
    d.styles["Normal"].font.name, d.styles["Normal"].font.size = "Times New Roman", Pt(11)
    for b in parse(md):
        if b[0] == "h":
            d.add_heading(plain(b[2]), b[1] - 1 if b[1] > 1 else 0)
        elif b[0] in ("p", "li"):
            p = d.add_paragraph(style="List Bullet" if b[0] == "li" else None)
            for txt, bold in _runs(b[1]):
                p.add_run(txt).bold = bold
        else:
            n = max(len(r) for r in b[1])
            t = d.add_table(rows=len(b[1]), cols=n, style="Table Grid")
            for ri, r in enumerate(b[1]):
                for ci in range(n):
                    c = t.cell(ri, ci)
                    c.text = plain(r[ci]) if ci < len(r) else ""
                    for run in c.paragraphs[0].runs:
                        run.font.size, run.bold = Pt(9), ri == 0
            d.add_paragraph()
    buf = io.BytesIO()
    d.save(buf)
    return buf.getvalue()


def to_xlsx(title, md):
    import openpyxl
    from openpyxl.styles import Alignment, Font, PatternFill
    wb = openpyxl.Workbook()
    ws, k = wb.active, 0
    ws.title = "Summary"
    ws.append([title])
    ws["A1"].font = Font(bold=True, size=14)
    ws.append([])
    sheets = []
    for b in parse(md):
        if b[0] == "table":
            k += 1
            s = wb.create_sheet(f"Table {k}")
            for r in b[1]:
                s.append([plain(c) for c in r])
            for c in s[1]:
                c.font, c.fill = Font(bold=True), PatternFill("solid", fgColor="E6E6E6")
            for col in s.columns:
                s.column_dimensions[col[0].column_letter].width = min(60, max(12, max(len(str(c.value or "")) for c in col) * 0.9))
                for c in col:
                    c.alignment = Alignment(wrap_text=True, vertical="top")
            sheets.append(s)
        elif b[0] == "h" and b[1] <= 2:
            ws.append([plain(b[2])])
            ws.cell(ws.max_row, 1).font = Font(bold=True)
    ws.column_dimensions["A"].width = 90
    if not sheets:
        ws.append(["No tables in this deliverable."])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def to_pptx(title, md):
    from pptx import Presentation
    from pptx.util import Pt
    pr = Presentation()
    s = pr.slides.add_slide(pr.slide_layouts[0])
    s.shapes.title.text, s.placeholders[1].text = title, "GTMN Holdings"
    cur = None
    for b in parse(md):
        if b[0] == "h" and b[1] <= 2:
            cur = pr.slides.add_slide(pr.slide_layouts[1])
            cur.shapes.title.text = plain(b[2])[:90]
            cur.placeholders[1].text_frame.clear()
            cur.first = True
        elif cur is not None and b[0] in ("p", "li"):
            tf = cur.placeholders[1].text_frame
            p = tf.paragraphs[0] if getattr(cur, "first", False) else tf.add_paragraph()
            cur.first = False
            p.text = plain(b[1])[:260]
            p.font.size = Pt(16 if len(tf.paragraphs) < 5 else 13)
    buf = io.BytesIO()
    pr.save(buf)
    return buf.getvalue()


def to_jpeg(title, md):
    from PIL import Image, ImageDraw, ImageFont
    import textwrap
    im = Image.new("RGB", (1240, 1754), "white")
    d = ImageDraw.Draw(im)

    def font(sz):
        for f in ("/System/Library/Fonts/Supplemental/Times New Roman.ttf", "/System/Library/Fonts/Times.ttc"):
            try:
                return ImageFont.truetype(f, sz)
            except Exception:
                pass
        return ImageFont.load_default()
    y = 90
    for b in parse(md):
        if y > 1650:
            break
        if b[0] == "h":
            f, w = font(44 if b[1] == 1 else 34), 48
            for ln in textwrap.wrap(plain(b[2]), w):
                d.text((90, y), ln, fill="black", font=f)
                y += 50
            y += 10
        elif b[0] in ("p", "li"):
            for ln in textwrap.wrap(("• " if b[0] == "li" else "") + plain(b[1]), 86):
                d.text((90, y), ln, fill="#222", font=font(26))
                y += 34
            y += 10
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=88)
    return buf.getvalue()


BUILD = {"PDF": to_pdf, "Word": to_docx, "Excel": to_xlsx, "PowerPoint": to_pptx, "JPEG": to_jpeg}
