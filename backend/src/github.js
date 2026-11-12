import axios from "axios";
import { config } from "./config.js";

const ignoredDirectories = new Set([".git", ".github", "node_modules", "dist", "build", "coverage", "vendor", "__pycache__", ".venv"]);
const binaryExtensions = /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|tar|7z|woff2?|ttf|eot|mp3|mp4|mov|avi|exe|dll|so|bin)$/i;

const github = axios.create({
  baseURL: "https://api.github.com",
  headers: { Accept: "application/vnd.github+json", ...(config.githubToken ? { Authorization: `Bearer ${config.githubToken}` } : {}) },
  timeout: 20000
});

export function parseRepositoryUrl(value) {
  try {
    const url = new URL(value);
    if (url.hostname !== "github.com") throw new Error("Only github.com URLs are supported");
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) throw new Error("URL must include an owner and repository");
    return { owner: parts[0], name: parts[1].replace(/\.git$/, "") };
  } catch (error) {
    throw new Error(error.message || "Invalid GitHub repository URL");
  }
}

function isRelevant(path, size) {
  return size <= 500_000 && !binaryExtensions.test(path) && !path.split("/").some((part) => ignoredDirectories.has(part));
}

export async function fetchRepository(owner, name) {
  const { data: metadata } = await github.get(`/repos/${owner}/${name}`);
  const { data: tree } = await github.get(`/repos/${owner}/${name}/git/trees/${metadata.default_branch}`, { params: { recursive: "1" } });
  const files = tree.tree.filter((item) => item.type === "blob" && isRelevant(item.path, item.size || 0));
  const documents = [];
  for (const file of files) {
    const { data } = await github.get(`/repos/${owner}/${name}/contents/${file.path}`, { params: { ref: metadata.default_branch } });
    if (data.encoding !== "base64" || !data.content) continue;
    const content = Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8");
    if (content.includes("\u0000")) continue;
    documents.push({ path: file.path, content });
  }
  return { metadata, documents };
}
