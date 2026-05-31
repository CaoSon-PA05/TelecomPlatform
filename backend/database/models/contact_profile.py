from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..base import Base
from .enums import Carrier

if TYPE_CHECKING:
    from .subscriber import Subscriber


class ContactProfile(Base):
    """
    Per-subscriber contact relationship cache.
    Pre-computed from cdr_records; rebuilt whenever CDR data changes.
    Investigator annotations (zalo_id, facebook_url, telegram_id, notes)
    are preserved across recomputes.
    """

    __tablename__ = "contact_profiles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    subscriber_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("subscribers.id"), nullable=False
    )
    contact_phone: Mapped[str] = mapped_column(String(15), nullable=False)
    contact_phone_raw: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    carrier: Mapped[Optional[Carrier]] = mapped_column(Enum(Carrier), nullable=True)

    # Frequency counters — recomputed from cdr_records
    total_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    outgoing_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    incoming_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    voice_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sms_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Interaction time window
    first_interaction_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_interaction_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Investigator annotations — NOT recomputed, preserved across recomputes
    zalo_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    facebook_url: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    telegram_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=func.now(), onupdate=func.now()
    )

    # Relationships
    subscriber: Mapped[Subscriber] = relationship("Subscriber", back_populates="contact_profiles")

    __table_args__ = (
        UniqueConstraint("subscriber_id", "contact_phone", name="uq_contact_profiles_sub_phone"),
        Index("ix_contact_profiles_subscriber_count", "subscriber_id", "total_count"),
        Index("ix_contact_profiles_contact_phone", "contact_phone"),
    )

    def __repr__(self) -> str:
        return f"<ContactProfile {self.contact_phone} × {self.total_count} for sub {self.subscriber_id}>"
