"""
Exception hierarchy and FastAPI exception handlers.

All application errors subclass TelecomBaseException.
Handlers convert them to standardised JSON error responses.
"""

from __future__ import annotations

import logging
import traceback

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

log = logging.getLogger("telecom.exceptions")


# ---------------------------------------------------------------------------
# Exception hierarchy
# ---------------------------------------------------------------------------

class TelecomBaseException(Exception):
    """Root exception. Carries an HTTP status code and human-readable detail."""

    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    default_detail: str = "An unexpected error occurred."

    def __init__(self, detail: str | None = None) -> None:
        self.detail = detail or self.default_detail
        super().__init__(self.detail)


class NotFoundError(TelecomBaseException):
    status_code = status.HTTP_404_NOT_FOUND
    default_detail = "Resource not found."


class SubscriberNotFoundError(NotFoundError):
    default_detail = "Subscriber not found."


class BatchNotFoundError(NotFoundError):
    default_detail = "Import batch not found."


class ConflictError(TelecomBaseException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "Resource already exists."


class ValidationError(TelecomBaseException):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    default_detail = "Validation failed."


class InvalidFileError(TelecomBaseException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "The uploaded file is invalid or unsupported."


class FileTooLargeError(TelecomBaseException):
    status_code = status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
    default_detail = "Uploaded file exceeds the maximum allowed size."


class ImportFailedError(TelecomBaseException):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    default_detail = "File import failed. Check the error details."


class ServiceUnavailableError(TelecomBaseException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "Service temporarily unavailable."


# ---------------------------------------------------------------------------
# JSON error body builder
# ---------------------------------------------------------------------------

def _error_body(status_code: int, detail: str, errors: list | None = None) -> dict:
    body: dict = {
        "success": False,
        "error": {
            "status_code": status_code,
            "detail": detail,
        },
    }
    if errors:
        body["error"]["errors"] = errors
    return body


# ---------------------------------------------------------------------------
# Exception handlers
# ---------------------------------------------------------------------------

def register_exception_handlers(app: FastAPI) -> None:
    """Attach all exception handlers to the FastAPI application instance."""

    @app.exception_handler(TelecomBaseException)
    async def telecom_exception_handler(
        request: Request, exc: TelecomBaseException
    ) -> JSONResponse:
        log.warning("Application error: %s — %s", type(exc).__name__, exc.detail)
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_body(exc.status_code, exc.detail),
        )

    @app.exception_handler(RequestValidationError)
    async def request_validation_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        errors = [
            {"field": ".".join(str(loc) for loc in e["loc"]), "msg": e["msg"]}
            for e in exc.errors()
        ]
        log.debug("Request validation failed: %s", errors)
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_error_body(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "Request validation failed.",
                errors,
            ),
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        log.error(
            "Unhandled exception on %s %s: %s",
            request.method,
            request.url.path,
            exc,
            exc_info=True,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_error_body(500, "Internal server error."),
        )
