const isGlobalInstall = process.env.npm_config_global === "true";

if (isGlobalInstall) {
  try {
    const { formatInstructionInstallResult, installGlobalInstructions } =
      await import("../dist/instructions/global-installer.js");
    const results = await installGlobalInstructions();
    for (const result of results) {
      const line = `[docseek] ${formatInstructionInstallResult(result)}`;
      if (result.status === "skipped") {
        console.warn(`${line}. Run \`docseek instructions --install\` after fixing it.`);
      } else {
        console.log(line);
      }
    }
  } catch {
    console.warn(
      "[docseek] Could not install global agent instructions. Run `docseek instructions --install` after installation.",
    );
  }
}
