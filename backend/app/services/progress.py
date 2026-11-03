import math


def validate_state(block, state):
    allowed = {
        "AlgorithmVisualizer": {"array", "target", "step"},
        "GradientDescentVisualizer": {"rate", "step"},
        "SQLJoinVisualizer": {"join"},
        "QuizComponent": {"answer"},
        "VariableSlider": {"value"},
        "SimulationControls": {"step"},
    }.get(block["kind"], set())
    if set(state) - allowed:
        raise ValueError("State fields do not match this component")
    for key, value in state.items():
        if key == "join":
            if value not in ("INNER", "LEFT"):
                raise ValueError("Invalid join type")
        elif key == "array":
            if (
                not isinstance(value, list)
                or not 1 <= len(value) <= 50
                or not all(
                    isinstance(v, (float, int)) and math.isfinite(v) for v in value
                )
                or value != sorted(value)
            ):
                raise ValueError("Expected 1–50 sorted finite numbers")
        elif not isinstance(value, (int, float)) or not math.isfinite(value):
            raise ValueError("Expected a finite number")
        elif key == "rate" and not 0.01 <= value <= 1.2:
            raise ValueError("Learning rate must be 0.01–1.2")
        elif key == "step" and (value != int(value) or not 0 <= value <= 50):
            raise ValueError("Invalid simulation step")
        elif key == "answer" and (
            value != int(value) or not 0 <= value < len(block["items"])
        ):
            raise ValueError("Invalid quiz option")
        elif key == "value" and not 0 <= value <= 100:
            raise ValueError("Slider value must be 0–100")
