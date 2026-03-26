"""Tests for push notification endpoints."""

from __future__ import annotations

import pytest


class TestPushRouter:
    """Test push notification endpoints."""

    def test_get_vapid_key(self, client):
        resp = client.get("/api/push/vapid-key")
        assert resp.status_code == 200
        data = resp.json()
        assert "public_key" in data
        assert isinstance(data["public_key"], str)
        assert len(data["public_key"]) > 0

    def test_subscribe(self, client):
        subscription = {
            "endpoint": "https://push.example.com/send/abc123",
            "keys": {
                "p256dh": "test-p256dh-key",
                "auth": "test-auth-key",
            },
        }
        resp = client.post("/api/push/subscribe", json=subscription)
        assert resp.status_code == 200
        assert "status" in resp.json()

    def test_subscribe_duplicate(self, client):
        subscription = {
            "endpoint": "https://push.example.com/send/dup",
            "keys": {"p256dh": "key1", "auth": "key2"},
        }
        # Subscribe twice — should not error
        client.post("/api/push/subscribe", json=subscription)
        resp = client.post("/api/push/subscribe", json=subscription)
        assert resp.status_code == 200

    def test_unsubscribe(self, client):
        # Subscribe first
        subscription = {
            "endpoint": "https://push.example.com/send/unsub",
            "keys": {"p256dh": "key1", "auth": "key2"},
        }
        client.post("/api/push/subscribe", json=subscription)

        # Unsubscribe
        resp = client.request(
            "DELETE",
            "/api/push/subscribe",
            json={"endpoint": "https://push.example.com/send/unsub"},
        )
        assert resp.status_code == 200

    def test_unsubscribe_nonexistent(self, client):
        resp = client.request(
            "DELETE",
            "/api/push/subscribe",
            json={"endpoint": "https://push.example.com/send/nonexistent"},
        )
        # Should succeed even if not found
        assert resp.status_code == 200
