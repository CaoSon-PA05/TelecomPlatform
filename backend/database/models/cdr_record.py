from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..base import Base
from .enums import CommType, Direction, ServiceCategory

if TYPE_CHECKING:
    from .cell_tower import CellTower
    from .device import Device
    from .import_batch import ImportBatch
    from .subscriber import Subscriber


class CDRRecord(Base):
    """
    Immutable fact table — one row per CDR event from the Excel files.
    Never updated after import; corrections are re-imported with a new batch_id.
    """

    __tablename__ = "cdr_records"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Provenance
    subscriber_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("subscribers.id"), nullable=False
    )
    batch_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("import_batches.id"), nullable=False
    )
    source_file_row: Mapped[int] = mapped_column(Integer, nullable=False)

    # Raw numbers exactly as stored in Excel
    source_number_raw: Mapped[str] = mapped_column(String(100), nullable=False)
    target_number_raw: Mapped[str] = mapped_column(String(100), nullable=False)

    # Resolved / normalized fields
    owner_phone: Mapped[str] = mapped_column(String(15), nullable=False)
    contact_number: Mapped[Optional[str]] = mapped_column(String(15), nullable=True)
    direction: Mapped[Direction] = mapped_column(Enum(Direction), nullable=False)

    # Timing
    recorded_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Communication classification
    comm_type: Mapped[CommType] = mapped_column(Enum(CommType), nullable=False)
    service_direction_raw: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    service_category: Mapped[Optional[ServiceCategory]] = mapped_column(
        Enum(ServiceCategory), nullable=True
    )

    # Device — nullable because service SMS senders have no IMEI context
    device_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("devices.id"), nullable=True
    )

    # Location — both nullable; LAC and Cell are always null/present together
    province_code_raw: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    tower_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("cell_towers.id"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=func.now())

    # Relationships
    subscriber: Mapped[Subscriber] = relationship("Subscriber", back_populates="cdr_records")
    batch: Mapped[ImportBatch] = relationship("ImportBatch", back_populates="cdr_records")
    device: Mapped[Optional[Device]] = relationship("Device", back_populates="cdr_records")
    tower: Mapped[Optional[CellTower]] = relationship("CellTower", back_populates="cdr_records")

    __table_args__ = (
        # Primary analytics access pattern: subscriber timeline
        Index("ix_cdr_subscriber_time", "subscriber_id", "recorded_at"),
        # Contact frequency queries
        Index("ix_cdr_contact_number", "contact_number"),
        # Location analysis
        Index("ix_cdr_tower_id", "tower_id"),
        # Device analysis
        Index("ix_cdr_device_id", "device_id"),
        # Voice vs SMS breakdown
        Index("ix_cdr_subscriber_comm_type", "subscriber_id", "comm_type"),
        # Outgoing vs incoming breakdown
        Index("ix_cdr_subscriber_direction", "subscriber_id", "direction"),
        # Global time queries
        Index("ix_cdr_recorded_at", "recorded_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<CDRRecord {self.comm_type} {self.direction} "
            f"{self.owner_phone}→{self.contact_number} @{self.recorded_at}>"
        )
