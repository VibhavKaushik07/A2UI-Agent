import { useEffect, useId, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceDot,
} from "recharts";
import {
  binarySearch,
  descent,
  join,
  customers,
  orders,
} from "../simulations/engines";
import type { BlockProps, State } from "../types/lesson";
export interface ComponentProps {
  data: BlockProps;
  initial: State;
  save: (s: State) => void;
}
export function SimulationControls({
  step,
  total,
  playing,
  setStep,
  setPlaying,
}: {
  step: number;
  total: number;
  playing: boolean;
  setStep: (n: number) => void;
  setPlaying: (v: boolean) => void;
}) {
  return (
    <div className="controls">
      <button
        onClick={() => {
          setPlaying(false);
          setStep(0);
        }}
      >
        Reset
      </button>
      <button
        disabled={!step}
        onClick={() => {
          setPlaying(false);
          setStep(step - 1);
        }}
      >
        Previous
      </button>
      <button
        className="primary"
        onClick={() => {
          if (step === total - 1) setStep(0);
          setPlaying(!playing);
        }}
      >
        {playing ? "Pause" : "Play"}
      </button>
      <button
        disabled={step >= total - 1}
        onClick={() => {
          setPlaying(false);
          setStep(step + 1);
        }}
      >
        Next
      </button>
      <span>
        Step {step + 1} / {total}
      </span>
    </div>
  );
}
function usePlayback(total: number, initial = 0) {
  const [step, setStep] = useState(Math.max(0, Math.min(total - 1, initial)));
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () =>
        setStep((s) => {
          if (s >= total - 1) {
            setPlaying(false);
            return s;
          }
          return s + 1;
        }),
      850,
    );
    return () => clearInterval(timer);
  }, [playing, total]);
  return { step, setStep, playing, setPlaying, total };
}
export function AlgorithmVisualizer({ data, initial, save }: ComponentProps) {
  const [array, setArray] = useState<number[]>(
    Array.isArray(initial.array)
      ? initial.array
      : [...data.values].sort((a, b) => a - b),
  );
  const [draft, setDraft] = useState(array.join(", "));
  const [target, setTarget] = useState(
    Number(initial.target ?? data.parameter),
  );
  const [error, setError] = useState("");
  const steps = useMemo(() => binarySearch(array, target), [array, target]);
  const play = usePlayback(steps.length, Number(initial.step ?? 0));
  const s = steps[Math.min(play.step, steps.length - 1)];
  useEffect(
    () => save({ array, target, step: play.step }),
    [array, target, play.step],
  );
  const reset = () => {
    play.setStep(0);
    play.setPlaying(false);
  };
  return (
    <>
      <div className="input-row">
        <label>
          Sorted array
          <input value={draft} onChange={(e) => setDraft(e.target.value)} />
        </label>
        <button
          onClick={() => {
            try {
              const a = draft.split(",").map((s) => {
                if (!s.trim()) throw Error("Empty value");
                return Number(s);
              });
              binarySearch(a, target);
              setArray(a);
              reset();
              setError("");
            } catch (e) {
              setError(String(e));
            }
          }}
        >
          Apply array
        </button>
        <label>
          Target
          <input
            type="number"
            value={target}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) {
                setTarget(n);
                reset();
              }
            }}
          />
        </label>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="array">
        {array.map((n, i) => (
          <div
            key={i}
            className={
              i === s.mid
                ? "cell middle"
                : i < s.left || i > s.right
                  ? "cell discarded"
                  : "cell"
            }
          >
            <small>
              {[
                i === s.left ? "L" : "",
                i === s.mid ? "M" : "",
                i === s.right ? "R" : "",
              ]
                .filter(Boolean)
                .join(" · ") || " "}
            </small>
            <strong>{n}</strong>
            <small>index {i}</small>
          </div>
        ))}
      </div>
      <p className="step-text" aria-live="polite">
        {s.text}
      </p>
      <SimulationControls {...play} />
      <pre>
        {[
          "while left ≤ right:",
          "  mid = floor((left + right) / 2)",
          "  if a[mid] == target: return mid",
          "  if a[mid] < target: left = mid + 1",
          "  else: right = mid - 1",
          "return not found",
        ].map((line, i) => (
          <div key={i} className={i === s.line ? "active-code" : ""}>
            {line}
          </div>
        ))}
      </pre>
      <p className="hint">
        L = left boundary · M = midpoint · R = right boundary. All steps run
        locally.
      </p>
    </>
  );
}
export function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | number | null)[][];
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={r.includes(null) ? "unmatched" : ""}>
              {r.map((c, j) => (
                <td key={j}>{c === null ? <em>NULL</em> : c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function SQLJoinVisualizer({ initial, save }: ComponentProps) {
  const [type, setType] = useState<"INNER" | "LEFT">(
    initial.join === "LEFT" ? "LEFT" : "INNER",
  );
  const result = join(customers, orders, type);
  return (
    <>
      <div className="two-columns">
        <div>
          <h3>Customers · left</h3>
          <DataTable
            headers={["id", "name"]}
            rows={customers.map((c) => [c.id, c.name])}
          />
        </div>
        <div>
          <h3>Orders · right</h3>
          <DataTable
            headers={["customer_id", "item"]}
            rows={orders.map((o) => [o.customerId, o.item])}
          />
        </div>
      </div>
      <div className="controls">
        {(["INNER", "LEFT"] as const).map((t) => (
          <button
            aria-pressed={type === t}
            className={type === t ? "primary" : ""}
            key={t}
            onClick={() => {
              setType(t);
              save({ join: t });
            }}
          >
            {t} JOIN
          </button>
        ))}
      </div>
      <pre>
        SELECT customers.name, orders.item{String.fromCharCode(10)}FROM
        customers {type} JOIN orders{String.fromCharCode(10)}ON customers.id =
        orders.customer_id;
      </pre>
      <DataTable
        headers={["id", "name", "item"]}
        rows={result.map((r) => [r.id, r.name, r.item])}
      />
      <p aria-live="polite">
        {result.length} result rows.{" "}
        {type === "LEFT"
          ? "Ben is preserved with a NULL item."
          : "Ben is excluded because no order matches."}{" "}
        Asha has two matching orders.
      </p>
    </>
  );
}
export function GradientDescentVisualizer({
  initial,
  data,
  save,
}: ComponentProps) {
  const [rate, setRate] = useState(Number(initial.rate ?? data.parameter));
  const steps = useMemo(() => descent(rate), [rate]);
  const play = usePlayback(steps.length, Number(initial.step ?? 0));
  const current = steps[Math.min(play.step, steps.length - 1)];
  useEffect(() => save({ rate, step: play.step }), [rate, play.step]);
  const bound = Math.max(5, Math.abs(current.x) * 1.1);
  const curve = Array.from({ length: 101 }, (_, i) => {
    const x = -bound + (2 * bound * i) / 100;
    return { x, loss: x * x };
  });
  return (
    <>
      <label>
        Learning rate α: {rate.toFixed(2)}
        <input
          type="range"
          min="0.01"
          max="1.2"
          step="0.01"
          value={rate}
          onChange={(e) => {
            setRate(Number(e.target.value));
            play.setStep(0);
            play.setPlaying(false);
          }}
        />
      </label>
      <div
        role="group"
        aria-label={
          "Loss curve x squared. Current x " +
          current.x.toFixed(3) +
          "; loss " +
          current.loss.toFixed(3)
        }
        className="graph"
      >
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={curve}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="x"
              type="number"
              domain={[-bound, bound]}
              tickFormatter={(v) => Number(v).toFixed(1)}
            />
            <YAxis />
            <Tooltip />
            <Line
              dataKey="loss"
              dot={false}
              stroke="#6366f1"
              strokeWidth={3}
              isAnimationActive={false}
            />
            <ReferenceDot
              x={current.x}
              y={current.loss}
              r={7}
              fill="#f59e0b"
              stroke="white"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="step-text" aria-live="polite">
        Iteration {current.iteration}: x = {current.x.toFixed(4)} · loss ={" "}
        {current.loss.toFixed(4)}.{" "}
        {rate > 1
          ? "Diverging: each step increases the distance from zero."
          : rate === 1
            ? "Oscillating: the magnitude stays constant."
            : rate > 0.5
              ? "Overshooting zero, but converging."
              : "Converging toward zero."}
      </p>
      <SimulationControls {...play} />
      <p className="hint">
        Deterministic example: L(x) = x², x₀ = 4. Stability thresholds depend on
        the loss function.
      </p>
    </>
  );
}
export function QuizComponent({ data, initial, save }: ComponentProps) {
  const [answer, setAnswer] = useState<number | null>(
    typeof initial.answer === "number" ? initial.answer : null,
  );
  return (
    <>
      <p>{data.text}</p>
      <div className="quiz">
        {data.items.map((item, i) => (
          <button
            key={i}
            aria-pressed={answer === i}
            onClick={() => {
              setAnswer(i);
              save({ answer: i });
            }}
          >
            {String.fromCharCode(65 + i)} · {item}
          </button>
        ))}
      </div>
      {answer !== null && (
        <p role="status">
          {answer === data.answer
            ? "Correct. Well done!"
            : "Try again—review the lesson above."}
        </p>
      )}
    </>
  );
}
function GuidedPlayback({ data, initial, save }: ComponentProps) {
  const play = usePlayback(
    Math.max(1, data.items.length),
    Number(initial.step ?? 0),
  );
  useEffect(() => save({ step: play.step }), [play.step]);
  return (
    <>
      <p aria-live="polite">{data.items[play.step] ?? data.text}</p>
      <SimulationControls {...play} />
    </>
  );
}
export function VariableSlider({ data, initial, save }: ComponentProps) {
  const [v, setV] = useState(Number(initial.value ?? data.parameter));
  return (
    <label>
      {data.text} {v}
      <input
        type="range"
        min="0"
        max="100"
        value={v}
        onChange={(e) => {
          setV(+e.target.value);
          save({ value: +e.target.value });
        }}
      />
    </label>
  );
}
export function ConceptDiagram({ data }: ComponentProps) {
  const markerId = `concept-arrow-${useId().replace(/:/g, "")}`;
  const [selected, setSelected] = useState(
    data.nodes.find((n) => n.id === "it")?.id ?? data.nodes[0]?.id ?? "",
  );
  if (
    data.nodes.length < 2 ||
    data.edges.some(
      (e) =>
        !data.nodes.some((n) => n.id === e.source) ||
        !data.nodes.some((n) => n.id === e.target),
    )
  )
    return <p role="alert">Diagram relationships are invalid.</p>;
  const positions = data.nodes.map((node, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / data.nodes.length;
    return {
      node,
      x: 400 + 255 * Math.cos(angle),
      y: 220 + 165 * Math.sin(angle),
    };
  });
  const byId = new Map(positions.map((p) => [p.node.id, p]));
  return (
    <div className="concept-diagram">
      {data.text && <p className="hint">{data.text}</p>}
      <svg
        viewBox="0 0 800 440"
        role="group"
        aria-label="Interactive concept map. Select a node to inspect its relationships."
      >
        <defs>
          <marker
            id={markerId}
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
          >
            <path d="M0,0 L8,4 L0,8 z" fill="#8c82c9" />
          </marker>
        </defs>
        {data.edges.map((edge, i) => {
          const a = byId.get(edge.source)!,
            b = byId.get(edge.target)!;
          const active = selected === edge.source || selected === edge.target;
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={active ? "#665bd4" : "#c9c7d8"}
              strokeWidth={active ? 3 : 1.5}
              markerEnd={`url(#${markerId})`}
            />
          );
        })}
        {positions.map(({ node, x, y }) => (
          <g
            key={node.id}
            role="button"
            aria-label={node.label}
            aria-pressed={selected === node.id}
            tabIndex={0}
            onClick={() => setSelected(node.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSelected(node.id);
              }
            }}
            style={{ cursor: "pointer" }}
          >
            <circle
              cx={x}
              cy={y}
              r={47}
              fill={selected === node.id ? "#665bd4" : "#f0eeff"}
              stroke={selected === node.id ? "#5145b5" : "#a9a0d8"}
              strokeWidth="2"
            />
            <text
              x={x}
              y={y + 5}
              textAnchor="middle"
              fontSize="14"
              fontWeight="600"
              fill={selected === node.id ? "white" : "#4d456f"}
            >
              {node.label}
            </text>
          </g>
        ))}
      </svg>
      <div className="diagram-details" aria-live="polite">
        <strong>{byId.get(selected)?.node.label}</strong>
        <span>{byId.get(selected)?.node.description}</span>
      </div>
      <ul className="diagram-links">
        {data.edges
          .filter((e) => e.source === selected || e.target === selected)
          .map((e, i) => (
            <li key={i}>
              <b>{byId.get(e.source)?.node.label}</b> →{" "}
              <b>{byId.get(e.target)?.node.label}</b>
              <span>{e.label}</span>
            </li>
          ))}
      </ul>
    </div>
  );
}

function orderedPath(data: BlockProps) {
  const incoming = new Set(data.edges.map((edge) => edge.target));
  const first = data.nodes.find((node) => !incoming.has(node.id))?.id;
  const path: BlockProps["nodes"] = [];
  let current = first;
  while (current && path.length < data.nodes.length) {
    const node = data.nodes.find((item) => item.id === current);
    if (!node) break;
    path.push(node);
    current = data.edges.find((edge) => edge.source === current)?.target;
  }
  return path;
}

export function ProcessFlow({ data, initial, save }: ComponentProps) {
  const path = useMemo(() => orderedPath(data), [data]);
  const playback = usePlayback(path.length, Number(initial.step ?? 0));
  const selected = path[playback.step];
  useEffect(() => save({ step: playback.step }), [playback.step]);
  if (path.length !== data.nodes.length)
    return <p role="alert">This process flow is incomplete.</p>;
  return (
    <div className="visual-flow">
      {data.text && <p className="visual-intro">{data.text}</p>}
      <ol className="flow-track" aria-label="Process steps">
        {path.map((node, index) => (
          <li key={node.id}>
            {index > 0 && <span className="flow-arrow" aria-hidden="true">→</span>}
            <button
              className={index === playback.step ? "flow-step active" : "flow-step"}
              aria-current={index === playback.step ? "step" : undefined}
              onClick={() => {
                playback.setPlaying(false);
                playback.setStep(index);
              }}
            >
              <span className="flow-number">{index + 1}</span>
              <strong>{node.label}</strong>
            </button>
          </li>
        ))}
      </ol>
      <div className="visual-detail" aria-live="polite">
        <span>STEP {playback.step + 1}</span>
        <strong>{selected?.label}</strong>
        <p>{selected?.description}</p>
      </div>
      <SimulationControls {...playback} />
    </div>
  );
}

export function Timeline({ data, initial, save }: ComponentProps) {
  const [selected, setSelected] = useState(
    Math.max(0, Math.min(data.nodes.length - 1, Number(initial.step ?? 0))),
  );
  const node = data.nodes[selected];
  useEffect(() => save({ step: selected }), [selected]);
  if (data.nodes.length < 2)
    return <p role="alert">This timeline needs at least two events.</p>;
  return (
    <div className="timeline">
      {data.text && <p className="visual-intro">{data.text}</p>}
      <div className="timeline-rail" role="group" aria-label="Timeline events">
        {data.nodes.map((event, index) => (
          <button
            key={event.id}
            className={index === selected ? "timeline-event active" : "timeline-event"}
            aria-pressed={index === selected}
            onClick={() => setSelected(index)}
          >
            <span className="timeline-dot" />
            <strong>{event.label}</strong>
            <small>Event {index + 1}</small>
          </button>
        ))}
      </div>
      <div className="visual-detail" aria-live="polite">
        <span>EVENT {selected + 1} OF {data.nodes.length}</span>
        <strong>{node?.label}</strong>
        <p>{node?.description}</p>
      </div>
      <div className="controls">
        <button disabled={selected === 0} onClick={() => setSelected((v) => v - 1)}>Previous event</button>
        <button disabled={selected === data.nodes.length - 1} onClick={() => setSelected((v) => v + 1)}>Next event</button>
        <span>{selected + 1} / {data.nodes.length}</span>
      </div>
    </div>
  );
}

export function ComparisonMatrix({ data }: ComponentProps) {
  const [focus, setFocus] = useState<"both" | "left" | "right">("both");
  let rows: string[][];
  try {
    rows = JSON.parse(data.text);
  } catch {
    return <p role="alert">Comparison data is unavailable.</p>;
  }
  if (data.items.length !== 2 || !Array.isArray(rows))
    return <p role="alert">This comparison is invalid.</p>;
  return (
    <div className="comparison-visual">
      <p className="visual-intro">Select a side to focus on its differences, or compare both together.</p>
      <div className="comparison-switch" role="group" aria-label="Focus comparison">
        <button aria-pressed={focus === "both"} onClick={() => setFocus("both")}>Both</button>
        <button aria-pressed={focus === "left"} onClick={() => setFocus("left")}>{data.items[0]}</button>
        <button aria-pressed={focus === "right"} onClick={() => setFocus("right")}>{data.items[1]}</button>
      </div>
      <div className="table-wrap">
        <table className="comparison-table">
          <thead><tr><th>Feature</th><th className={focus === "right" ? "dimmed" : ""}>{data.items[0]}</th><th className={focus === "left" ? "dimmed" : ""}>{data.items[1]}</th></tr></thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, column) => (
                  <td key={column} className={column === 1 && focus === "right" || column === 2 && focus === "left" ? "dimmed" : ""}>
                    {column === 0 ? <strong>{cell}</strong> : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DecisionTree({ data, initial, save }: ComponentProps) {
  const markerId = `tree-arrow-${useId().replace(/:/g, "")}`;
  const children = useMemo(() => {
    const result = new Map<string, { id: string; label: string }[]>();
    for (const edge of data.edges) {
      result.set(edge.source, [...(result.get(edge.source) ?? []), { id: edge.target, label: edge.label }]);
    }
    return result;
  }, [data.edges]);
  const root = data.nodes.find((node) => !data.edges.some((edge) => edge.target === node.id));
  const [selected, setSelected] = useState(String(initial.selected ?? root?.id ?? ""));
  const layout = useMemo(() => {
    if (!root) return [];
    let leafCursor = 0;
    const leafCount = (id: string): number => {
      const next = children.get(id) ?? [];
      return next.length ? next.reduce((sum, item) => sum + leafCount(item.id), 0) : 1;
    };
    const totalLeaves = leafCount(root.id);
    const placed: { node: BlockProps["nodes"][number]; x: number; y: number }[] = [];
    const place = (id: string, depth: number): number => {
      const node = data.nodes.find((item) => item.id === id)!;
      const next = children.get(id) ?? [];
      let x: number;
      if (!next.length) {
        x = 64 + leafCursor * (672 / Math.max(1, totalLeaves - 1));
        leafCursor += 1;
      } else {
        const childXs = next.map((child) => place(child.id, depth + 1));
        x = childXs.reduce((sum, value) => sum + value, 0) / childXs.length;
      }
      if (next.length === 0) placed.push({ node, x, y: 46 + depth * 112 });
      else placed.push({ node, x, y: 46 + depth * 112 });
      return x;
    };
    place(root.id, 0);
    return placed;
  }, [data.nodes, children, root]);
  useEffect(() => save({ selected }), [selected]);
  if (!root || layout.length !== data.nodes.length)
    return <p role="alert">This decision tree is incomplete.</p>;
  const positions = new Map(layout.map((item) => [item.node.id, item]));
  const parent = new Map(data.edges.map((edge) => [edge.target, edge.source]));
  const path = new Set<string>();
  let trace: string | undefined = selected;
  while (trace) {
    if (path.has(trace)) break;
    path.add(trace);
    trace = parent.get(trace);
  }
  const current = data.nodes.find((node) => node.id === selected) ?? root;
  const options = (children.get(current.id) ?? []).map((item) => ({
    ...item,
    node: data.nodes.find((node) => node.id === item.id)!,
  }));
  const maxDepth = Math.max(...layout.map((item) => item.y));
  return (
    <div className="decision-tree">
      {data.text && <p className="visual-intro">{data.text}</p>}
      <div className="tree-scroll">
        <svg viewBox={`0 0 800 ${maxDepth + 105}`} role="group" aria-label="Interactive decision tree. Follow a branch or select a node to inspect it.">
          <defs><marker id={markerId} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#739886" /></marker></defs>
          {data.edges.map((edge, index) => {
            const from = positions.get(edge.source)!;
            const to = positions.get(edge.target)!;
            const active = path.has(edge.source) && path.has(edge.target);
            return <g key={index}>
              <path d={`M ${from.x + 2} ${from.y + 27} C ${from.x + 2} ${from.y + 62}, ${to.x + 2} ${to.y - 62}, ${to.x + 2} ${to.y - 30}`} fill="none" stroke={active ? "#28745f" : "#c6d5ca"} strokeWidth={active ? 3 : 1.6} markerEnd={`url(#${markerId})`} />
              <text x={(from.x + to.x) / 2 + 6} y={(from.y + to.y) / 2 - 3} className="tree-edge-label">{edge.label}</text>
            </g>;
          })}
          {layout.map(({ node, x, y }) => {
            const terminal = !(children.get(node.id)?.length);
            return <g key={node.id} role="button" tabIndex={0} aria-label={`${node.label}${terminal ? ", result" : ", decision"}`} aria-pressed={selected === node.id} onClick={() => setSelected(node.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(node.id); } }} className="tree-node" style={{ cursor: "pointer" }}>
              <rect x={x - 66} y={y - 27} width="132" height="54" rx={terminal ? 25 : 10} className={`${terminal ? "tree-result" : "tree-question"} ${selected === node.id ? "chosen" : ""}`} />
              <text x={x} y={y + 4} textAnchor="middle" className="tree-node-text">{node.label}</text>
            </g>;
          })}
        </svg>
      </div>
      <div className="visual-detail" aria-live="polite">
        <span>{options.length ? "DECISION POINT" : "RESULT"}</span>
        <strong>{current.label}</strong>
        <p>{current.description}</p>
        {!!options.length && <div className="branch-options">{options.map((option) => <button key={option.id} onClick={() => setSelected(option.id)}><span>{option.label}</span><strong>{option.node.label}</strong></button>)}</div>}
        {!options.length && <button className="tree-reset" onClick={() => setSelected(root.id)}>Start over</button>}
      </div>
    </div>
  );
}

export const registry: Record<string, (p: ComponentProps) => React.ReactNode> =
  {
    ExplanationPanel: ({ data }) => <p className="prose">{data.text}</p>,
    StepByStepExplanation: ({ data }) => (
      <ol>
        {data.items.map((v, i) => (
          <li key={i}>{v}</li>
        ))}
      </ol>
    ),
    MathematicalEquation: ({ data }) => (
      <div className="equation">{data.text}</div>
    ),
    InteractiveGraph: ({ data }) => (
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data.values.map((y, x) => ({ x, y }))}>
          <XAxis dataKey="x" />
          <YAxis />
          <Tooltip />
          <Line dataKey="y" stroke="#6366f1" isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    ),
    VariableSlider,
    DataTable: ({ data }) => {
      try {
        const rows = JSON.parse(data.text);
        if (
          !Array.isArray(rows) ||
          rows.length > 100 ||
          !rows.every(
            (r) =>
              Array.isArray(r) &&
              r.every(
                (c) =>
                  typeof c === "string" || typeof c === "number" || c === null,
              ),
          )
        )
          throw Error();
        return <DataTable headers={data.items} rows={rows} />;
      } catch {
        return <p>Table data is unavailable.</p>;
      }
    },
    QuizComponent,
    AlgorithmVisualizer,
    SQLJoinVisualizer,
    GradientDescentVisualizer,
    ConceptDiagram,
    ProcessFlow,
    DecisionTree,
    ComparisonMatrix,
    Timeline,
    ProgressIndicator: ({ data }) => (
      <>
        <progress
          max={100}
          value={Math.max(0, Math.min(100, data.parameter))}
        />
        <p>{data.text}</p>
      </>
    ),
    SimulationControls: GuidedPlayback,
  };
