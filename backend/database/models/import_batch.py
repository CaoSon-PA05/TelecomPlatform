from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..base import Base
from .enums import Carrier, ImportStatus

if TYPE_CHECKING:
    from .cdr_record import CDRRecord
    from .subscriber import Subscriber


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    subscriber_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("subscribers.id"), nullable=False
    )

    # Source file metadata
    source_file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    document_ref: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Reporting period from the Excel header
    report_period_from: Mapped[Optional[date]] = mapped_column(nullable=True)
    report_period_to: Mapped[Optional[date]] = mapped_column(nullable=True)

    # Detection results
    template_detected: Mapped[Optional[Carrier]] = mapped_column(
        Enum(Carrier), nullable=True
    )
    total_records: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Import state
    import_status: Mapped[ImportStatus] = mapped_column(
        Enum(ImportStatus), nullable=False, default=ImportStatus.PENDING
    )
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    imported_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=func.now()
    )

    # Relationships
    subscriber: Mapped[Subscriber] = relationship("Subscriber", back_populates="import_batches")
    cdr_records: Mapped[List[CDRRecord]] = relationship(
        "CDRRecord", back_populates="batch", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_import_batches_subscriber_id", "subscriber_id"),
        Index("ix_import_batches_document_ref", "document_ref"),
        Index("ix_import_batches_imported_at", "imported_at"),
    )

    def __repr__(self) -> str:
        return f"<ImportBatch {self.source_file_name} [{self.import_status}]>"
