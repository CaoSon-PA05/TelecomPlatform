from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, DateTime, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..base import Base

if TYPE_CHECKING:
    from .cdr_record import CDRRecord
    from .device_subscription import DeviceSubscription


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    imei: Mapped[str] = mapped_column(String(15), unique=True, nullable=False)
    is_valid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Populated after imei.info lookup
    device_model: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    manufacturer: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    lookup_completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    lookup_source: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=func.now(), onupdate=func.now()
    )

    # Relationships
    cdr_records: Mapped[List[CDRRecord]] = relationship("CDRRecord", back_populates="device")
    subscriptions: Mapped[List[DeviceSubscription]] = relationship(
        "DeviceSubscription", back_populates="device", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_devices_manufacturer", "manufacturer"),
    )

    def __repr__(self) -> str:
        model_str = f" {self.device_model}" if self.device_model else ""
        return f"<Device IMEI={self.imei}{model_str}>"
