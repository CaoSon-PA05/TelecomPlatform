from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, Integer, SmallInteger, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..base import Base

if TYPE_CHECKING:
    from .cell_tower import CellTower
    from .subscriber import Subscriber


class HourlyActivityStat(Base):
    """
    Pre-computed 24-hour activity histogram per subscriber.
    hour_of_day=0 → midnight, hour_of_day=23 → 11pm.
    Rebuilt in full (DELETE + INSERT) whenever CDR data changes.
    """

    __tablename__ = "hourly_activity_stats"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    subscriber_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("subscribers.id"), nullable=False
    )
    hour_of_day: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # 0–23

    # Counters
    total_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    voice_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sms_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    outgoing_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    incoming_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    computed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=func.now())

    subscriber: Mapped[Subscriber] = relationship("Subscriber", back_populates="hourly_stats")

    __table_args__ = (
        UniqueConstraint(
            "subscriber_id", "hour_of_day", name="uq_hourly_activity_sub_hour"
        ),
    )

    def __repr__(self) -> str:
        return f"<HourlyStat sub={self.subscriber_id} h={self.hour_of_day:02d} n={self.total_count}>"


class WeeklyActivityStat(Base):
    """
    Pre-computed day-of-week activity histogram per subscriber.
    day_of_week: 0=Monday … 6=Sunday (ISO 8601 convention).
    Rebuilt in full whenever CDR data changes.
    """

    __tablename__ = "weekly_activity_stats"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    subscriber_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("subscribers.id"), nullable=False
    )
    day_of_week: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # 0–6

    # Counters
    total_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    voice_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sms_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    computed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=func.now())

    subscriber: Mapped[Subscriber] = relationship("Subscriber", back_populates="weekly_stats")

    __table_args__ = (
        UniqueConstraint(
            "subscriber_id", "day_of_week", name="uq_weekly_activity_sub_day"
        ),
    )

    def __repr__(self) -> str:
        return f"<WeeklyStat sub={self.subscriber_id} day={self.day_of_week} n={self.total_count}>"


class TowerFrequencyStat(Base):
    """
    Pre-computed tower visit frequency per subscriber.
    Maps subscriber → cell_tower → visit count and time window.
    Rebuilt in full whenever CDR data changes.
    """

    __tablename__ = "tower_frequency_stats"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    subscriber_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("subscribers.id"), nullable=False
    )
    tower_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("cell_towers.id"), nullable=False
    )

    total_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    first_seen_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    computed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=func.now())

    subscriber: Mapped[Subscriber] = relationship("Subscriber", back_populates="tower_stats")
    tower: Mapped[CellTower] = relationship("CellTower", back_populates="frequency_stats")

    __table_args__ = (
        UniqueConstraint(
            "subscriber_id", "tower_id", name="uq_tower_freq_sub_tower"
        ),
        # Shared-location cross-subscriber query: find all subscribers at a given tower
        Index("ix_tower_freq_tower_id", "tower_id"),
        # Location tab sort: most frequent towers first
        Index("ix_tower_freq_subscriber_count", "subscriber_id", "total_count"),
    )

    def __repr__(self) -> str:
        return f"<TowerFreq sub={self.subscriber_id} tower={self.tower_id} n={self.total_count}>"
