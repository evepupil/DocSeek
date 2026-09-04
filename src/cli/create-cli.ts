import { Command, CommanderError, InvalidArgumentError } from "commander";

import type { EmbeddingProviderFactory } from "../domain/contracts.js";
import { errorMessage } from "../domain/errors.js";
import { initializeProject } from "../application/init-project.js";
import { updateProject } from "../application/update-project.js";
import { getStatus } from "../application/get-status.js";
import { searchDocsDetailed } from "../application/search-docs.js";
import { createEmbeddingProvider } from "../embedding/factory.js";
import { DOCSEEK_VERSION } from "../version.js";
import {
  registerInstructionsCommand,
  type GlobalInstructionInstaller,
} from "./instructions-command.js";
import { formatSearchJson, formatSearchText, formatStatusText } from "./output.js";

export interface CliDependencies {
  readonly cwd: () => string;
  readonly writeOut: (value: string) => void;
  readonly writeError: (value: string) => void;
  readonly createEmbeddingProvider: EmbeddingProviderFactory;
  readonly installGlobalInstructions?: GlobalInstructionInstaller;
}

const defaultDependencies: CliDependencies = {
  cwd: () => process.cwd(),
  writeOut: (value) => process.stdout.write(value),
  writeError: (value) => process.stderr.write(value),
  createEmbeddingProvider,
};

function positiveInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new InvalidArgumentError("expected an integer from 1 to 100");
  }
  return parsed;
}

export function createCli(dependencies: CliDependencies = defaultDependencies): Command {
  const program = new Command();
  program
    .name("docseek")
    .description("Locate project documentation with local semantic search")
    .version(DOCSEEK_VERSION)
    .showHelpAfterError()
    .exitOverride()
    .configureOutput({
      writeOut: dependencies.writeOut,
      writeErr: dependencies.writeError,
    });

  program
    .command("init")
    .description("Create or rebuild the local documentation index")
    .action(async () => {
      const result = await initializeProject(
        dependencies.cwd(),
        dependencies.createEmbeddingProvider,
      );
      dependencies.writeOut(
        `Indexed ${result.documents} documents and ${result.chunks} chunks in ${result.rootDir}.\n`,
      );
      if (result.usedGitFallback) {
        dependencies.writeError(
          "Git root not found; used the current directory as the project root.\n",
        );
      }
    });

  program
    .command("update")
    .description("Index added, changed, and deleted Markdown files")
    .action(async () => {
      const result = await updateProject(dependencies.cwd(), dependencies.createEmbeddingProvider);
      dependencies.writeOut(
        `Updated ${result.added} added, ${result.modified} modified, ${result.deleted} deleted; ${result.unchanged} unchanged.\n`,
      );
    });

  program
    .command("status")
    .description("Show index health and pending document changes")
    .option("--json", "print machine-readable JSON")
    .action(async (options: { readonly json?: boolean }) => {
      const status = await getStatus(dependencies.cwd());
      dependencies.writeOut(
        options.json ? `${JSON.stringify(status, undefined, 2)}\n` : formatStatusText(status),
      );
    });

  program
    .command("search")
    .description("Locate relevant Markdown sections")
    .argument("<query...>", "natural-language query")
    .option("--top <number>", "maximum results", positiveInteger)
    .option("--path <path>", "limit results to matching paths")
    .option("--json", "print machine-readable JSON")
    .option("--snippet", "include short result snippets")
    .option("--explain", "include retrieval signals and timing diagnostics")
    .action(
      async (
        queryParts: readonly string[],
        options: {
          readonly top?: number;
          readonly path?: string;
          readonly json?: boolean;
          readonly snippet?: boolean;
          readonly explain?: boolean;
        },
      ) => {
        const query = queryParts.join(" ").trim();
        const response = await searchDocsDetailed(
          dependencies.cwd(),
          {
            query,
            includeSnippet: options.snippet ?? false,
            includeExplanation: options.explain ?? false,
            ...(options.top !== undefined ? { top: options.top } : {}),
            ...(options.path ? { path: options.path } : {}),
          },
          dependencies.createEmbeddingProvider,
        );
        const diagnostics = options.explain ? response.diagnostics : undefined;
        dependencies.writeOut(
          options.json
            ? formatSearchJson(response.results, diagnostics)
            : formatSearchText(response.results, diagnostics),
        );
      },
    );

  registerInstructionsCommand(program, {
    writeOut: dependencies.writeOut,
    ...(dependencies.installGlobalInstructions
      ? { installGlobalInstructions: dependencies.installGlobalInstructions }
      : {}),
  });

  return program;
}

export async function runCli(
  arguments_: readonly string[],
  dependencies: CliDependencies = defaultDependencies,
): Promise<number> {
  const program = createCli(dependencies);
  if (arguments_.length === 0) {
    dependencies.writeOut(program.helpInformation());
    return 0;
  }
  try {
    await program.parseAsync([...arguments_], { from: "user" });
    return 0;
  } catch (error) {
    if (error instanceof CommanderError) {
      if (error.code === "commander.helpDisplayed" || error.code === "commander.version") {
        return 0;
      }
      return error.exitCode;
    }
    dependencies.writeError(`docseek: ${errorMessage(error)}\n`);
    return 1;
  }
}
