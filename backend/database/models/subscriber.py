from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import DateTime, Enum, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..base import Base
from .enums import AccountStatus, Carrier, SubscriptionType

if TYPE_CHECKING:
    from .contact_profile import ContactProfile
    from .cdr_record import CDRRecord
    from .device_subscription import DeviceSubscription
    from .import_batch import ImportBatch
    from .stats import HourlyActivityStat, TowerFrequencyStat, WeeklyActivityStat


class Subscriber(Base):
    __tablename__ = "subscribers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Phone identifiers
    phone_normalized: Mapped[str] = mapped_column(String(15), unique=True, nullable=False)
    phone_raw: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    carrier: Mapped[Carrier] = mapped_column(Enum(Carrier), nullable=False, default=Carrier.UNKNOWN)

    # PII — from Excel subscriber header block
    full_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    date_of_birth: Mapped[Optional[date]] = mapped_column(nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Identity document
    id_doc_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)   # CCCD, CMND
    id_doc_number: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    id_issue_date: Mapped[Optional[date]] = mapped_column(nullable=True)
    id_issue_authority: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # SIM lifecycle
    activation_date: Mapped[Optional[date]] = mapped_column(nullable=True)
    subscription_type: Mapped[Optional[SubscriptionType]] = mapped_column(
        Enum(SubscriptionType), nullable=True
    )
    account_status: Mapped[Optional[AccountStatus]] = mapped_column(
        Enum(AccountStatus), nullable=True
    )

    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=func.now(), onupdate=func.now()
    )

    # Relationships
    import_batches: Mapped[List[ImportBatch]] = relationship(
        "ImportBatch", back_populates="subscriber", cascade="all, delete-orphan"
    )
    cdr_records: Mapped[List[CDRRecord]] = relationship(
        "CDRRecord", back_populates="subscriber", cascade="all, delete-orphan"
    )
    contact_profiles: Mapped[List[ContactProfile]] = relationship(
        "ContactProfile", back_populates="subscriber", cascade="all, delete-orphan"
    )
    device_subscriptions: Mapped[List[DeviceSubscription]] = relationship(
        "DeviceSubscription", back_populates="subscriber", cascade="all, delete-orphan"
    )
    hourly_stats: Mapped[List[HourlyActivityStat]] = relationship(
        "HourlyActivityStat", back_populates="subscriber", cascade="all, delete-orphan"
    )
    weekly_stats: Mapped[List[WeeklyActivityStat]] = relationship(
        "WeeklyActivityStat", back_populates="subscriber", cascade="all, delete-orphan"
    )
    tower_stats: Mapped[List[TowerFrequencyStat]] = relationship(
        "TowerFrequencyStat", back_populates="subscriber", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_subscribers_full_name", "full_name"),
        Index("ix_subscribers_id_doc_number", "id_doc_number"),
    )

    def __repr__(self) -> str:
        return f"<Subscriber {self.phone_normalized} ({self.carrier})>"
