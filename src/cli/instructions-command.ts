import type { Command } from "commander";

import { DocSeekError } from "../domain/errors.js";
import { renderInstructionBlock } from "../instructions/content.js";
import {
  formatInstructionInstallResult,
  installGlobalInstructions,
  type InstructionInstallResult,
} from "../instructions/global-installer.js";

export type GlobalInstructionInstaller = () => Promise<readonly InstructionInstallResult[]>;

export interface InstructionCommandDependencies {
  readonly writeOut: (value: string) => void;
  readonly installGlobalInstructions?: GlobalInstructionInstaller;
}

export function registerInstructionsCommand(
  program: Command,
  dependencies: InstructionCommandDependencies,
): void {
  program
    .command("instructions")
    .description("Print or install global coding-agent instructions")
    .option("--install", "install into Codex and Claude global instruction files")
    .action(async (options: { readonly install?: boolean }) => {
      if (!options.install) {
        dependencies.writeOut(`${renderInstructionBlock()}\n`);
        return;
      }

      const installer = dependencies.installGlobalInstructions ?? installGlobalInstructions;
      const results = await installer();
      dependencies.writeOut(`${results.map(formatInstructionInstallResult).join("\n")}\n`);
      if (results.some((result) => result.status === "skipped")) {
        throw new DocSeekError(
          "INSTRUCTION_INSTALL_INCOMPLETE",
          "Some global instruction files were skipped; fix their markers or permissions and retry.",
        );
      }
    });
}
