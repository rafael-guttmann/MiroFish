import io
import unittest

import render


class RenderTests(unittest.TestCase):
    MARKDOWN = """# Quarterly Review

## Executive view

The **portfolio** is *stable*; see [source](https://example.com/report).

- First point
- Second point

| Metric | Value |
|---|---:|
| Exposure | 125 |

> Evidence remains limited.

```text
SELECT 1
```
"""

    def test_parser_handles_common_markdown_blocks(self):
        blocks = render.parse(self.MARKDOWN, "Quarterly Review")
        kinds = [block[0] for block in blocks]
        self.assertEqual(kinds, ["h", "p", "li", "li", "table", "quote", "code"])
        self.assertNotIn(("h", 1, "Quarterly Review"), blocks)

    def test_supported_renderers_create_readable_files(self):
        from docx import Document
        from openpyxl import load_workbook
        from PIL import Image
        from pptx import Presentation
        from pypdf import PdfReader

        pdf = render.to_pdf("Quarterly Review", self.MARKDOWN)
        pdf_text = "\n".join(page.extract_text() or "" for page in PdfReader(io.BytesIO(pdf)).pages)
        self.assertIn("portfolio", pdf_text)
        self.assertIn("125", pdf_text)

        docx = Document(io.BytesIO(render.to_docx("Quarterly Review", self.MARKDOWN)))
        self.assertIn("Executive view", "\n".join(p.text for p in docx.paragraphs))
        self.assertEqual(docx.tables[0].cell(1, 1).text, "125")

        workbook = load_workbook(io.BytesIO(render.to_xlsx("Quarterly Review", self.MARKDOWN)))
        self.assertEqual(workbook["Executive view"].cell(2, 2).value, 125)

        presentation = Presentation(io.BytesIO(render.to_pptx("Quarterly Review", self.MARKDOWN)))
        self.assertGreaterEqual(len(presentation.slides), 2)

        image = Image.open(io.BytesIO(render.to_jpeg("Quarterly Review", self.MARKDOWN)))
        self.assertEqual(image.format, "JPEG")
        self.assertEqual(image.size, (1240, 1754))


if __name__ == "__main__":
    unittest.main()
