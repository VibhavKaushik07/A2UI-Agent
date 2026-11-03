import type { MessageProcessor } from "@a2ui/web_core/v0_9";
import { propsSchema, type Lesson, type State } from "../types/lesson";
import { registry } from "../components/LearningComponents";
export function Surface({
  runtime,
  lesson,
  save,
  sources = [],
}: {
  runtime: MessageProcessor;
  lesson: Lesson;
  save: (id: string, state: State) => void;
  sources?: { title: string; url: string }[];
}) {
  const surface = runtime.model.getSurface(lesson.id);
  if (!surface) return null;
  const root = surface.componentsModel.get("root");
  const children = root?.properties.children;
  if (!Array.isArray(children))
    return <p role="alert">Lesson root is invalid.</p>;
  return (
    <div className="lesson-components">
      {children.map((id: string) => {
        const c = surface.componentsModel.get(id);
        if (!c || !registry[c.type])
          return <p key={id}>Unsupported component</p>;
        const parsed = propsSchema.safeParse(c.properties);
        if (!parsed.success)
          return <p key={id}>Invalid component properties</p>;
        const Component = registry[c.type];
        return (
          <section
            className="card"
            key={lesson.id + ":" + id + ":" + lesson.revision}
          >
            <div className="card-top">
              <h2>{parsed.data.title}</h2>
              <span className="component-label">
                {c.type.replace(/([a-z])([A-Z])/g, "$1 $2")}
              </span>
            </div>
            <Component
              data={parsed.data}
              initial={surface.dataModel.get<State>("/progress/" + id) ?? {}}
              save={(s) => {
                surface.dataModel.set("/progress/" + id, s);
                save(id, s);
              }}
            />
            {parsed.data.source_refs.length > 0 && (
              <div className="visual-sources" aria-label="Sources for this visual">
                <span>Evidence</span>
                {parsed.data.source_refs
                  .map((index) => sources[index])
                  .filter((source): source is { title: string; url: string } => !!source)
                  .map((source) => (
                    <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                      {source.title}
                    </a>
                  ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
