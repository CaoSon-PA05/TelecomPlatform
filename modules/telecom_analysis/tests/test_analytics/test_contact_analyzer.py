"""Tests for ContactAnalyzer."""

from __future__ import annotations

import pytest

from modules.telecom_analysis.analytics.contact_analyzer import ContactAnalyzer


class TestContactAnalyzer:

    def test_rebuild_creates_contact_profiles(self, db):
        """After import + rebuild, contact_profiles should have rows."""
        ...

    def test_total_count_matches_cdr_records(self, db):
        """contact_profile.total_count must equal CDR record count for that contact."""
        ...

    def test_outgoing_incoming_counts_correct(self, db):
        """outgoing_count + incoming_count = total_count (excluding service)."""
        ...

    def test_get_shared_contacts_requires_two_files(self, db):
        """Shared contacts query returns empty list for a single subscriber."""
        ...

    def test_annotations_preserved_after_rebuild(self, db):
        """zalo_id/notes set by investigator survive a stats rebuild."""
        ...
