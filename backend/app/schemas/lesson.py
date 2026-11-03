from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class DiagramNode(Strict):
    id: str = Field(pattern=r"^[a-zA-Z0-9_-]{1,24}$")
    label: str = Field(min_length=1, max_length=32)
    description: str = Field(max_length=500)


class DiagramEdge(Strict):
    source: str = Field(pattern=r"^[a-zA-Z0-9_-]{1,24}$")
    target: str = Field(pattern=r"^[a-zA-Z0-9_-]{1,24}$")
    label: str = Field(max_length=80)


class Block(Strict):
    kind: Literal[
        "ExplanationPanel",
        "StepByStepExplanation",
        "MathematicalEquation",
        "InteractiveGraph",
        "VariableSlider",
        "DataTable",
        "QuizComponent",
        "ProgressIndicator",
        "SimulationControls",
        "AlgorithmVisualizer",
        "SQLJoinVisualizer",
        "GradientDescentVisualizer",
        "ConceptDiagram",
        "ProcessFlow",
        "DecisionTree",
        "ComparisonMatrix",
        "Timeline",
    ]
    title: str = Field(max_length=180)
    text: str = Field(max_length=6000)
    items: list[str] = Field(max_length=30)
    values: list[float] = Field(max_length=50)
    parameter: float = Field(ge=-10000, le=10000)
    answer: int = Field(ge=0, le=29)
    nodes: list[DiagramNode] = Field(max_length=8)
    edges: list[DiagramEdge] = Field(max_length=16)
    source_refs: list[int] = Field(default_factory=list, max_length=8)

    @model_validator(mode="after")
    def valid(self):
        visual_graphs = {"ConceptDiagram", "ProcessFlow", "DecisionTree", "Timeline"}
        if self.kind in visual_graphs:
            ids = [node.id for node in self.nodes]
            if not 2 <= len(ids) <= 8 or len(set(ids)) != len(ids):
                raise ValueError("A visual needs 2–8 uniquely named nodes")
        if self.kind in {"ConceptDiagram", "ProcessFlow", "DecisionTree"} and (
            not self.edges
            or any(
                edge.source not in ids
                or edge.target not in ids
                or edge.source == edge.target
                for edge in self.edges
            )
        ):
            raise ValueError("Visual edges must connect two different registered nodes")
        if self.kind == "ProcessFlow":
            incoming = {node_id: 0 for node_id in ids}
            outgoing = {node_id: 0 for node_id in ids}
            for edge in self.edges:
                incoming[edge.target] += 1
                outgoing[edge.source] += 1
            if (
                sum(incoming.values()) != len(ids) - 1
                or sum(count == 0 for count in incoming.values()) != 1
                or any(value > 1 for value in incoming.values())
                or any(value > 1 for value in outgoing.values())
            ):
                raise ValueError("A process flow must be a single non-branching path")
            root = next(node_id for node_id, count in incoming.items() if count == 0)
            reached = {root}
            while True:
                children = {edge.target for edge in self.edges if edge.source in reached}
                if children <= reached:
                    break
                reached.update(children)
            if reached != set(ids):
                raise ValueError("A process flow must connect every step in order")
        if self.kind == "DecisionTree":
            incoming = {node_id: 0 for node_id in ids}
            outgoing = {node_id: 0 for node_id in ids}
            for edge in self.edges:
                incoming[edge.target] += 1
                outgoing[edge.source] += 1
            roots = [node_id for node_id, count in incoming.items() if count == 0]
            if (
                len(roots) != 1
                or any(value > 2 for value in outgoing.values())
                or any(value > 1 for value in incoming.values())
                or len(self.edges) != len(ids) - 1
            ):
                raise ValueError("A decision tree needs one root and at most two branches per node")
            reached = {roots[0]}
            while True:
                children = {edge.target for edge in self.edges if edge.source in reached}
                if children <= reached:
                    break
                reached.update(children)
            if reached != set(ids):
                raise ValueError("A decision tree must connect every node without cycles")
        if self.kind == "ComparisonMatrix":
            import json
            try:
                rows = json.loads(self.text)
            except ValueError as exc:
                raise ValueError("Comparison data must be JSON rows") from exc
            if (
                len(self.items) != 2
                or not isinstance(rows, list)
                or not 1 <= len(rows) <= 12
                or not all(
                    isinstance(row, list)
                    and len(row) == 3
                    and all(isinstance(cell, str) and len(cell) <= 500 for cell in row)
                    for row in rows
                )
            ):
                raise ValueError("Comparison requires two subjects and feature/value rows")
        if self.kind == "Timeline" and self.edges:
            raise ValueError("Timeline nodes are ordered directly and do not use edges")
        if (
            self.kind in {"VariableSlider", "ProgressIndicator"}
            and not 0 <= self.parameter <= 100
        ):
            raise ValueError("Slider and progress values must be 0–100")
        if self.kind == "DataTable":
            import json

            try:
                rows = json.loads(self.text)
            except ValueError as exc:
                raise ValueError("Table text must be JSON rows") from exc
            if (
                not self.items
                or not isinstance(rows, list)
                or len(rows) > 100
                or not all(
                    isinstance(r, list)
                    and len(r) == len(self.items)
                    and all(isinstance(c, (str, int, float)) or c is None for c in r)
                    for r in rows
                )
            ):
                raise ValueError("Table rows must match headers")
        if self.kind == "InteractiveGraph" and len(self.values) < 2:
            raise ValueError("A graph needs at least two numeric points")
        if self.kind == "QuizComponent" and (
            len(self.items) < 2 or self.answer >= len(self.items)
        ):
            raise ValueError("Quiz must have at least two options and a valid answer")
        if self.kind == "AlgorithmVisualizer" and (
            not self.values or self.values != sorted(self.values)
        ):
            raise ValueError("Binary search needs a nonempty sorted array")
        if (
            self.kind == "GradientDescentVisualizer"
            and not 0.01 <= self.parameter <= 1.2
        ):
            raise ValueError("Learning rate must be between 0.01 and 1.2")
        return self


