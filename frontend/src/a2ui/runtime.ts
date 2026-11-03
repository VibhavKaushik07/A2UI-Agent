import { Catalog, MessageProcessor } from "@a2ui/web_core/v0_9";
import { z } from "zod/v3";
import { names, propsSchema } from "../types/lesson";
export const catalog = new Catalog(
  "urn:a2ui-learning-lab:education:v1",
  "v0.9.1",
  [
    {
      name: "Column",
      schema: z.object({ children: z.array(z.string()) }).strict(),
    },
    ...names.map((name) => ({ name, schema: propsSchema })),
  ],
);
export function createRuntime() {
  return new MessageProcessor([catalog], undefined, { version: "v0.9.1" });
}
export function ingest(runtime: MessageProcessor, message: unknown) {
  if (JSON.stringify(message).length > 200000)
    throw Error("A2UI update exceeds size limit");
  const envelope = z
    .object({ version: z.literal("v0.9.1") })
    .passthrough()
    .parse(message);
  const update = (envelope as Record<string, unknown>).updateComponents;
  if (update) {
    const batch = z
      .object({
        surfaceId: z.string(),
        components: z
          .array(
            z.object({ id: z.string(), component: z.string() }).passthrough(),
          )
          .min(1)
          .max(50),
      })
      .strict()
      .parse(update);
    for (const c of batch.components) {
      const definition = catalog.components.get(c.component);
      if (!definition) throw Error("Unregistered component: " + c.component);
      const { id, component, ...props } = c;
      definition.schema.parse(props);
    }
  }
  const errors = runtime.processMessagesWithErrors(message);
  if (errors.length)
    throw new Error("Invalid A2UI update: " + JSON.stringify(errors));
}
