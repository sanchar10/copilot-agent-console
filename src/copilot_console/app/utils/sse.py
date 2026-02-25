"""SSE (Server-Sent Events) utilities."""

import json
from typing import Any, AsyncGenerator

from sse_starlette.sse import EventSourceResponse


def sse_event(event: str, data: dict[str, Any]) -> str:
    """Format an SSE event."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def sse_response(
    generator: AsyncGenerator[tuple[str, dict[str, Any]], None]
) -> EventSourceResponse:
    """Create an SSE response from an async generator.

    The generator should yield tuples of (event_type, data_dict).
    """

    async def event_generator():
        async for event_type, data in generator:
            yield {"event": event_type, "data": json.dumps(data)}

    return EventSourceResponse(event_generator())
