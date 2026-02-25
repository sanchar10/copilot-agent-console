"""Sessions router - CRUD and chat operations."""

import asyncio
import json
import os
import uuid
from typing import AsyncGenerator

from fastapi import APIRouter, Form, HTTPException, UploadFile, File
from sse_starlette.sse import EventSourceResponse

from copilot_console.app.config import SESSIONS_DIR
from copilot_console.app.models.message import MessageCreate
from copilot_console.app.models.session import Session, SessionCreate, SessionUpdate, SessionWithMessages
from copilot_console.app.services.copilot_service import copilot_service
from copilot_console.app.services.agent_storage_service import agent_storage_service
from copilot_console.app.services.mcp_service import mcp_service
from copilot_console.app.services.response_buffer import response_buffer_manager, ResponseStatus
from copilot_console.app.services.session_service import session_service
from copilot_console.app.services.storage_service import storage_service
from copilot_console.app.services.tools_service import get_tools_service
from copilot_console.app.services.viewed_service import viewed_service
from copilot_console.app.services.logging_service import get_logger, set_session_context

logger = get_logger(__name__)

# Get tools service singleton
tools_service = get_tools_service()

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.get("/active-agents")
async def get_active_agents() -> dict:
    """Get information about all sessions with active agents.
    
    Returns count and details of sessions where agents are currently
    generating responses (streaming in progress).
    """
    active_sessions = response_buffer_manager.get_all_active()
    return {
        "count": len(active_sessions),
        "sessions": active_sessions,
    }


@router.get("/active-agents/stream")
async def stream_active_agents() -> EventSourceResponse:
    """Stream live updates of all active agent sessions.
    
    SSE endpoint that sends updates every second with:
    - List of all active sessions
    - Content tail (last 500 chars) for each
    - Current step being executed
    - Elapsed time
    
    Events:
    - 'update': Regular update with all active sessions
    - 'done': Sent when a session completes (removed from active list)
    """
    async def generate_events() -> AsyncGenerator[dict, None]:
        previous_session_ids: set[str] = set()
        
        try:
            while True:
                active_sessions = response_buffer_manager.get_all_active(
                    include_content=True, 
                    content_tail_chars=500
                )
                current_session_ids = {s["session_id"] for s in active_sessions}
                
                # Check for completed sessions
                completed = previous_session_ids - current_session_ids
                for session_id in completed:
                    yield {
                        "event": "completed",
                        "data": json.dumps({"session_id": session_id})
                    }
                
                # Send update with all active sessions
                yield {
                    "event": "update",
                    "data": json.dumps({
                        "count": len(active_sessions),
                        "sessions": active_sessions,
                    })
                }
                
                previous_session_ids = current_session_ids
                await asyncio.sleep(1)  # Update every second
                
        except asyncio.CancelledError:
            logger.info("[SSE] Active agents stream client disconnected")
            raise
    
    return EventSourceResponse(generate_events())


@router.post("", response_model=Session)
async def create_session(request: SessionCreate) -> Session:
    """Create a new chat session."""
    return await session_service.create_session(request)


@router.get("")
async def list_sessions() -> dict:
    """List all sessions ordered by last activity."""
    sessions = await session_service.list_sessions()
    return {"sessions": [s.model_dump(mode="json") for s in sessions]}


