"""
Async file storage manager.

Directory layout under UPLOAD_DIR:
  pending/    files just received, awaiting import processing
  processed/  files successfully imported into the database
  failed/     files that failed import (kept for debugging)

All write operations use aiofiles for non-blocking I/O.
Stored filenames are UUID-based — the original filename is never used on disk.
"""

from __future__ import annotations

import asyncio
import logging
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import NamedTuple

import aiofiles
from fastapi import UploadFile

from backend.app.core.config import settings

log = logging.getLogger("telecom.upload.storage")

_CHUNK_SIZE = 65_536  # 64 KB per write chunk


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

class StoredFile(NamedTuple):
    stored_path:   Path      # absolute path to the file on disk
    stored_name:   str       # UUID-based filename (no path traversal risk)
    original_name: str       # original filename from the upload (display only)
    size_bytes:    int       # file size after write


# ---------------------------------------------------------------------------
# Storage service
# ---------------------------------------------------------------------------

class UploadStorage:
    """
    Manages the upload directory lifecycle.
    One instance can be shared across requests (all methods are stateless
    once the directories exist).
    """

    def __init__(self, base_dir: Path | None = None) -> None:
        self.base_dir      = base_dir or Path(settings.UPLOAD_DIR).resolve()
        self.pending_dir   = self.base_dir / "pending"
        self.processed_dir = self.base_dir / "processed"
        self.failed_dir    = self.base_dir / "failed"

    # ------------------------------------------------------------------
    # Directory lifecycle
    # ------------------------------------------------------------------

    def ensure_dirs(self) -> None:
        """Create upload subdirectories if they do not exist."""
        for d in (self.pending_dir, self.processed_dir, self.failed_dir):
            d.mkdir(parents=True, exist_ok=True)
        log.debug("Upload directories ensured under %s", self.base_dir)

    # ------------------------------------------------------------------
    # Write — async (aiofiles)
    # ------------------------------------------------------------------

    async def save_upload(
        self, file: UploadFile, original_filename: str
    ) -> StoredFile:
        """
        Stream-write the UploadFile to pending/ using aiofiles.
        Generates a UUID-based stored filename for security.
        Returns StoredFile with path and size.
        """
        self.ensure_dirs()

        stored_name = _make_stored_name(original_filename)
        dest = self.pending_dir / stored_name

        await file.seek(0)
        bytes_written = 0

        try:
            async with aiofiles.open(dest, "wb") as out:
                while True:
                    chunk = await file.read(_CHUNK_SIZE)
                    if not chunk:
                        break
                    await out.write(chunk)
                    bytes_written += len(chunk)
        except Exception:
            # Clean up partial file on failure
            if dest.exists():
                dest.unlink(missing_ok=True)
            raise

        log.info(
            "Saved upload '%s' → '%s' (%d bytes)",
            original_filename, stored_name, bytes_written,
        )
        return StoredFile(
            stored_path=dest,
            stored_name=stored_name,
            original_name=original_filename,
            size_bytes=bytes_written,
        )

    # ------------------------------------------------------------------
    # Lifecycle moves — synchronous (rename is atomic on most OSes)
    # ------------------------------------------------------------------

    def move_to_processed(self, path: Path) -> Path:
        """Move a pending file to processed/ after a successful import."""
        dest = self.processed_dir / path.name
        shutil.move(str(path), str(dest))
        log.debug("Moved to processed: %s", dest.name)
        return dest

    def move_to_failed(self, path: Path) -> Path:
        """Move a pending file to failed/ after an import error."""
        dest = self.failed_dir / path.name
        shutil.move(str(path), str(dest))
        log.debug("Moved to failed: %s", dest.name)
        return dest

    # ------------------------------------------------------------------
    # Deletion — async
    # ------------------------------------------------------------------

    async def delete(self, path: Path) -> None:
        """Async-safe delete (runs unlink in thread pool)."""
        await asyncio.to_thread(_unlink_safe, path)

    # ------------------------------------------------------------------
    # Inspection
    # ------------------------------------------------------------------

    def list_pending(self) -> list[Path]:
        """Return all files currently in pending/."""
        if not self.pending_dir.exists():
            return []
        return sorted(
            self.pending_dir.glob("*.xls*"),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )

    def get_pending(self, stored_name: str) -> Path | None:
        """Return the pending path for a stored filename, or None."""
        p = self.pending_dir / stored_name
        return p if p.exists() else None

    def get_processed(self, stored_name: str) -> Path | None:
        p = self.processed_dir / stored_name
        return p if p.exists() else None

    # ------------------------------------------------------------------
    # Maintenance
    # ------------------------------------------------------------------

    async def cleanup_old_files(
        self,
        max_age_hours: int = 24,
        directories: list[str] | None = None,
    ) -> int:
        """
        Delete files older than max_age_hours from the specified directories.
        Defaults to cleaning pending/ and failed/.
        Returns count of deleted files.
        """
        dirs_to_clean = directories or ["pending", "failed"]
        threshold = datetime.now(tz=timezone.utc).timestamp() - (max_age_hours * 3600)
        deleted = 0

        for dir_name in dirs_to_clean:
            directory = self.base_dir / dir_name
            if not directory.exists():
                continue
            for f in directory.iterdir():
                if f.is_file() and f.stat().st_mtime < threshold:
                    await asyncio.to_thread(_unlink_safe, f)
                    deleted += 1
                    log.debug("Cleaned up old file: %s", f.name)

        if deleted:
            log.info("Cleanup removed %d files older than %dh", deleted, max_age_hours)
        return deleted

    def storage_summary(self) -> dict:
        """Return counts and total sizes for each directory (for health/info)."""
        result = {}
        for name, directory in [
            ("pending",   self.pending_dir),
            ("processed", self.processed_dir),
            ("failed",    self.failed_dir),
        ]:
            if not directory.exists():
                result[name] = {"count": 0, "total_kb": 0.0}
                continue
            files = list(directory.iterdir())
            total = sum(f.stat().st_size for f in files if f.is_file())
            result[name] = {
                "count": len(files),
                "total_kb": round(total / 1024, 1),
            }
        return result


# ---------------------------------------------------------------------------
# Module-level singleton (share across requests)
# ---------------------------------------------------------------------------

upload_storage = UploadStorage()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_stored_name(original_filename: str) -> str:
    """
    Generate a UUID-based filename, preserving the original extension.
    Prevents path traversal and filename collisions.
    """
    ext = Path(original_filename).suffix.lower() if original_filename else ".xlsx"
    if ext not in {".xlsx", ".xls"}:
        ext = ".xlsx"
    return f"{uuid.uuid4().hex}{ext}"


def _unlink_safe(path: Path) -> None:
    """Delete a file, silently ignoring FileNotFoundError."""
    try:
        path.unlink()
    except FileNotFoundError:
        pass
