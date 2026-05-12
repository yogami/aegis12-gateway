import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_sign_and_execute_success():
    """
    Test that a valid intent correctly returns a simulated TEE hardware signature
    and an Evidence Package.
    """
    payload = {
        "agent": {
            "id": "agent-123",
            "tenantId": "tenant-xyz",
            "currentTier": "T1"
        },
        "action": {
            "toolId": "solana_transfer",
            "parameters": {
                "to": "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
                "amount": 100_000_000,
            }
        },
        "context": {
            "timestamp": "2026-05-05T12:00:00Z",
            "currentAnomalyScore": 0.1
        }
    }

    response = client.post("/sign_and_execute", json=payload)
    assert response.status_code == 200
    data = response.json()
    
    assert data["status"] == "approved"
    assert "tx_hash" in data
    assert "evidence_package" in data
    assert "hardware_quote" in data
    assert "MOCK_TDX_QUOTE" in data["hardware_quote"]

def test_sign_and_execute_denied():
    """
    Test that a violating intent is denied and does not return a signature.
    """
    payload = {
        "agent": {
            "id": "agent-123",
            "tenantId": "tenant-xyz",
            "currentTier": "T1"
        },
        "action": {
            "toolId": "solana_transfer",
            "parameters": {
                "to": "ScamAddr1111111111111111111111111111111111111", # Blacklisted
                "amount": 100_000_000,
            }
        },
        "context": {
            "timestamp": "2026-05-05T12:00:00Z",
            "currentAnomalyScore": 0.1
        }
    }

    response = client.post("/sign_and_execute", json=payload)
    assert response.status_code == 403
    data = response.json()
    
    assert data["error"] == "Policy Violation"
    assert "reasoning" in data
    assert "blacklisted" in data["reasoning"].lower()
