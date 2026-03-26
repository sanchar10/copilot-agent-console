"""Tests for automations router — CRUD, toggle, run-now."""

from __future__ import annotations

import json
from pathlib import Path

import pytest


class TestAutomationsRouter:
    """Test automation CRUD endpoints."""

    def test_list_automations_empty(self, client):
        resp = client.get("/api/automations")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_create_automation(self, client):
        # First create an agent to reference
        agent_data = {
            "name": "Test Agent",
            "description": "A test agent",
            "system_message": {"mode": "replace", "content": "You are helpful"},
        }
        agent_resp = client.post("/api/agents", json=agent_data)
        assert agent_resp.status_code == 200
        agent_id = agent_resp.json()["id"]

        # Create automation
        automation_data = {
            "name": "Test Automation",
            "agent_id": agent_id,
            "cron": "0 8 * * 1-5",
            "prompt": "Do something",
        }
        resp = client.post("/api/automations", json=automation_data)
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Test Automation"
        assert data["agent_id"] == agent_id
        assert data["cron"] == "0 8 * * 1-5"
        assert data["enabled"] is True
        return data["id"], agent_id

    def test_list_automations_after_create(self, client):
        self.test_create_automation(client)
        resp = client.get("/api/automations")
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    def test_get_automation(self, client):
        auto_id, _ = self.test_create_automation(client)
        resp = client.get(f"/api/automations/{auto_id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == auto_id

    def test_get_automation_not_found(self, client):
        resp = client.get("/api/automations/nonexistent")
        assert resp.status_code == 404

    def test_update_automation(self, client):
        auto_id, agent_id = self.test_create_automation(client)
        update_data = {
            "name": "Updated Name",
            "agent_id": agent_id,
            "cron": "0 9 * * *",
            "prompt": "Updated prompt",
        }
        resp = client.put(f"/api/automations/{auto_id}", json=update_data)
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated Name"
        assert resp.json()["cron"] == "0 9 * * *"

    def test_delete_automation(self, client):
        auto_id, _ = self.test_create_automation(client)
        resp = client.delete(f"/api/automations/{auto_id}")
        assert resp.status_code == 200
        # Verify it's gone
        resp = client.get(f"/api/automations/{auto_id}")
        assert resp.status_code == 404

    def test_delete_automation_not_found(self, client):
        resp = client.delete("/api/automations/nonexistent")
        assert resp.status_code == 404

    def test_toggle_automation(self, client):
        auto_id, _ = self.test_create_automation(client)
        # Created with enabled=True, toggle OFF
        resp = client.post(f"/api/automations/{auto_id}/toggle")
        assert resp.status_code == 200
        assert resp.json()["enabled"] is False
        # Toggle ON
        resp = client.post(f"/api/automations/{auto_id}/toggle")
        assert resp.status_code == 200
        assert resp.json()["enabled"] is True

    def test_toggle_automation_not_found(self, client):
        resp = client.post("/api/automations/nonexistent/toggle")
        assert resp.status_code == 404
