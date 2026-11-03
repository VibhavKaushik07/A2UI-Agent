import { it, expect } from "vitest";
import { createRuntime, ingest } from "./runtime";
it("processes the v0.9.1 surface lifecycle through official core", () => {
  const p = createRuntime();
  ingest(p, {
    version: "v0.9.1",
    createSurface: {
      surfaceId: "test",
      catalogId: "urn:a2ui-learning-lab:education:v1",
    },
  });
  ingest(p, {
    version: "v0.9.1",
    updateComponents: {
      surfaceId: "test",
      components: [
        { id: "root", component: "Column", children: ["a"] },
        {
          id: "a",
          component: "ExplanationPanel",
          title: "Test",
          text: "Hello",
          items: [],
          values: [],
          parameter: 0,
          answer: 0,
          nodes: [],
          edges: [],
        },
      ],
    },
  });
  ingest(p, {
    version: "v0.9.1",
    updateDataModel: { surfaceId: "test", path: "/", value: { progress: {} } },
  });
  expect(
    p.model.getSurface("test")?.componentsModel.get("a")?.properties.text,
  ).toBe("Hello");
  ingest(p, { version: "v0.9.1", deleteSurface: { surfaceId: "test" } });
  expect(p.model.getSurface("test")).toBeUndefined();
});
it("rejects unknown components", () => {
  const p = createRuntime();
  ingest(p, {
    version: "v0.9.1",
    createSurface: {
      surfaceId: "test",
      catalogId: "urn:a2ui-learning-lab:education:v1",
    },
  });
  expect(() =>
    ingest(p, {
      version: "v0.9.1",
      updateComponents: {
        surfaceId: "test",
        components: [{ id: "root", component: "ExecuteCode" }],
      },
    }),
  ).toThrow();
});
