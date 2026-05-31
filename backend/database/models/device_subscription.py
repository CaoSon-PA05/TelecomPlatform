from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, Integer, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..base import Base

if TYPE_CHECKING:
    from .device import Device
    from .subscriber import Subscriber


class DeviceSubscription(Base):
    """
    Junction table tracking which subscriber used which device and when.

    A new row is created the first time a subscriber's CDR references an IMEI.
    `first_seen_at` / `last_seen_at` form the device usage window.

    Multiple rows for the same subscriber → device swap events (forensic timeline).
    Multiple rows for the same device → device shared across subscribers.
    """

    __tablename__ = "device_subscriptions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    subscriber_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("subscribers.id"), nullable=False
    )
    device_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("devices.id"), nullable=False
    )

    first_seen_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    interaction_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=func.now(), onupdate=func.now()
    )

    # Relationships
    subscriber: Mapped[Subscriber] = relationship(
        "Subscriber", back_populates="device_subscriptions"
    )
    device: Mapped[Device] = relationship("Device", back_populates="subscriptions")

    __table_args__ = (
        UniqueConstraint(
            "subscriber_id", "device_id", name="uq_device_subscriptions_sub_device"
        ),
        # Shared-device cross-subscriber query: find all subscribers who used a given device
        Index("ix_device_subscriptions_device_id", "device_id"),
    )

    def __repr__(self) -> str:
        return (
            f"<DeviceSubscription sub={self.subscriber_id} "
            f"device={self.device_id} [{self.first_seen_at}→{self.last_seen_at}]>"
        )
