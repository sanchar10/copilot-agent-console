"""Notification manager for push notifications.

Handles the delayed notification logic: when an agent completes,
waits a configurable delay, then checks if the session is still
unread before sending a push notification.
"""

import asyncio
import time
from typing import Optional

from copilot_agent_console.app.services.logging_service import get_logger
from copilot_agent_console.app.services.push_service import push_subscription_service
from copilot_agent_console.app.services.storage_service import storage_service
from copilot_agent_console.app.services.viewed_service import viewed_service

logger = get_logger(__name__)

# Default delay before checking if notification should be sent
DEFAULT_NOTIFY_DELAY_SECONDS = 30


class NotificationManager:
    """Manages delayed push notifications for agent completions."""
    
    def __init__(self) -> None:
        self._pending_tasks: dict[str, asyncio.Task] = {}
    
    def _get_delay(self) -> int:
        """Get the notification delay from settings."""
        settings = storage_service.get_settings()
        return settings.get("mobile_notify_delay_seconds", DEFAULT_NOTIFY_DELAY_SECONDS)
    
    def on_agent_completed(self, session_id: str, session_name: str, preview: str = "") -> None:
        """Called when an agent finishes responding.
        
        Schedules a delayed check to see if the user has viewed the session.
        If still unread after the delay, sends a push notification.
        
        Args:
            session_id: The session that was updated
            session_name: Display name for the notification
            preview: Short preview of the agent's response (first ~100 chars)
        """
        # Don't bother if no subscriptions
        if not push_subscription_service.get_all():
            return
        
        # Cancel any existing pending notification for this session
        existing = self._pending_tasks.get(session_id)
        if existing and not existing.done():
            existing.cancel()
        
        # Record when the completion happened
        completion_time = time.time()
        
        # Schedule delayed check
        try:
            loop = asyncio.get_event_loop()
            task = loop.create_task(
                self._delayed_notify(session_id, session_name, preview, completion_time)
            )
            self._pending_tasks[session_id] = task
        except RuntimeError:
            logger.warning("No event loop available for push notification scheduling")
    
    async def _delayed_notify(
        self,
        session_id: str,
        session_name: str,
        preview: str,
        completion_time: float,
    ) -> None:
        """Wait for delay, then check if notification should be sent."""
        delay = self._get_delay()
        
        try:
            await asyncio.sleep(delay)
        except asyncio.CancelledError:
            logger.debug(f"[{session_id}] Push notification cancelled (new completion or viewed)")
            return
        
        # Check if the session was viewed since completion
        viewed_at = viewed_service.get(session_id)
        if viewed_at is not None and viewed_at >= completion_time:
            logger.info(f"[{session_id}] Already viewed, skipping push notification")
            return
        
        # Still unread — send push
        title = session_name or f"Session {session_id[:8]}"
        body = preview[:120] if preview else "Agent has finished responding"
        
        sent = push_subscription_service.send_to_all(
            title=f"🤖 {title}",
            body=body,
            data={
                "session_id": session_id,
                "url": f"/mobile/chat/{session_id}",
            },
        )
        
        if sent > 0:
            logger.info(f"[{session_id}] Push notification sent to {sent} device(s)")
        
        # Clean up
        self._pending_tasks.pop(session_id, None)
    
    def cancel_for_session(self, session_id: str) -> None:
        """Cancel pending notification for a session (e.g., when viewed)."""
        task = self._pending_tasks.pop(session_id, None)
        if task and not task.done():
            task.cancel()


# Singleton
notification_manager = NotificationManager()