class LessonSource(Strict):
    title: str = Field(min_length=1, max_length=240)
    url: str = Field(min_length=10, max_length=2000)


class VisualPlan(Strict):
    concept_type: Literal[
        "process", "system", "decision", "comparison", "timeline",
        "quantitative", "algorithm", "relationship", "other"
    ]
    form: Literal[
        "process_flow", "decision_tree", "comparison", "timeline",
        "concept_map", "chart", "table", "simulation"
    ]
    reason: str = Field(min_length=1, max_length=500)


class LessonSpec(Strict):
    title: str = Field(max_length=180)
    objective: str = Field(max_length=1000)
    difficulty: Literal["beginner", "intermediate", "advanced"]
    blocks: list[Block] = Field(min_length=1, max_length=12)
    notes_quote: str = Field(max_length=2000)
    sources: list[LessonSource] = Field(default_factory=list, max_length=8)
    visual_plan: VisualPlan | None = None

    @model_validator(mode="after")
    def visual_is_renderable(self):
        if self.visual_plan is None:
            return self
        expected = {
            "process_flow": {"ProcessFlow"},
            "decision_tree": {"DecisionTree"},
            "comparison": {"ComparisonMatrix"},
            "timeline": {"Timeline"},
            "concept_map": {"ConceptDiagram"},
            "chart": {"InteractiveGraph"},
            "table": {"DataTable"},
            "simulation": {
                "AlgorithmVisualizer", "SQLJoinVisualizer", "GradientDescentVisualizer"
            },
        }[self.visual_plan.form]
        if not any(block.kind in expected for block in self.blocks):
            raise ValueError(f"Visual plan {self.visual_plan.form} has no matching component")
        if any(ref < 0 or ref >= len(self.sources) for block in self.blocks for ref in block.source_refs):
            raise ValueError("A visual references a source that is not in the lesson")
        return self


class Question(Strict):
    question: str = Field(min_length=1, max_length=4000)
    notes: str | None = Field(default=None, max_length=20000)


class ActionEvent(Strict):
    name: Literal["explain_further"]
    surfaceId: str = Field(max_length=100)
    sourceComponentId: str = Field(pattern=r"^block-\d+$")
    timestamp: str = Field(max_length=40)
    context: dict[str, str | float | bool]


class ActionEnvelope(Strict):
    version: Literal["v0.9.1"]
    action: ActionEvent


class Progress(Strict):
    component_id: str = Field(pattern=r"^block-\d+$")
    state: dict[str, str | float | bool | list[float]]

    @model_validator(mode="after")
    def bounded(self):
        import json

        if len(json.dumps(self.state)) > 4000:
            raise ValueError("State exceeds 4000 characters")
        if set(self.state) - {
            "step",
            "target",
            "array",
            "rate",
            "join",
            "answer",
            "value",
        }:
            raise ValueError("Unknown state field")
        return self
