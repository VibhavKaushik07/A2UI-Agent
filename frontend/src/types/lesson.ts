import { z } from "zod/v3";
export const names = [
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
] as const;
export const propsSchema = z
  .object({
    title: z.string().max(180),
    text: z.string().max(6000),
    items: z.array(z.string()).max(30),
    values: z.array(z.number().finite()).max(50),
    parameter: z.number().finite().min(-10000).max(10000),
    answer: z.number().int().min(0).max(29),
    nodes: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-zA-Z0-9_-]{1,24}$/),
            label: z.string().min(1).max(32),
            description: z.string().max(500),
          })
          .strict(),
      )
      .max(8),
    edges: z
      .array(
        z
          .object({
            source: z.string(),
            target: z.string(),
            label: z.string().max(80),
          })
          .strict(),
      )
      .max(16),
    source_refs: z.array(z.number().int().nonnegative()).max(8).default([]),
  })
  .strict();
export type BlockProps = z.input<typeof propsSchema>;
export type State = Record<string, string | number | boolean | number[]>;
export interface Lesson {
  id: string;
  revision: number;
  mode: string;
  spec: {
    title: string;
    objective: string;
    difficulty: string;
    notes_quote: string;
    sources?: { title: string; url: string }[];
    visual_plan?: {
      concept_type: string;
      form: string;
      reason: string;
    } | null;
  };
  progress: Record<string, State>;
  messages: unknown[];
}
