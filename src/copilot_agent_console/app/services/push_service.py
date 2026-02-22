"""Service for managing Web Push notifications.

Handles VAPID key generation, push subscription storage, and sending
push notifications to subscribed devices.
"""

import json
import time
from pathlib import Path
from typing import Any

from copilot_agent_console.app.config import APP_HOME
from copilot_agent_console.app.services.logging_service import get_logger

logger = get_logger(__name__)

PUSH_SUBSCRIPTIONS_FILE = APP_HOME / "push_subscriptions.json"


def get_or_create_vapid_keys() -> dict[str, str]:
    """Get existing VAPID keys or generate new ones.
    
    Keys are stored in settings.json alongside other app settings.
    Returns dict with 'vapid_public_key' and 'vapid_private_key'.
    """
    from copilot_agent_console.app.services.storage_service import storage_service
    settings = storage_service.get_settings()
    
    if settings.get("vapid_public_key") and settings.get("vapid_private_key"):
        return {
            "vapid_public_key": settings["vapid_public_key"],
            "vapid_private_key": settings["vapid_private_key"],
        }
    
    # Generate ECDSA P-256 key pair for VAPID
    import base64
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives import serialization
    
    private_key = ec.generate_private_key(ec.SECP256R1())
    
    # Private key as raw 32 bytes → base64url (no padding)
    private_raw = private_key.private_numbers().private_value.to_bytes(32, "big")
    private_b64 = base64.urlsafe_b64encode(private_raw).decode().rstrip("=")
    
    # Public key as uncompressed point (65 bytes) → base64url (no padding)
    public_raw = private_key.public_key().public_bytes(
        serialization.Encoding.X962,
        serialization.PublicFormat.UncompressedPoint,
    )
    public_b64 = base64.urlsafe_b64encode(public_raw).decode().rstrip("=")
    
    storage_service.update_settings({
        "vapid_public_key": public_b64,
        "vapid_private_key": private_b64,
    })
    
    logger.info("Generated new VAPID keys for push notifications")
    return {
        "vapid_public_key": public_b64,
        "vapid_private_key": private_b64,
    }


class PushSubscriptionService:
    """Manages push notification subscriptions from devices."""
    
    def __init__(self) -> None:
        self._subscriptions: list[dict[str, Any]] = []
        self._load()
    
    def _load(self) -> None:
        """Load subscriptions from disk."""
        if PUSH_SUBSCRIPTIONS_FILE.exists():
            try:
                with open(PUSH_SUBSCRIPTIONS_FILE, "r") as f:
                    self._subscriptions = json.load(f)
                logger.info(f"Loaded {len(self._subscriptions)} push subscriptions")
            except Exception as e:
                logger.warning(f"Failed to load push_subscriptions.json: {e}")
                self._subscriptions = []
        else:
            self._subscriptions = []
    
    def _save(self) -> None:
        """Save subscriptions to disk."""
        try:
            APP_HOME.mkdir(parents=True, exist_ok=True)
            with open(PUSH_SUBSCRIPTIONS_FILE, "w") as f:
                json.dump(self._subscriptions, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save push_subscriptions.json: {e}")
    
    def subscribe(self, subscription: dict[str, Any]) -> None:
        """Add or update a push subscription.
        
        Each subscription has a unique 'endpoint' URL. If a subscription
        with the same endpoint exists, it's replaced.
        """
        endpoint = subscription.get("endpoint", "")
        # Remove existing subscription with same endpoint
        self._subscriptions = [
            s for s in self._subscriptions if s.get("endpoint") != endpoint
        ]
        self._subscriptions.append(subscription)
        self._save()
        logger.info(f"Added push subscription (total: {len(self._subscriptions)})")
    
    def unsubscribe(self, endpoint: str) -> bool:
        """Remove a push subscription by endpoint URL."""
        before = len(self._subscriptions)
        self._subscriptions = [
            s for s in self._subscriptions if s.get("endpoint") != endpoint
        ]
        removed = len(self._subscriptions) < before
        if removed:
            self._save()
            logger.info(f"Removed push subscription (total: {len(self._subscriptions)})")
        return removed
    
    def get_all(self) -> list[dict[str, Any]]:
        """Get all active subscriptions."""
        return self._subscriptions.copy()
    
    def send_to_all(self, title: str, body: str, data: dict | None = None) -> int:
        """Send a push notification to all subscribed devices.
        
        Returns the number of successful deliveries.
        """
        from pywebpush import webpush, WebPushException
        
        keys = get_or_create_vapid_keys()
        payload = json.dumps({
            "title": title,
            "body": body,
            "data": data or {},
            "timestamp": time.time(),
        })
        
        sent = 0
        expired = []
        
        for sub in self._subscriptions:
            try:
                webpush(
                    subscription_info=sub,
                    data=payload,
                    vapid_private_key=keys["vapid_private_key"],
                    vapid_claims={"sub": "mailto:agentconsole@localhost"},
                )
                sent += 1
            except WebPushException as e:
                # 410 Gone or 404 means subscription expired
                if hasattr(e, 'response') and e.response is not None:
                    status = e.response.status_code
                    if status in (404, 410):
                        expired.append(sub.get("endpoint"))
                        logger.info(f"Push subscription expired (status {status})")
                        continue
                logger.warning(f"Failed to send push: {e}")
            except Exception as e:
                logger.warning(f"Push send error: {e}")
        
        # Clean up expired subscriptions
        if expired:
            self._subscriptions = [
                s for s in self._subscriptions
                if s.get("endpoint") not in expired
            ]
            self._save()
            logger.info(f"Cleaned up {len(expired)} expired subscriptions")
        
        logger.info(f"Push notification sent to {sent}/{len(self._subscriptions)} devices")
        return sent


# Singleton
push_subscription_service = PushSubscriptionService()
