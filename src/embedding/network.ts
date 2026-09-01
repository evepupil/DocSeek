import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";

import { EnvHttpProxyAgent, ProxyAgent, setGlobalDispatcher } from "undici";

let networkConfigured = false;

function environmentProxyConfigured(): boolean {
  return ["HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy", "ALL_PROXY", "all_proxy"].some(
    (name) => Boolean(process.env[name]?.trim()),
  );
}

function readRegistryValue(name: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    execFile(
      "reg.exe",
      [
        "query",
        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",
        "/v",
        name,
      ],
      { encoding: "utf8", windowsHide: true },
      (error, stdout) => {
        if (error) {
          resolve(undefined);
          return;
        }
        const line = stdout
          .split(/\r?\n/u)
          .find((candidate) => candidate.trimStart().startsWith(name));
        const match = line?.match(/^\s*\S+\s+REG_\S+\s+(.+?)\s*$/u);
        resolve(match?.[1]);
      },
    );
  });
}

function selectWindowsProxy(raw: string): string | undefined {
  const entries = raw
    .split(";")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  const keyed = new Map<string, string>();
  let unkeyed: string | undefined;

  for (const entry of entries) {
    const separator = entry.indexOf("=");
    if (separator > 0) {
      keyed.set(entry.slice(0, separator).toLowerCase(), entry.slice(separator + 1));
    } else {
      unkeyed ??= entry;
    }
  }

  const selected = keyed.get("https") ?? keyed.get("http") ?? unkeyed;
  if (!selected) {
    return undefined;
  }

  const candidate = /^[a-z][a-z\d+.-]*:\/\//iu.test(selected) ? selected : `http://${selected}`;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

async function windowsSystemProxy(): Promise<string | undefined> {
  const enabled = await readRegistryValue("ProxyEnable");
  if (!enabled || Number.parseInt(enabled, 0) !== 1) {
    return undefined;
  }
  const server = await readRegistryValue("ProxyServer");
  return server ? selectWindowsProxy(server) : undefined;
}

export async function configureModelNetwork(): Promise<void> {
  if (networkConfigured) {
    return;
  }
  networkConfigured = true;

  if (environmentProxyConfigured()) {
    setGlobalDispatcher(new EnvHttpProxyAgent());
    return;
  }

  if (process.platform === "win32") {
    const proxy = await windowsSystemProxy();
    if (proxy) {
      setGlobalDispatcher(new ProxyAgent(proxy));
    }
  }
}

export function modelCacheDirectory(): string {
  const configured = process.env["DOCSEEK_MODEL_CACHE"]?.trim();
  if (configured) {
    return path.resolve(configured);
  }
  if (process.platform === "win32" && process.env["LOCALAPPDATA"]) {
    return path.join(process.env["LOCALAPPDATA"], "DocSeek", "models");
  }
  const base = process.env["XDG_CACHE_HOME"]?.trim() || path.join(os.homedir(), ".cache");
  return path.join(base, "docseek", "models");
}

export function huggingFaceEndpoint(): string | undefined {
  const configured =
    process.env["DOCSEEK_HF_ENDPOINT"]?.trim() || process.env["HF_ENDPOINT"]?.trim();
  if (!configured) {
    return undefined;
  }
  try {
    const endpoint = new URL(configured);
    if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") {
      return undefined;
    }
    return endpoint.href.endsWith("/") ? endpoint.href : `${endpoint.href}/`;
  } catch {
    return undefined;
  }
}
