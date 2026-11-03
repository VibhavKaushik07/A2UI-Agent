import { createRoot } from "react-dom/client";
import { useEffect, useRef, useState } from "react";
import { createRuntime, ingest } from "./a2ui/runtime";
import { Surface } from "./a2ui/Surface";
import { api, streamQuestion } from "./services/api";
import type { Lesson, State } from "./types/lesson";
import "./style.css";
function App() {
  const runtime = useRef(createRuntime());
  const [sessions, setSessions] = useState<{ id: string; title: string }[]>([]);
  const [id, setId] = useState("");
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [question, setQuestion] = useState("");
  const [notes, setNotes] = useState("");
  const [history, setHistory] = useState<{ role: string; content: string }[]>(
    [],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("connecting");
  const [wire, setWire] = useState<unknown[]>([]);
  const [, render] = useState(0);
  const refresh = () => api("/conversations").then(setSessions);
  useEffect(() => {
    const subscription = runtime.current.model.onAction.subscribe(
      async (action) => {
        if (busy) return;
        setBusy(true);
        setError("");
        try {
          const next = await api("/conversations/" + id + "/actions", "POST", {
            version: "v0.9.1",
            action,
          });
          next.messages.forEach((m: unknown) => ingest(runtime.current, m));
          setLesson(next);
          setWire(next.messages);
          const c = await api("/conversations/" + id);
          setHistory(c.messages);
          await refresh();
        } catch (e) {
          setError(String(e));
        } finally {
          setBusy(false);
        }
      },
    );
    return () => subscription.unsubscribe();
  }, [id, lesson?.id, busy]);
  useEffect(() => {
    Promise.all([refresh(), api("/health").then((h) => setMode(h.mode))]).catch(
      (e) => setError(e.message),
    );
  }, []);
  function clear() {
    runtime.current.model.dispose();
    runtime.current = createRuntime();
    setLesson(null);
    setWire([]);
  }
  async function open(sid: string) {
    if (busy) return;
    setError("");
    try {
      const c = await api("/conversations/" + sid);
      clear();
      setId(sid);
      setHistory(c.messages);
      setNotes(c.notes);
      if (c.lesson) {
        c.lesson.messages.forEach((m: unknown) => ingest(runtime.current, m));
        setLesson(c.lesson);
        setWire(c.lesson.messages);
      }
    } catch (e) {
      setError(String(e));
    }
  }
  async function send(text = question) {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError("");
    let cid = id;
    try {
      if (!cid) {
        const c = await api("/conversations", "POST");
        cid = c.id;
        setId(cid);
      }
      let next: Lesson | null = null;
      const received: unknown[] = [];
      await streamQuestion(cid, text, notes, (event, data) => {
        if (event === "lesson") next = { ...data, messages: [] };
        if (event === "a2ui") {
          ingest(runtime.current, data);
          received.push(data);
          render((v) => v + 1);
        }
      });
      if (next) {
        setLesson(next);
        setWire(received);
      }
      setQuestion("");
      const c = await api("/conversations/" + cid);
      setHistory(c.messages);
      await refresh();
    } catch (e) {
      setError(String(e));
      if (cid) {
        try {
          const c = await api("/conversations/" + cid);
          clear();
          if (c.lesson) {
            c.lesson.messages.forEach((m: unknown) =>
              ingest(runtime.current, m),
            );
            setLesson(c.lesson);
          }
          setHistory(c.messages);
        } catch {}
      }
    } finally {
      setBusy(false);
    }
  }
  function save(componentId: string, state: State) {
    if (!lesson) return;
    api("/lessons/" + lesson.id + "/progress", "PUT", {
      component_id: componentId,
      state,
    }).catch((e) => setError("Progress was not saved: " + e.message));
  }
  return (
    <div className="app">
      <aside>
        <a className="brand" href="/">
          <span className="brand-icon">L</span>Learning Lab
        </a>
        <p className="sidebar-caption">A space for understanding</p>
        <button
          className="new-session"
          disabled={busy}
          onClick={() => {
            clear();
            setId("");
            setHistory([]);
            setNotes("");
            setError("");
          }}
        >
          ＋ New learning session
        </button>
        <div className="sidebar-label">YOUR SESSIONS</div>
        <nav>
          {sessions.map((s) => (
            <button
              key={s.id}
              disabled={busy}
              className={s.id === id ? "session selected" : "session"}
              onClick={() => open(s.id)}
            >
              ◈ <span>{s.title}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="avatar">D</span>
          <div>
            Local demo session<small>No account required</small>
          </div>
        </div>
      </aside>
      <main>
        <header>
          <span>
            WORKSPACE <span className="slash">/</span> Interactive learning
          </span>
          <span className="badge">
            {mode === "demo"
              ? "DEMO · curated examples"
              : mode === "ai"
                ? "AI · live composition"
                : "Connecting…"}
          </span>
        </header>
        <div className="content">
          <div className="eyebrow">LESS READING. MORE UNDERSTANDING.</div>
          <h1>{lesson ? lesson.spec.title : "Make the concept click."}</h1>
          <p className="intro">
            {lesson
              ? lesson.spec.objective
              : "Ask a question. Explore an interactive lesson. Learn by changing things."}
          </p>
          {!lesson && (
            <div className="suggestions">
              {[
                [
                  "01",
                  "Binary search",
                  "Explain binary search with an interactive example.",
                ],
                [
                  "02",
                  "SQL JOINs",
                  "Show me the difference between INNER JOIN and LEFT JOIN.",
                ],
                [
                  "03",
                  "Gradient descent",
                  "Show me how gradient descent minimizes a loss function.",
                ],
              ].map(([n, title, prompt]) => (
                <button disabled={busy} key={n} onClick={() => send(prompt)}>
                  <small>{n} / EXPLORE</small>
                  <strong>{title}</strong>
                  <span>Open the laboratory ↗</span>
                </button>
              ))}
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {history.length > 0 && (
            <details className="conversation">
              <summary>Conversation · {history.length} messages</summary>
              {history.map((m, i) => (
                <p key={i}>
                  <strong>
                    {m.role === "user" ? "You" : "Learning agent"}:
                  </strong>{" "}
                  {m.content}
                </p>
              ))}
            </details>
          )}
          {lesson && (
            <>
              <div className="lesson-meta">
                <span className="badge">{lesson.spec.difficulty}</span>
                <span>
                  A2UI v0.9.1 ·{" "}
                  {lesson.mode === "demo"
                    ? "Predetermined demo composition"
                    : "Agent-selected composition"}
                </span>
              </div>
              {lesson.spec.visual_plan && (
                <div className="visual-plan" aria-label="Visual plan">
                  <div>
                    <span className="visual-plan-label">VISUAL APPROACH</span>
                    <strong>
                      {lesson.spec.visual_plan.concept_type.replaceAll("_", " ")} · {lesson.spec.visual_plan.form.replaceAll("_", " ")}
                    </strong>
                  </div>
                  <p>{lesson.spec.visual_plan.reason}</p>
                </div>
              )}
              {lesson.spec.notes_quote && (
                <blockquote>
                  From your notes: “{lesson.spec.notes_quote}”
                </blockquote>
              )}
              <Surface
                runtime={runtime.current}
                lesson={lesson}
                save={save}
                sources={lesson.spec.sources ?? []}
              />
              {!!lesson.spec.sources?.length && (
                <details className="sources" open>
                  <summary>Sources checked · {lesson.spec.sources.length}</summary>
                  <ul>
                    {lesson.spec.sources.map((source) => (
                      <li key={source.url}>
                        <a href={source.url} target="_blank" rel="noreferrer">
                          {source.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <details className="protocol">
                <summary>Inspect A2UI messages</summary>
                <pre>{JSON.stringify(wire, null, 2)}</pre>
              </details>
            </>
          )}
          {busy && (
            <div className="loading" role="status">
              <span className="spinner" /> Planning your lesson and validating
              its components…
            </div>
          )}
          {lesson && (
            <button
              disabled={busy}
              onClick={() =>
                runtime.current.model
                  .getSurface(lesson.id)
                  ?.dispatchAction(
                    { event: { name: "explain_further", context: {} } },
                    "block-0",
                  )
              }
            >
              Explain this more simply
            </button>
          )}
          {mode === "demo" && (
            <p className="hint">
              Demo examples are predetermined. Notes are saved, but only AI mode
              uses them to compose a lesson.
            </p>
          )}
          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <label htmlFor="question">
              {lesson ? "Keep exploring" : "What would you like to understand?"}
            </label>
            <div className="compose-row">
              <textarea
                id="question"
                value={question}
                maxLength={4000}
                disabled={busy}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={
                  lesson
                    ? "What happens when the target doesn't exist?"
                    : "Ask an educational question…"
                }
              />
              <button className="primary" disabled={busy || !question.trim()}>
                Build lesson ↗
              </button>
            </div>
            <details>
              <summary>
                Add study notes <span>· optional, plain text</span>
              </summary>
              <label htmlFor="notes">Lecture notes used as context</label>
              <textarea
                id="notes"
                value={notes}
                disabled={busy}
                maxLength={20000}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Paste your notes here…"
              />
              <small>
                {notes.length.toLocaleString()} / 20,000 characters · stored
                with this session
              </small>
            </details>
          </form>
          <footer>
            Trusted components. Deterministic simulations. A2UI-powered
            learning.
          </footer>
        </div>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
