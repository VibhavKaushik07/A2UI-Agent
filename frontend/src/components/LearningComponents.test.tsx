// @vitest-environment jsdom
import { it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  ConceptDiagram,
  QuizComponent,
  SQLJoinVisualizer,
} from "./LearningComponents";
const data = {
  title: "Quiz",
  text: "Choose",
  items: ["Yes", "No"],
  values: [],
  parameter: 0,
  answer: 0,
  nodes: [],
  edges: [],
};
it("assesses an answer and saves it", () => {
  const save = vi.fn();
  render(<QuizComponent data={data} initial={{}} save={save} />);
  fireEvent.click(screen.getByText("A · Yes"));
  expect(screen.getByRole("status").textContent).toContain("Correct");
  expect(save).toHaveBeenCalledWith({ answer: 0 });
  cleanup();
});
it("switches JOIN and reveals NULL", () => {
  render(<SQLJoinVisualizer data={data} initial={{}} save={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "LEFT JOIN" }));
  expect(screen.getByText("NULL")).toBeTruthy();
  cleanup();
});
it("draws selectable attention relationships", () => {
  const d = {
    ...data,
    nodes: [
      { id: "it", label: "it", description: "Pronoun" },
      { id: "animal", label: "animal", description: "Possible referent" },
    ],
    edges: [{ source: "it", target: "animal", label: "possible referent" }],
  };
  render(<ConceptDiagram data={d} initial={{}} save={() => {}} />);
  expect(
    screen.getByRole("group", { name: /Interactive concept map/ }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "animal" }));
  expect(screen.getByText("Possible referent")).toBeTruthy();
  expect(screen.getByText("possible referent")).toBeTruthy();
  cleanup();
});
