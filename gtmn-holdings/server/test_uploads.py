import json
import unittest
from io import BytesIO

import uploads


class UploadTests(unittest.TestCase):
    def test_parse_multipart_and_prepare_text_file(self):
        boundary = "test-boundary"
        body = (
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"metadata\"\r\n\r\n"
            + json.dumps({"title": "Review this document"})
            + f"\r\n--{boundary}\r\nContent-Disposition: form-data; name=\"files\"; filename=\"brief.md\"\r\n"
            + "Content-Type: text/markdown\r\n\r\n"
            + "Business case and assumptions."
            + f"\r\n--{boundary}--\r\n"
        ).encode()
        metadata, raw_files = uploads.parse_multipart(
            "multipart/form-data; boundary=" + boundary, body)

        self.assertEqual(json.loads(metadata)["title"], "Review this document")
        prepared = uploads.prepare_files(raw_files)
        self.assertEqual(prepared[0]["name"], "brief.md")
        self.assertEqual(prepared[0]["text"], "Business case and assumptions.")

    def test_sanitizes_path_and_rejects_unsupported_file(self):
        prepared = uploads.prepare_files([("../brief.txt", b"Useful notes")])
        self.assertEqual(prepared[0]["name"], "brief.txt")
        with self.assertRaisesRegex(ValueError, "not a supported document"):
            uploads.prepare_files([("image.png", b"not an image")])

    def test_enforces_upload_limits(self):
        with self.assertRaisesRegex(ValueError, "no more than 8"):
            uploads.prepare_files([("note.txt", b"x")] * 9)
        with self.assertRaisesRegex(ValueError, "10 MB or less"):
            uploads.prepare_files([("note.txt", b"x" * (uploads.MAX_TOTAL_BYTES + 1))])

    def test_extracts_supported_document_formats(self):
        from docx import Document
        from openpyxl import Workbook
        from pptx import Presentation
        from pptx.util import Inches
        from reportlab.pdfgen import canvas

        pdf = BytesIO()
        page = canvas.Canvas(pdf)
        page.drawString(72, 720, "PDF reference text")
        page.save()

        docx = BytesIO()
        word = Document()
        word.add_paragraph("Word reference text")
        word.save(docx)

        xlsx = BytesIO()
        workbook = Workbook()
        workbook.active.append(["Excel reference text"])
        workbook.save(xlsx)

        pptx = BytesIO()
        presentation = Presentation()
        slide = presentation.slides.add_slide(presentation.slide_layouts[6])
        box = slide.shapes.add_textbox(Inches(1), Inches(1), Inches(4), Inches(1))
        box.text = "PowerPoint reference text"
        presentation.save(pptx)

        samples = [
            ("brief.pdf", pdf.getvalue(), "PDF reference text"),
            ("brief.docx", docx.getvalue(), "Word reference text"),
            ("brief.xlsx", xlsx.getvalue(), "Excel reference text"),
            ("brief.pptx", pptx.getvalue(), "PowerPoint reference text"),
        ]
        for name, data, expected in samples:
            with self.subTest(name=name):
                self.assertIn(expected, uploads.prepare_files([(name, data)])[0]["text"])


if __name__ == "__main__":
    unittest.main()
