"""
Shared pytest fixtures for the telecom_analysis test suite.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from backend.database.base import Base


SAMPLE_FILES_DIR = Path(__file__).parent.parent.parent / "Mau" / "File data mau"
VIETTEL_SAMPLE   = SAMPLE_FILES_DIR / "1_0969619929.xlsx"
VIETTEL_SAMPLE2  = SAMPLE_FILES_DIR / "0_0382733506.xlsx"


@pytest.fixture(scope="function")
def db() -> Session:
    """In-memory SQLite session — isolated per test function."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(engine)


@pytest.fixture(scope="session")
def viettel_raw_data() -> list[list]:
    """Load the Viettel sample Excel file once per test session."""
    from modules.telecom_analysis.utils.file_utils import read_excel_to_array
    return read_excel_to_array(VIETTEL_SAMPLE)


@pytest.fixture(scope="session")
def viettel_raw_data2() -> list[list]:
    """Load the second Viettel sample Excel file once per test session."""
    from modules.telecom_analysis.utils.file_utils import read_excel_to_array
    return read_excel_to_array(VIETTEL_SAMPLE2)


@pytest.fixture
def sample_phone_normalized() -> str:
    return "0969619929"


@pytest.fixture
def sample_phone_raw() -> str:
    return "969619929"
