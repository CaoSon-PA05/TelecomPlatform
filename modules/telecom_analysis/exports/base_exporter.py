"""Abstract base for all export formatters."""

from __future__ import annotations

from abc import ABC, abstractmethod
from io import BytesIO


class BaseExporter(ABC):

    @abstractmethod
    def export(self, data: list[dict], filename: str) -> BytesIO:
        """Convert a list of flat dicts to the target format. Returns BytesIO."""
        ...

    @abstractmethod
    def get_content_type(self) -> str:
        """HTTP Content-Type for this format, e.g. 'application/vnd.openxmlformats-...'"""
        ...

    @abstractmethod
    def get_file_extension(self) -> str:
        """File extension without dot, e.g. 'xlsx'."""
        ...
