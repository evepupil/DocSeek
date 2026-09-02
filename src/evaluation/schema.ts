import { z } from "zod";

const expectationSchema = z.object({
  path: z.string().min(1),
  heading: z.string().min(1).optional(),
});

const caseSchema = z
  .object({
    id: z.string().min(1),
    category: z.enum(["semantic", "exact", "filter", "negative"]),
    query: z.string().min(1),
    path: z.string().min(1).optional(),
    expected: z.array(expectationSchema).min(1).optional(),
  })
  .superRefine((testCase, context) => {
    if (testCase.category !== "negative" && !testCase.expected) {
      context.addIssue({ code: "custom", message: "Positive cases require expected locations" });
    }
  });

export const qualitySuiteSchema = z.object({
  version: z.literal(1),
  thresholds: z.object({
    positive_recall_at_5: z.number().min(0).max(1),
    positive_top_1: z.number().min(0).max(1),
    exact_top_1: z.number().min(0).max(1),
    negative_rejection: z.number().min(0).max(1),
    determinism: z.number().min(0).max(1),
  }),
  cases: z.array(caseSchema).min(1),
});

export type QualityCase = z.infer<typeof caseSchema>;
export type QualityExpectation = z.infer<typeof expectationSchema>;
export type QualitySuite = z.infer<typeof qualitySuiteSchema>;
