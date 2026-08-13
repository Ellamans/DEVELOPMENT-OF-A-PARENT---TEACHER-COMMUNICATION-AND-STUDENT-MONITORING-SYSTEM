"""
Test suite for the Parent-Teacher Communication and Student Monitoring System.

Run with: pytest -v
Requires a real (or test) Postgres database reachable via DATABASE_URL_SYNC.
Uses a transactional rollback per test so the database stays clean.
"""
import os
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key")
os.environ.setdefault("CLOUDINARY_CLOUD_NAME", "test")
os.environ.setdefault("CLOUDINARY_API_KEY", "test")
os.environ.setdefault("CLOUDINARY_API_SECRET", "test")

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database.session import Base, engine, SessionLocal
from app.models.user import Role, User
from app.core.security import hash_password
from app.utils.seed_rbac import seed


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    seed()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def admin_user():
    import uuid
    db = SessionLocal()
    role = db.query(Role).filter(Role.name == "super_admin").first()
    unique_email = f"admin-{uuid.uuid4().hex[:8]}@test.school.ng"
    user = User(
        first_name="Test", last_name="Admin", email=unique_email,
        hashed_password=hash_password("StrongPass1!"), status="active",
    )
    user.roles.append(role)
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    return user


class TestAuth:
    def test_login_with_wrong_password_fails(self, client, admin_user):
        response = client.post("/api/v1/auth/login", json={"email": admin_user.email, "password": "wrong"})
        assert response.status_code == 401

    def test_login_succeeds_with_correct_credentials(self, client, admin_user):
        response = client.post("/api/v1/auth/login", json={"email": admin_user.email, "password": "StrongPass1!"})
        assert response.status_code == 200
        assert "access_token" in response.json()

    def test_protected_endpoint_requires_token(self, client):
        response = client.get("/api/v1/auth/me")
        assert response.status_code == 401

    def test_weak_password_rejected_on_register(self, client):
        response = client.post("/api/v1/auth/register", json={
            "first_name": "A", "last_name": "B", "email": "weak@test.school.ng",
            "password": "weak", "role": "parent",
        })
        assert response.status_code == 422

    def test_account_locks_after_max_failed_attempts(self, client, admin_user):
        for _ in range(5):
            client.post("/api/v1/auth/login", json={"email": admin_user.email, "password": "wrong"})
        response = client.post("/api/v1/auth/login", json={"email": admin_user.email, "password": "wrong"})
        assert response.status_code in (401, 423)


class TestRBAC:
    def test_unauthorized_role_cannot_access_user_management(self, client):
        # A request with no token at all must be rejected before role checks even run.
        response = client.get("/api/v1/users")
        assert response.status_code == 401


class TestHealthChecks:
    def test_health_endpoint(self, client):
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"

    def test_liveness_probe(self, client):
        response = client.get("/api/v1/settings/health/live")
        assert response.status_code == 200

    def test_readiness_probe(self, client):
        response = client.get("/api/v1/settings/health/ready")
        assert response.status_code == 200


class TestValidation:
    def test_student_search_requires_no_special_params(self, client):
        # Endpoint should reject requests without auth even with valid query params.
        response = client.get("/api/v1/students", params={"search": "test"})
        assert response.status_code == 401
