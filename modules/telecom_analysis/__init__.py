"""
telecom_analysis — Enterprise CDR Analytics Module
===================================================
Provider-independent pipeline for importing, parsing, normalizing,
and analyzing Call Detail Records (CDR) from Vietnamese mobile carriers.

Public surface
--------------
Import through the service layer for all business operations:

    from modules.telecom_analysis.services import ImportService, AnalyticsService

Or access sub-packages directly for lower-level use:

    from modules.telecom_analysis.parsers import auto_detect_parser
    from modules.telecom_analysis.normalizers import normalize_phone
"""

__version__ = "0.1.0"
