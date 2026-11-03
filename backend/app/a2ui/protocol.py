import json
from pathlib import Path
from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from app.schemas.lesson import Block, LessonSpec

CATALOG_ID = "urn:a2ui-learning-lab:education:v1"
SCHEMA_DIR = Path(__file__).parent / "schemas"


def catalog():
    block_schema = Block.model_json_schema()
    props = block_schema["properties"].copy()
    kinds = props.pop("kind")["enum"]
    components = {}
    for kind in kinds:
        components[kind] = {
            "type": "object",
            "properties": {
                "id": {"type": "string"},
                "component": {"const": kind},
                **props,
            },
            "required": ["id", "component", *props],
            "additionalProperties": False,
        }
    components["Column"] = {
        "type": "object",
        "properties": {
            "id": {"type": "string"},
            "component": {"const": "Column"},
            "children": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["id", "component", "children"],
        "additionalProperties": False,
    }
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": "https://a2ui.org/specification/v0_9/catalog.json",
        "catalogId": CATALOG_ID,
        "components": components,
        "$defs": {
            **block_schema.get("$defs", {}),
            "anyComponent": {"oneOf": list(components.values())},
            "anyFunction": False,
            "theme": {"type": "object", "additionalProperties": False},
        },
    }


def validator():
    docs = [
        json.loads((SCHEMA_DIR / name).read_text())
        for name in ["server_to_client.json", "common_types.json"]
    ] + [catalog()]
    registry = Registry().with_resources(
        (d["$id"], Resource.from_contents(d)) for d in docs
    )
    return Draft202012Validator(docs[0], registry=registry)


def messages(spec: LessonSpec, surface_id: str, progress=None, create=True):
    result = []
    if create:
        result.append(
            {
                "version": "v0.9.1",
                "createSurface": {"surfaceId": surface_id, "catalogId": CATALOG_ID},
            }
        )
    components = [
        {
            "id": "root",
            "component": "Column",
            "children": [f"block-{i}" for i in range(len(spec.blocks))],
        }
    ]
    components += [
        {"id": f"block-{i}", "component": b.kind, **b.model_dump(exclude={"kind"})}
        for i, b in enumerate(spec.blocks)
    ]
    result += [
        {
            "version": "v0.9.1",
            "updateComponents": {"surfaceId": surface_id, "components": components},
        },
        {
            "version": "v0.9.1",
            "updateDataModel": {
                "surfaceId": surface_id,
                "path": "/",
                "value": {"progress": progress or {}, "title": spec.title},
            },
        },
    ]
    for message in result:
        validator().validate(message)
    return result


def delete(surface_id):
    message = {"version": "v0.9.1", "deleteSurface": {"surfaceId": surface_id}}
    validator().validate(message)
    return message