@router.get("/{session_id}", response_model=SessionWithMessages)
async def get_session(session_id: str) -> SessionWithMessages:
    """Get a session with its message history."""
    session = await session_service.get_session_with_messages(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.delete("/{session_id}")
async def delete_session(session_id: str) -> dict:
    """Delete a session permanently."""
    deleted = await session_service.delete_session(session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found")
    # Clean up viewed timestamp
    viewed_service.remove(session_id)
    return {"success": True}


@router.patch("/{session_id}", response_model=Session)
async def update_session(session_id: str, request: SessionUpdate) -> Session:
    """Update session metadata (name, cwd)."""
    # Validate CWD if provided
    if request.cwd is not None:
        import os
        if not os.path.isdir(request.cwd):
            raise HTTPException(
                status_code=400,
                detail=f"Directory does not exist: {request.cwd}"
            )
    
    session = await session_service.update_session(session_id, request)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("/{session_id}/connect")
async def connect_session(session_id: str) -> dict:
    """Connect to a session (called when tab opens).

    This resumes the SDK session for real-time chat.
    """
    success = await session_service.connect_session(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"success": True}


@router.post("/{session_id}/disconnect")
async def disconnect_session(session_id: str) -> dict:
    """Disconnect from a session (called when tab closes).

    This destroys the SDK session but keeps history for later.
    
    IMPORTANT: If there's an active response being generated (agent still running),
    we DON'T destroy the session - let the agent finish its work.
    """
    # Check if there's an active response - if so, don't kill the session!
    has_active = response_buffer_manager.has_active_response(session_id)
    logger.info(f"[Disconnect] Session {session_id}: has_active_response={has_active}")
    
    if has_active:
        logger.info(f"[Disconnect] Session {session_id} has active response, NOT destroying client")
        return {"success": True, "deferred": True}
    
    await session_service.disconnect_session(session_id)
    return {"success": True}


@router.post("/{session_id}/enqueue")
async def enqueue_message(session_id: str, request: MessageCreate) -> dict:
    """Enqueue a follow-up message while the agent is already running.

    Unlike /messages, this does NOT create a new background task or SSE stream.
    It sends the message with mode='enqueue' to the existing SDK session.
    The running agent will process it after the current response completes.
    """
    set_session_context(session_id)
    logger.info(f"Enqueue request: {request.content[:100]}")

    # Verify session exists
    session = await session_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Must have an active response for enqueue to make sense
    if not response_buffer_manager.has_active_response(session_id):
        raise HTTPException(status_code=409, detail="No active agent to enqueue to")

    # Add user message to history
    session_service.add_user_message(session_id, request.content)

    try:
        result = await copilot_service.enqueue_message(
            session_id,
            request.content,
            attachments=[{"type": a.type, "path": a.path, **({"displayName": a.displayName} if a.displayName else {})} for a in request.attachments] if request.attachments else None,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        error_msg = str(e)
        if "Session not found" in error_msg:
            logger.warning(f"[Enqueue] SDK session gone for {session_id}, cleaning up buffer")
            await response_buffer_manager.remove_buffer(session_id)
            raise HTTPException(status_code=410, detail="Session expired, please send a new message")
        raise HTTPException(status_code=500, detail=error_msg)


@router.post("/{session_id}/abort")
async def abort_session(session_id: str) -> dict:
    """Abort the currently processing message in a session.

    The session remains valid and can continue to receive new messages.
    """
    set_session_context(session_id)
    logger.info(f"Abort request for session {session_id}")

    try:
        result = await copilot_service.abort_session(session_id)
        return result
    except ValueError as e:
        # No active SDK session — clean up the buffer if it's stuck
        logger.warning(f"[Abort] No SDK session for {session_id}, cleaning up buffer")
        await response_buffer_manager.remove_buffer(session_id)
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        error_msg = str(e)
        if "Session not found" in error_msg:
            logger.warning(f"[Abort] SDK session gone for {session_id}, cleaning up buffer")
            await response_buffer_manager.remove_buffer(session_id)
            return {"status": "aborted", "detail": "Session expired, buffer cleaned up"}
        raise HTTPException(status_code=500, detail=error_msg)


@router.post("/{session_id}/messages")
async def send_message(session_id: str, request: MessageCreate) -> EventSourceResponse:
    """Send a message and stream the assistant's response via SSE.
    
    The agent runs in a background task that continues even if the browser
    disconnects. The SSE stream reads from a buffer, so reconnecting will
    resume from where you left off.
    """
    # Set session context for logging
    set_session_context(session_id)
    
    logger.info(f"Received message request: {request.content[:100]}{'...' if len(request.content) > 100 else ''}, is_new_session={request.is_new_session}")
    
    # Verify session exists and get CWD
    session = await session_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get CWD for the session (use home dir as fallback)
    cwd = session.cwd or os.path.expanduser("~")
    
    # Get MCP servers for this session
    mcp_servers_sdk = mcp_service.get_servers_for_sdk(session.mcp_servers)
    logger.info(f"[SSE] Loading {len(mcp_servers_sdk)} MCP servers for session {session_id}")
    
    # Get local/custom tools for this session
    # Only load custom tools if the user explicitly selected some.
    # Passing tools=[] when none selected avoids a CLI bug where
    # tools + workingDirectory causes custom_agents to be silently dropped.
    tools_sdk = tools_service.get_sdk_tools(session.tools.custom) if session.tools.custom else []
    logger.info(f"[SSE] Loading {len(tools_sdk)} custom tools for session {session_id}")
    
    # Get built-in tool whitelist/blacklist
    builtin_tools = session.tools.builtin if session.tools.builtin else None
    excluded_tools = session.tools.excluded_builtin if session.tools.excluded_builtin else None

    # Get system message from session field
    system_message = None
    if session.system_message and session.system_message.get("content"):
        system_message = {"mode": session.system_message.get("mode", "replace"), "content": session.system_message["content"]}

    # Resolve sub-agents (Agent Teams)
    custom_agents_sdk = None
    if session.sub_agents:
        # Validate sub-agents are still eligible
        errors = agent_storage_service.validate_sub_agents(
            session.sub_agents, exclude_agent_id=session.agent_id
        )
        if errors:
            raise HTTPException(
                status_code=400,
                detail=f"Sub-agent validation failed: {'; '.join(errors)}"
            )
        custom_agents_sdk = agent_storage_service.convert_to_sdk_custom_agents(
            session.sub_agents, mcp_service
        )
        logger.info(f"[SSE] Resolved {len(custom_agents_sdk)} sub-agents for session {session_id}")

    # Add user message to history
    session_service.add_user_message(session_id, request.content)
    
    # Create response buffer
    buffer = await response_buffer_manager.create_buffer(session_id)
    
    # Create the background coroutine
    async def run_agent():
        """Wrapper to ensure exceptions are logged and don't propagate."""
        try:
            logger.info(f"[Background] Starting agent for session {session_id}")
            await copilot_service.send_message_background(
                session_id=session_id,
                model=session.model,
                cwd=cwd,
                prompt=request.content,
                buffer=buffer,
                mcp_servers=mcp_servers_sdk,
                tools=tools_sdk,
                available_tools=builtin_tools,
                excluded_tools=excluded_tools,
                system_message=system_message,
                is_new_session=request.is_new_session,
                mode=request.mode,
                attachments=[{"type": a.type, "path": a.path, **({"displayName": a.displayName} if a.displayName else {})} for a in request.attachments] if request.attachments else None,
                custom_agents=custom_agents_sdk,
            )
            logger.info(f"[Background] Agent completed for session {session_id}")
            
            # Auto-name: if name_set is False, try to get summary from SDK
            # This runs BEFORE buffer.complete() so the SSE done event includes the name
            try:
                stored_meta = storage_service.load_session(session_id)
                name_set = stored_meta.get("name_set", None) if stored_meta else True
                # Backward compat: old sessions without name_set field
                # If name is still default "New Session", treat as not set
                if name_set is None:
                    name_set = stored_meta.get("session_name", "New Session") != "New Session"
                
                if stored_meta and not name_set:
                    # Fetch updated session list to get summary
                    sdk_sessions = await copilot_service.list_sessions()
                    for sdk_s in sdk_sessions:
                        sid = getattr(sdk_s, "sessionId", None) or getattr(sdk_s, "session_id", None)
                        if sid == session_id:
                            summary = getattr(sdk_s, "summary", None)
                            if summary and isinstance(summary, str) and summary.strip():
                                new_name = summary.strip()
                                # Update storage with the new name
                                current_session = await session_service.get_session(session_id)
                                if current_session:
                                    current_session.session_name = new_name
                                    storage_service.save_session(current_session)
                                # Pass to SSE via buffer
                                buffer.updated_session_name = new_name
                                logger.info(f"[Background] Auto-named session {session_id}: {new_name}")
                            break
            except Exception as e:
                logger.warning(f"[Background] Failed to auto-name session {session_id}: {e}")
            
            # NOW mark the buffer complete - SSE done event will include the name
            buffer.complete()
            
            # Trigger delayed push notification check
            from copilot_console.app.services.notification_manager import notification_manager
            preview = buffer.get_full_content()[:120] if buffer.chunks else ""
            session_name = (buffer.updated_session_name 
                          or (stored_meta.get("session_name") if stored_meta else None) 
                          or session_id[:8])
            notification_manager.on_agent_completed(session_id, session_name, preview)
        except asyncio.CancelledError:
            logger.warning(f"[Background] Agent task cancelled for session {session_id}")
            buffer.fail("Task was cancelled")
        except Exception as e:
            logger.error(f"[Background] Agent error for session {session_id}: {e}", exc_info=True)
            buffer.fail(str(e))
    
    # Start as a fire-and-forget task using the event loop directly
    loop = asyncio.get_running_loop()
    task = loop.create_task(run_agent())
    # Add a done callback to log completion
    task.add_done_callback(
        lambda t: logger.info(f"[Background] Task done for {session_id}: cancelled={t.cancelled()}, exception={t.exception() if not t.cancelled() else None}")
    )
    response_buffer_manager.register_task(session_id, task)
    logger.info(f"[SSE] Started background task for session {session_id}")

    async def generate_events() -> AsyncGenerator[dict, None]:
        """Stream events from the buffer to SSE client."""
        chunks_sent = 0
        steps_sent = 0
        notifications_sent = 0
        usage_info_sent = False

        try:
            while True:
                # Send any new chunks
                while chunks_sent < len(buffer.chunks):
                    yield {
                        "event": "delta",
                        "data": json.dumps({"content": buffer.chunks[chunks_sent]})
                    }
                    chunks_sent += 1
                
                # Send any new steps
                while steps_sent < len(buffer.steps):
                    yield {
                        "event": "step",
                        "data": json.dumps(buffer.steps[steps_sent])
                    }
                    steps_sent += 1
                
                # Send any new notifications (e.g. pending_messages)
                while notifications_sent < len(buffer.notifications):
                    notif = buffer.notifications[notifications_sent]
                    yield {
                        "event": notif["event"],
                        "data": json.dumps(notif["data"])
                    }
                    notifications_sent += 1
                
                # Send usage_info if available and not yet sent
                if buffer.usage_info and not usage_info_sent:
                    yield {
                        "event": "usage_info",
                        "data": json.dumps(buffer.usage_info)
                    }
                    usage_info_sent = True
                
                # Check if done
                if buffer.status == ResponseStatus.COMPLETED:
                    content = buffer.get_full_content()
                    if content.strip():
                        done_data = {"content_length": len(content)}
                        # Include auto-generated session name if available
                        if buffer.updated_session_name:
                            done_data["session_name"] = buffer.updated_session_name
                        yield {"event": "done", "data": json.dumps(done_data)}
                    else:
                        yield {"event": "error", "data": json.dumps({"error": "No response content"})}
                    break
                elif buffer.status == ResponseStatus.ERROR:
                    yield {"event": "error", "data": json.dumps({"error": buffer.error})}
                    break
                
                # Wait for new data (no polling - uses async event!)
                await buffer.wait_for_update(timeout=30.0)
                    
        except asyncio.CancelledError:
            # Client disconnected - that's OK, background task should continue!
            logger.info(f"[SSE] Client disconnected for session {session_id}")
            # DON'T re-raise - let the request end cleanly without affecting background task

    return EventSourceResponse(generate_events())


@router.get("/{session_id}/response-status")
async def get_response_status(session_id: str) -> dict:
    """Check if there's an active response being generated.
    
    Frontend can call this on reconnect to check if it should resume streaming.
    """
    return response_buffer_manager.get_status(session_id)


@router.get("/{session_id}/response-stream")
async def resume_response_stream(
    session_id: str, 
    from_chunk: int = 0, 
    from_step: int = 0
) -> EventSourceResponse:
    """Resume streaming an in-progress response.
    
    Used when frontend reconnects and wants to continue receiving updates.
    Pass from_chunk and from_step to skip already-received data.
    """
    buffer = await response_buffer_manager.get_buffer(session_id)
    
    if not buffer:
        raise HTTPException(status_code=404, detail="No active response for this session")
    
    async def generate_events() -> AsyncGenerator[dict, None]:
        chunks_sent = from_chunk
        steps_sent = from_step
        
        try:
            while True:
                # Send any new chunks
                while chunks_sent < len(buffer.chunks):
                    yield {
                        "event": "delta",
                        "data": json.dumps({"content": buffer.chunks[chunks_sent]})
                    }
                    chunks_sent += 1
                
                # Send any new steps
                while steps_sent < len(buffer.steps):
                    yield {
                        "event": "step",
                        "data": json.dumps(buffer.steps[steps_sent])
                    }
                    steps_sent += 1
                
                # Check if done
                if buffer.status == ResponseStatus.COMPLETED:
                    content = buffer.get_full_content()
                    if content.strip():
                        yield {"event": "done", "data": json.dumps({"content_length": len(content)})}
                    else:
                        yield {"event": "error", "data": json.dumps({"error": "No response content"})}
                    break
                elif buffer.status == ResponseStatus.ERROR:
                    yield {"event": "error", "data": json.dumps({"error": buffer.error})}
                    break
                
                # Wait for new data
                await buffer.wait_for_update(timeout=30.0)
                    
        except asyncio.CancelledError:
            logger.info(f"[SSE] Resume stream client disconnected for session {session_id}")
            raise
    
    return EventSourceResponse(generate_events())


# Upload destination: per-session files directory under app home
# Files are stored at ~/.copilot-agent-console/sessions/{session_id}/files/


@router.post("/upload")
async def upload_file(file: UploadFile = File(...), session_id: str = Form(...)):
    """Upload a file for attachment. Stores in the session's files directory."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    # Store in session-specific files directory
    upload_dir = SESSIONS_DIR / session_id / "files"
    upload_dir.mkdir(parents=True, exist_ok=True)

    # Create unique filename to avoid collisions
    ext = os.path.splitext(file.filename)[1]
    unique_name = f"{uuid.uuid4().hex[:12]}{ext}"
    file_path = upload_dir / unique_name

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    logger.info(f"[Upload] Saved {file.filename} ({len(content)} bytes) to {file_path}")
    return {
        "path": str(file_path),
        "originalName": file.filename,
        "size": len(content),
    }
