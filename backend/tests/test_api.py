import os

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["DEMO_MODE"] = "true"
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.main import app
from app.db.models import Base, get_db
from app.a2ui.protocol import validator
from app.schemas.lesson import LessonSpec


@pytest.fixture
def client():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False)

    def db():
        with factory() as session:
            yield session

    app.dependency_overrides[get_db] = db
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()
    engine.dispose()


@pytest.mark.parametrize(
    "question,kind",
    [
        ("binary search", "AlgorithmVisualizer"),
        ("SQL joins", "SQLJoinVisualizer"),
        ("gradient descent", "GradientDescentVisualizer"),
        ("Explain transformer attention using a visual", "ConceptDiagram"),
    ],
)
def test_lessons(client, question, kind):
    cid = client.post("/api/v1/conversations").json()["id"]
    result = client.post(
        f"/api/v1/conversations/{cid}/questions",
        json={"question": question, "notes": "My lecture notes"},
    ).json()
    assert result["mode"] == "demo"
    assert any(b["kind"] == kind for b in result["spec"]["blocks"])
    for message in result["messages"]:
        validator().validate(message)
    saved = client.get(f"/api/v1/conversations/{cid}").json()
    assert saved["notes"] == "My lecture notes"
    assert saved["lesson"]["id"] == result["id"]
    assert len(saved["messages"]) == 2


def test_followup_progress_delete(client):
    cid = client.post("/api/v1/conversations").json()["id"]
    first = client.post(
        f"/api/v1/conversations/{cid}/questions", json={"question": "binary search"}
    ).json()
    lid = first["id"]
    assert (
        client.put(
            f"/api/v1/lessons/{lid}/progress",
            json={"component_id": "block-1", "state": {"target": 999, "step": 2}},
        ).status_code
        == 200
    )
    assert (
        client.get(f"/api/v1/lessons/{lid}").json()["progress"]["block-1"]["target"]
        == 999
    )
    second = client.post(
        f"/api/v1/conversations/{cid}/questions",
        json={"question": "What if the target doesn't exist?"},
    ).json()
    assert second["id"] == lid and second["revision"] == 2
    assert "createSurface" not in second["messages"][0]
    assert second["spec"]["blocks"][1]["parameter"] > max(
        second["spec"]["blocks"][1]["values"]
    )
    assert (
        client.delete(f"/api/v1/lessons/{lid}").json()["deleteSurface"]["surfaceId"]
        == lid
    )


def test_validation_and_fallback(client):
    assert client.get("/api/v1/health").json()["status"] == "healthy"
    assert client.get("/api/v1/conversations/missing").status_code == 404
    cid = client.post("/api/v1/conversations").json()["id"]
    assert (
        client.post(
            f"/api/v1/conversations/{cid}/questions", json={"question": ""}
        ).status_code
        == 422
    )
    r = client.post(
        f"/api/v1/conversations/{cid}/questions?stream=true",
        json={"question": "photosynthesis"},
    )
    assert "event: a2ui" in r.text and "Demo mode limitation" in r.text
    assert (
        client.post(
            f"/api/v1/conversations/{cid}/actions",
            json={"action": {"name": "execute_code"}},
        ).status_code
        == 422
    )


def test_unknown_component_rejected():
    with pytest.raises(Exception):
        validator().validate(
            {
                "version": "v0.9.1",
                "updateComponents": {
                    "surfaceId": "x",
                    "components": [
                        {"id": "root", "component": "Script", "text": "alert(1)"}
                    ],
                },
            }
        )


def test_topic_change_and_action(client):
    cid = client.post("/api/v1/conversations").json()["id"]
    first = client.post(
        f"/api/v1/conversations/{cid}/questions", json={"question": "binary search"}
    ).json()
    changed = client.post(
        f"/api/v1/conversations/{cid}/questions", json={"question": "gradient descent"}
    ).json()
    assert "deleteSurface" in changed["messages"][0]
    assert "createSurface" in changed["messages"][1]
    action = {
        "version": "v0.9.1",
        "action": {
            "name": "explain_further",
            "surfaceId": first["id"],
            "sourceComponentId": "block-0",
            "timestamp": "2026-11-02T00:00:00Z",
            "context": {},
        },
    }
    assert (
        client.post(f"/api/v1/conversations/{cid}/actions", json=action).status_code
        == 200
    )


def test_progress_and_body_limits(client):
    cid = client.post("/api/v1/conversations").json()["id"]
    result = client.post(
        f"/api/v1/conversations/{cid}/questions", json={"question": "gradient descent"}
    ).json()
    assert (
        client.put(
            "/api/v1/lessons/" + result["id"] + "/progress",
            json={"component_id": "block-2", "state": {"rate": 500}},
        ).status_code
        == 422
    )
    assert (
        client.post(
            f"/api/v1/conversations/{cid}/questions", content="x" * 100001
        ).status_code
        == 413
    )


def test_existing_saved_lessons_restore_after_new_diagram_fields(client):
    cid = client.post("/api/v1/conversations").json()["id"]
    result = client.post(
        f"/api/v1/conversations/{cid}/questions", json={"question": "binary search"}
    ).json()
    lesson = client.get(f"/api/v1/lessons/{result['id']}")
    assert lesson.status_code == 200
    assert lesson.json()["spec"]["blocks"][0]["nodes"] == []
