"""Read-only PDF text extraction: no JavaScript, actions, rendering or OCR."""
import io
import json
import sys
from pypdf import PdfReader

data = sys.stdin.buffer.read(6 * 1024 * 1024 + 1)
if len(data) > 6 * 1024 * 1024:
    raise ValueError("PDF size limit")
reader = PdfReader(io.BytesIO(data), strict=True)
if reader.is_encrypted:
    raise ValueError("Encrypted PDF requires an authorised readable copy")
if len(reader.pages) > 300:
    raise ValueError("PDF page limit (300)")
sections = []
empty_pages = []
total = 0
for number, page in enumerate(reader.pages, 1):
    text = (page.extract_text() or "").strip()
    total += len(text)
    if total > 1500000:
        raise ValueError("PDF text limit")
    if text:
        sections.append({"page": number, "section": "Page " + str(number), "body": text})
    else:
        empty_pages.append(number)
if not sections:
    raise ValueError("No extractable text; image-only PDF needs OCR or an accessible copy")
print(json.dumps({"sections": sections, "pages": len(reader.pages), "emptyPages": empty_pages}, ensure_ascii=True))

