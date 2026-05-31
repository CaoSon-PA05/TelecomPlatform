"""ZIP exporter for batch exports of multiple subscribers."""

from __future__ import annotations

from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile

from .excel_exporter import ExcelExporter


class ZipExporter:

    def __init__(self) -> None:
        self._excel = ExcelExporter()

    def bundle_workbooks(
        self, workbooks: dict[str, BytesIO]
    ) -> BytesIO:
        """
        Pack multiple Excel BytesIO objects into a single ZIP.
        `workbooks` maps filename (e.g. '0969619929_export_all.xlsx') → BytesIO.
        Returns in-memory ZIP BytesIO.
        """
        zip_buf = BytesIO()
        with ZipFile(zip_buf, mode="w", compression=ZIP_DEFLATED) as zf:
            for filename, workbook_buf in workbooks.items():
                workbook_buf.seek(0)
                zf.writestr(filename, workbook_buf.read())
        zip_buf.seek(0)
        return zip_buf

    def get_content_type(self) -> str:
        return "application/zip"

    def get_file_extension(self) -> str:
        return "zip"
