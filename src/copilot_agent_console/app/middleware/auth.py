"""Bearer token authentication middleware.

Protects /api/* routes when accessed from non-localhost origins (e.g., phone via tunnel).
Localhost requests bypass auth so the desktop UI continues to work without a token.
"""

import ipaddress
import secrets

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from copilot_agent_console.app.services.storage_service import storage_service
from copilot_agent_console.app.services.logging_service import get_logger

logger = get_logger(__name__)

# Localhost addresses that bypass auth
_LOCALHOST_ADDRS = {"127.0.0.1", "::1", "localhost"}


def _is_localhost(request: Request) -> bool:
    """Check if the request originates from localhost."""
    client = request.client
    if not client:
        return False
    host = client.host
    if host in _LOCALHOST_ADDRS:
        return True
    try:
        addr = ipaddress.ip_address(host)
        return addr.is_loopback
    except ValueError:
        return False


def generate_api_token() -> str:
    """Generate a cryptographically secure API token."""
    return secrets.token_urlsafe(32)


def get_or_create_api_token() -> str:
    """Get the API token from settings, creating one if it doesn't exist."""
    settings = storage_service.get_settings()
    token = settings.get("api_token")
    if not token:
        token = generate_api_token()
        storage_service.update_settings({"api_token": token})
        logger.info("Generated new API token for remote access")
    return token


class TokenAuthMiddleware(BaseHTTPMiddleware):
    """Middleware that requires a bearer token for non-localhost API requests.

    - Localhost requests: always allowed (no token needed)
    - Non-localhost requests to /api/*: require valid Authorization header
    - Non-API requests (static files, SPA): always allowed
    """

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Only protect /api/* routes
        if not path.startswith("/api/"):
            return await call_next(request)

        # Localhost bypasses auth
        if _is_localhost(request):
            return await call_next(request)

        # Non-localhost: require bearer token (header or query param for SSE)
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            provided_token = auth_header[7:]
        else:
            # Fallback: check query param (needed for EventSource/SSE which can't set headers)
            provided_token = request.query_params.get("token", "")

        if not provided_token:
            return JSONResponse(
                status_code=401,
                content={"error": "Authorization required. Provide Bearer token."},
            )

        expected_token = get_or_create_api_token()

        if not secrets.compare_digest(provided_token, expected_token):
            return JSONResponse(
                status_code=403,
                content={"error": "Invalid API token."},
            )

        return await call_next(request)
