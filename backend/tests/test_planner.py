import asyncio
from types import SimpleNamespace
import pytest
from app.agents import planner


def test_ai_uses_structured_outputs_and_context(monkeypatch):
    captured = {}

    async def parse(**kwargs):
        captured.update(kwargs)
        return SimpleNamespace(output_parsed=planner.demo("binary search", None))

    class Client:
        def __init__(self, **kwargs):
            self.responses = SimpleNamespace(parse=parse)

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

    monkeypatch.setattr(planner, "AsyncOpenAI", Client)
    monkeypatch.setattr(planner.settings, "demo_mode", False)
    monkeypatch.setattr(planner.settings, "openai_api_key", "test-placeholder")
    monkeypatch.setattr(planner.settings, "openai_model", "gpt-6-luna")
    monkeypatch.setattr(planner.settings, "openai_reasoning_effort", "low")
    spec, mode = asyncio.run(
        planner.plan(
            "binary search",
            "Sorted inputs",
            [{"role": "user", "content": "Earlier question"}],
            None,
        )
    )
    assert mode == "ai"
    assert captured["text_format"] is planner.LessonSpec
    assert captured["model"] == "gpt-6-luna"
    assert captured["reasoning"] == {"effort": "low"}
    assert captured["max_output_tokens"] == 6000
    assert (
        "Sorted inputs" in captured["input"] and "Earlier question" in captured["input"]
    )
    assert spec.blocks


def test_missing_key_does_not_silently_demo(monkeypatch):
    monkeypatch.setattr(planner.settings, "demo_mode", False)
    monkeypatch.setattr(planner.settings, "openai_api_key", "")
    with pytest.raises(ValueError):
        asyncio.run(planner.plan("question", "", [], None))
