from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import DateTime, Enum, Float, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..base import Base
from .enums import Carrier

if TYPE_CHECKING:
    from .cdr_record import CDRRecord
    from .stats import TowerFrequencyStat


class CellTower(Base):
    __tablename__ = "cell_towers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Natural composite key — uniquely identifies a BTS tower
    lac: Mapped[int] = mapped_column(Integer, nullable=False)
    cell_id: Mapped[int] = mapped_column(Integer, nullable=False)

    carrier: Mapped[Optional[Carrier]] = mapped_column(Enum(Carrier), nullable=True)

    # Province — stored raw (TNH / T066) AND normalized (Tay Ninh)
    # Real data has same province under multiple codes; normalize at import time.
    province_code_raw: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    province_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Physical location
    bts_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Investigator annotation
    google_maps_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=func.now(), onupdate=func.now()
    )

    # Relationships
    cdr_records: Mapped[List[CDRRecord]] = relationship("CDRRecord", back_populates="tower")
    frequency_stats: Mapped[List[TowerFrequencyStat]] = relationship(
        "TowerFrequencyStat", back_populates="tower", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("lac", "cell_id", name="uq_cell_towers_lac_cell_id"),
        Index("ix_cell_towers_lac_cell_id", "lac", "cell_id"),
        Index("ix_cell_towers_province_name", "province_name"),
        Index("ix_cell_towers_lat_lon", "latitude", "longitude"),
    )

    def __repr__(self) -> str:
        return f"<CellTower LAC={self.lac} CID={self.cell_id} [{self.province_name}]>"
