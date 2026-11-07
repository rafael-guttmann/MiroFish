"""Validation and text extraction for documents attached to a demand."""
from email.parser import BytesParser
from email.policy import default
from io import BytesIO
from pathlib import PurePosixPath
import re
import zipfile


MAX_FILES = 8
MAX_FILE_BYTES = 5 * 1024 * 1024
MAX_TOTAL_BYTES = 10 * 1024 * 1024
MAX_FILE_TEXT = 12000
ALLOWED = {".pdf", ".docx", ".xlsx", ".pptx", ".txt", ".md", ".csv"}
MIMES = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".csv": "text/csv",
}


def parse_multipart(content_type, body):
    if "\r" in content_type or "\n" in content_type:
        raise ValueError("Invalid upload request.")
    message = BytesParser(policy=default).parsebytes(
        b"MIME-Version: 1.0\r\nContent-Type: "
        + content_type.encode("latin-1")
        + b"\r\n\r\n"
        + body
    )
    if message.get_content_type() != "multipart/form-data" or not message.is_multipart():
        raise ValueError("Expected a multipart form upload.")
    fields, files = {}, []
    for part in message.iter_parts():
        if part.get_content_disposition() != "form-data":
            continue
        name = part.get_param("name", header="content-disposition")
        filename = part.get_filename()
        payload = part.get_payload(decode=True) or b""
        if filename is not None:
            files.append((filename, payload))
        elif name:
            fields[name] = payload.decode("utf-8")
    if "metadata" not in fields:
        raise ValueError("Demand details are missing.")
    return fields["metadata"], files


def _safe_name(filename):
    name = PurePosixPath(str(filename).replace("\\", "/")).name.strip()
    if not name or name in (".", "..") or "\x00" in name:
        raise ValueError("One of the selected files has an invalid name.")
    if any(ord(char) < 32 or ord(char) == 127 for char in name):
        raise ValueError("File names cannot contain control characters.")
    if len(name) > 180:
        raise ValueError("File names must be 180 characters or fewer.")
    return name


def _check_zip(data, extension):
    try:
        with zipfile.ZipFile(BytesIO(data)) as archive:
            entries = archive.infolist()
            if len(entries) > 5000 or sum(item.file_size for item in entries) > 50 * 1024 * 1024:
                raise ValueError("Office document expands beyond the supported size.")
            required = {
                ".docx": "word/document.xml",
                ".xlsx": "xl/workbook.xml",
                ".pptx": "ppt/presentation.xml",
            }[extension]
            if required not in archive.namelist():
                raise ValueError("The file is not a valid Office document.")
    except zipfile.BadZipFile as exc:
        raise ValueError("The Office document is damaged or invalid.") from exc


def _extract(extension, data):
    if extension in (".txt", ".md", ".csv"):
        try:
            text = data.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise ValueError("Text, Markdown and CSV files must use UTF-8 encoding.") from exc
        if "\x00" in text:
            raise ValueError("The selected text file contains binary data.")
        return text

    if extension == ".pdf":
        if not data.startswith(b"%PDF-"):
            raise ValueError("The selected file is not a valid PDF.")
        try:
            from pypdf import PdfReader
            reader = PdfReader(BytesIO(data))
            if reader.is_encrypted:
                raise ValueError("Password-protected PDFs cannot be read. Upload an unlocked copy.")
            if len(reader.pages) > 100:
                raise ValueError("PDFs are limited to 100 pages.")
            return "\n\n".join(page.extract_text() or "" for page in reader.pages)
        except ValueError:
            raise
        except Exception as exc:
            raise ValueError("The PDF could not be read. Try exporting it again.") from exc

    _check_zip(data, extension)
    try:
        if extension == ".docx":
            from docx import Document
            doc = Document(BytesIO(data))
            parts = [p.text for p in doc.paragraphs]
            parts.extend(" | ".join(cell.text for cell in row.cells) for table in doc.tables for row in table.rows)
            return "\n".join(parts)
        if extension == ".xlsx":
            from openpyxl import load_workbook
            workbook = load_workbook(BytesIO(data), read_only=True, data_only=True)
            parts = []
            for sheet in workbook.worksheets:
                parts.append("Sheet: " + sheet.title)
                for row in sheet.iter_rows(max_row=300, max_col=50, values_only=True):
                    values = [str(value) for value in row if value is not None]
                    if values:
                        parts.append(" | ".join(values))
            workbook.close()
            return "\n".join(parts)
        if extension == ".pptx":
            from pptx import Presentation
            presentation = Presentation(BytesIO(data))
            if len(presentation.slides) > 100:
                raise ValueError("PowerPoint files are limited to 100 slides.")
            parts = []
            for index, slide in enumerate(presentation.slides, 1):
                parts.append("Slide " + str(index))
                for shape in slide.shapes:
                    if getattr(shape, "has_text_frame", False) and shape.text.strip():
                        parts.append(shape.text)
                    if getattr(shape, "has_table", False):
                        parts.extend(" | ".join(cell.text for cell in row.cells) for row in shape.table.rows)
            return "\n".join(parts)
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError("The Office document could not be read. Try exporting it again.") from exc
    raise ValueError("This file type is not supported.")


def prepare_files(files):
    if len(files) > MAX_FILES:
        raise ValueError("Attach no more than 8 documents to one demand.")
    total = sum(len(data) for _, data in files)
    if total > MAX_TOTAL_BYTES:
        raise ValueError("Documents must total 10 MB or less.")
    prepared = []
    for filename, data in files:
        name = _safe_name(filename)
        extension = PurePosixPath(name).suffix.lower()
        if extension not in ALLOWED:
            raise ValueError(name + " is not a supported document. Use PDF, DOCX, XLSX, PPTX, TXT, MD or CSV.")
        if not data:
            raise ValueError(name + " is empty.")
        if len(data) > MAX_FILE_BYTES:
            raise ValueError(name + " is over the 5 MB per-file limit.")
        text = _extract(extension, data)
        text = re.sub(r"\x00", "", text).strip()
        if not text:
            raise ValueError(name + " has no readable text.")
        prepared.append({
            "name": name,
            "mime": MIMES[extension],
            "data": data,
            "text": text[:MAX_FILE_TEXT],
        })
    return prepared
