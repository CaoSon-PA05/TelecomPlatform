"""
File validator — runs before anything is written to disk.

Validation pipeline (in order):
  1. Extension check           .xlsx / .xls only
  2. Magic bytes check         prevent files renamed to .xlsx
  3. Size check                stream-counted; never loads whole file into memory
  4. Excel structure check     openpyxl can open it without crashing

All checks are async-safe.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path

from fastapi import UploadFile

from backend.app.core.config import settings

log = logging.getLogger("telecom.upload.validator")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

ALLOWED_EXTENSIONS: frozenset[str] = frozenset({".xlsx", ".xls"})

# Magic bytes (file signatures)
_XLSX_MAGIC = b"PK\x03\x04"           # XLSX is a ZIP archive
_XLS_MAGIC  = b"\xd0\xcf\x11\xe0"    # XLS is an OLE2 Compound Document

_CHUNK_SIZE = 65_536   # 64 KB — same as storage chunk size


# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------

@dataclass
class ValidationResult:
    valid: bool = True
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    file_size_bytes: int = 0
    extension: str = ""

    def add_error(self, msg: str) -> None:
        self.errors.append(msg)
        self.valid = False

    def add_warning(self, msg: str) -> None:
        self.warnings.append(msg)

    @property
    def file_size_kb(self) -> float:
        return round(self.file_size_bytes / 1024, 1)


# ---------------------------------------------------------------------------
# Main validation entry point
# ---------------------------------------------------------------------------

async def validate_upload_file(file: UploadFile) -> ValidationResult:
    """
    Full async validation of an UploadFile.
    Resets the file cursor to 0 before returning — safe to read again afterward.

    Returns ValidationResult; never raises (errors captured in result.errors).
    """
    result = ValidationResult()

    # 1. Extension ----------------------------------------------------------------
    ext = Path(file.filename or "").suffix.lower()
    result.extension = ext

    if ext not in ALLOWED_EXTENSIONS:
        result.add_error(
            f"Extension '{ext}' is not allowed. "
            f"Accepted: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )
        return result  # stop early — no point reading the file

    # 2. Magic bytes + size check --------------------------------------------------
    header_bytes = await file.read(8)

    if not _check_magic(header_bytes, ext):
        result.add_error(
            "File does not appear to be a valid Excel file "
            f"(magic bytes mismatch for {ext})."
        )
        await file.seek(0)
        return result

    # Stream-count total size (header already read above)
    total_size = len(header_bytes)
    max_bytes   = settings.max_upload_bytes

    while True:
        chunk = await file.read(_CHUNK_SIZE)
        if not chunk:
            break
        total_size += len(chunk)
        if total_size > max_bytes:
            result.add_error(
                f"File exceeds the maximum allowed size of "
                f"{settings.MAX_UPLOAD_SIZE_MB} MB."
            )
            await file.seek(0)
            return result

    result.file_size_bytes = total_size

    # 3. Content-type advisory warning (not an error — browsers are inconsistent) --
    ct = file.content_type or ""
    if ct and ct not in _ALLOWED_CONTENT_TYPES and ct != "application/octet-stream":
        result.add_warning(
            f"Unexpected Content-Type '{ct}'. "
            "File will be validated by its bytes, not the MIME type."
        )

    # Reset cursor so the caller can read from the beginning
    await file.seek(0)

    log.debug(
        "Validated '%s' — size=%d bytes ext=%s valid=%s",
        file.filename, result.file_size_bytes, ext, result.valid,
    )
    return result


# ---------------------------------------------------------------------------
# Excel structural validation (runs after saving — takes a Path, not UploadFile)
# ---------------------------------------------------------------------------

def validate_excel_structure(path: Path) -> ValidationResult:
    """
    Validate a saved Excel file using openpyxl in read-only mode.
    Called after the file is on disk so we don't need async I/O.
    Returns a new ValidationResult scoped to structural issues.
    """
    result = ValidationResult(extension=path.suffix.lower())

    try:
        import openpyxl
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        sheet_names = wb.sheetnames

        if not sheet_names:
            result.add_error("Workbook has no sheets.")
            wb.close()
            return result

        # Check at least one sheet has data rows
        has_data = False
        for name in sheet_names:
            ws = wb[name]
            if ws.max_row and ws.max_row > 1:
                has_data = True
                break

        if not has_data:
            result.add_warning("All sheets appear to be empty (0 or 1 rows).")

        wb.close()

    except Exception as exc:
        result.add_error(f"Cannot open file as Excel: {exc}")

    return result


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _check_magic(header: bytes, ext: str) -> bool:
    """Return True when the file header matches what we expect for ext."""
    if ext == ".xlsx":
        return header[:4] == _XLSX_MAGIC
    if ext == ".xls":
        return header[:4] == _XLS_MAGIC
    return False


# Content-types browsers typically send for Excel files
_ALLOWED_CONTENT_TYPES: frozenset[str] = frozenset({
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/msexcel",
    "application/x-msexcel",
    "application/x-ms-excel",
    "application/octet-stream",
})
