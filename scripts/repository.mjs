import { readFile } from "node:fs/promises";
import path from "node:path";

function normalize(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(raw)) return raw;

  if (raw.startsWith("git@github.com:")) {
    return raw
      .replace(/^git@github\.com:/, "")
      .replace(/\.git$/, "")
      .trim();
  }

  try {
    const url = new URL(raw);
    if (url.hostname !== "github.com" || url.pathname.length < 2) return null;
    const [, owner, repo] = url.pathname.split("/");
    if (!owner || !repo) return null;
    return `${owner}/${repo.replace(/\.git$/, "")}`;
  } catch {
    return null;
  }
}

async function resolveFromGitConfig(root) {
  try {
    const config = await readFile(path.resolve(root, ".git", "config"), "utf8");
    const origin = config.match(/remote "origin"[\s\S]*?\n(?:\s*url\s*=\s*([^\n\r]+))/m);
    const genericUrl = origin?.[1]?.trim() || config.match(/^\s*url\s*=\s*([^\n\r]+)/m)?.[1]?.trim();
    return normalize(genericUrl);
  } catch {
    return null;
  }
}

export async function resolveRepository({ candidate = null, root = process.cwd() } = {}) {
  const envCandidate = normalize(candidate || process.env.GITHUB_REPOSITORY || process.env.VITRINEADT_REPOSITORY || process.env.GITHUB_REPOSITORY_OWNER && `${process.env.GITHUB_REPOSITORY_OWNER}/${process.env.GITHUB_REPOSITORY}` || null);
  if (envCandidate) return envCandidate;
  const gitCandidate = await resolveFromGitConfig(root);
  if (gitCandidate) return gitCandidate;
  return null;
}

