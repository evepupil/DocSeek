import { runQualityEvaluation } from "../dist/evaluation/run-quality-evaluation.js";

process.exitCode = await runQualityEvaluation(process.cwd());
