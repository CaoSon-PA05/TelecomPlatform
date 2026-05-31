"""CRUD service for subscribers."""

from __future__ import annotations

from sqlalchemy.orm import Session

from ..schemas.subscriber_schema import SubscriberCreate, SubscriberResponse, SubscriberUpdate


class SubscriberService:

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, subscriber_id: int) -> SubscriberResponse | None:
        """Return subscriber by PK, or None."""
        ...

    def get_by_phone(self, phone_normalized: str) -> SubscriberResponse | None:
        """Return subscriber by normalized phone, or None."""
        ...

    def list_all(self) -> list[SubscriberResponse]:
        """Return all subscribers ordered by phone_normalized."""
        ...

    def create(self, data: SubscriberCreate) -> SubscriberResponse:
        """Insert a new subscriber. Raises IntegrityError on duplicate phone."""
        ...

    def update(self, subscriber_id: int, data: SubscriberUpdate) -> SubscriberResponse:
        """Partial update of mutable fields (name, address, notes, status)."""
        ...

    def delete(self, subscriber_id: int) -> None:
        """
        Delete subscriber and all related data via cascade.
        Requires explicit caller confirmation — not called automatically.
        """
        ...

    def update_subscriber_info_from_import(
        self, subscriber_id: int, raw_info
    ) -> None:
        """
        Update PII fields from a new import batch.
        Never overwrites fields that were manually edited (notes, account_status).
        """
        ...
