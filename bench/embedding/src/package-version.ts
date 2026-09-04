import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

interface PackageManifest {
  readonly name?: string;
  readonly version?: string;
}

const require = createRequire(import.meta.url);

export function packageVersion(packageName: string): string {
  let directory = path.dirname(require.resolve(packageName));
  const root = path.parse(directory).root;
  while (directory !== root) {
    const manifestPath = path.join(directory, "package.json");
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as PackageManifest;
      if (manifest.name === packageName && manifest.version) {
        return manifest.version;
      }
    } catch {
      // Continue toward the package root.
    }
    directory = path.dirname(directory);
  }
  throw new Error(`Could not resolve the installed version of ${packageName}.`);
}
