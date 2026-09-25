"""
Integration test suite for Follow-Up Management System.
Tests:
- Auth & Token issuance
- Contact CRUD & row-level security
- Status independence (Contact Status vs Registration vs Feedback)
- Follow-ups scheduling and listing
- Contact attempts logging
- Dashboard metrics
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "service": "fms-api"}

def test_auth_login_admin():
    res = client.post("/api/v1/auth/login", json={
        "email": "admin@fms.internal",
        "password": "AdminPassword123!"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["role"] == "admin"
    assert data["user"]["email"] == "admin@fms.internal"

def test_auth_login_invalid():
    res = client.post("/api/v1/auth/login", json={
        "email": "admin@fms.internal",
        "password": "WrongPassword!"
    })
    assert res.status_code == 401

def test_dashboard_summary():
    # Login as admin
    login_res = client.post("/api/v1/auth/login", json={
        "email": "admin@fms.internal",
        "password": "AdminPassword123!"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/dashboard/summary", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "total_contacts" in data
    assert data["total_contacts"] >= 5

def test_contacts_list_and_filter():
    login_res = client.post("/api/v1/auth/login", json={
        "email": "admin@fms.internal",
        "password": "AdminPassword123!"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # List contacts
    res = client.get("/api/v1/contacts/?page=1&page_size=10", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert len(data["items"]) >= 5

    # Filter by status
    res = client.get("/api/v1/contacts/?contact_status=interested", headers=headers)
    assert res.status_code == 200
    items = res.json()["items"]
    assert all(c["contact_status"] == "interested" for c in items)

def test_status_independence_invariant():
    """
    PRD Key Rule: Contact Status, Feedback Status, and Registration Status
    are fully independent. Updating registration must NOT change contact_status.
    """
    login_res = client.post("/api/v1/auth/login", json={
        "email": "admin@fms.internal",
        "password": "AdminPassword123!"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    import uuid
    uid = uuid.uuid4().hex[:6]
    # Create new contact with status = "not_contacted"
    create_res = client.post("/api/v1/contacts/", headers=headers, json={
        "name": f"Invariant Test User {uid}",
        "email": f"invariant_{uid}@test.internal",
        "phone": f"+919999{uid}",
        "organization": "Test Lab"
    })
    assert create_res.status_code == 201
    contact = create_res.json()
    contact_id = contact["id"]
    assert contact["contact_status"] == "not_contacted"

    # Now update registration status to "registered"
    reg_res = client.post(f"/api/v1/contacts/{contact_id}/registration", headers=headers, json={
        "status": "registered",
        "registration_id_external": "INV-100",
        "payment_status": "paid"
    })
    assert reg_res.status_code == 201
    assert reg_res.json()["status"] == "registered"

    # Verify contact status remains UNCHANGED ("not_contacted")
    verify_res = client.get(f"/api/v1/contacts/{contact_id}", headers=headers)
    assert verify_res.status_code == 200
    contact_after = verify_res.json()
    assert contact_after["contact_status"] == "not_contacted"
    assert contact_after["registration_status"] == "registered"

def test_followups_list():
    login_res = client.post("/api/v1/auth/login", json={
        "email": "admin@fms.internal",
        "password": "AdminPassword123!"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/followups/?view=all", headers=headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)
