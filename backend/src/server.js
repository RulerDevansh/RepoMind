import express from "express";
import cors from "cors";
import axios from "axios";
import mongoose from "mongoose";
import { config } from "./config.js";
import { Message, Repository } from "./models.js";
import { fetchRepository, parseRepositoryUrl } from "./github.js";
import { z } from "zod";

const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: "1mb" }));

const questionSchema = z.object({ question: z.string().trim().min(1).max(4000) });
const idSchema = z.string().regex(/^[a-f\d]{24}$/i);

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

async function ingest(repository) {
  try {
    await Repository.findByIdAndUpdate(repository._id, { status: "processing", error: undefined });
    const { metadata, documents } = await fetchRepository(repository.owner, repository.name);
    await axios.post(`${config.mlServiceUrl}/ingest`, { repositoryId: repository._id.toString(), owner: repository.owner, name: repository.name, documents }, { timeout: 120000 });
    await Repository.findByIdAndUpdate(repository._id, { status: "ready", fileCount: documents.length, description: metadata.description, stars: metadata.stargazers_count, language: metadata.language });
  } catch (error) {
    await Repository.findByIdAndUpdate(repository._id, { status: "failed", error: error.response?.data?.detail || error.message });
  }
}

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.post("/api/repositories", asyncRoute(async (req, res) => {
  const { owner, name } = parseRepositoryUrl(req.body?.url);
  let repository = await Repository.findOne({ owner, name });
  if (!repository) repository = await Repository.create({ owner, name, url: `https://github.com/${owner}/${name}`, status: "pending" });
  if (repository.status === "pending" || repository.status === "failed") void ingest(repository);
  res.status(202).json({ repository });
}));

app.get("/api/repositories/:id", asyncRoute(async (req, res) => {
  if (!idSchema.safeParse(req.params.id).success) return res.status(400).json({ error: "Invalid repository id" });
  const repository = await Repository.findById(req.params.id);
  if (!repository) return res.status(404).json({ error: "Repository not found" });
  res.json({ repository });
}));

app.get("/api/repositories/:id/messages", asyncRoute(async (req, res) => {
  if (!idSchema.safeParse(req.params.id).success) return res.status(400).json({ error: "Invalid repository id" });
  res.json({ messages: await Message.find({ repository: req.params.id }).sort({ createdAt: 1 }) });
}));

app.post("/api/repositories/:id/questions", asyncRoute(async (req, res) => {
  if (!idSchema.safeParse(req.params.id).success) return res.status(400).json({ error: "Invalid repository id" });
  const parsed = questionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const repository = await Repository.findById(req.params.id);
  if (!repository) return res.status(404).json({ error: "Repository not found" });
  if (repository.status !== "ready") return res.status(409).json({ error: `Repository is ${repository.status}` });
  await Message.create({ repository: repository._id, role: "user", content: parsed.data.question });
  const { data } = await axios.post(`${config.mlServiceUrl}/query`, { repositoryId: repository._id.toString(), question: parsed.data.question }, { timeout: 120000 });
  const assistant = await Message.create({ repository: repository._id, role: "assistant", content: data.answer, sources: data.sources || [] });
  res.json({ message: assistant });
}));

app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.response?.status || 500).json({ error: error.response?.data?.detail || error.message || "Internal server error" });
});

mongoose.connect(config.mongoUri).then(() => app.listen(config.port, () => console.log(`Backend listening on ${config.port}`))).catch((error) => {
  console.error("MongoDB connection failed:", error.message);
  process.exitCode = 1;
});
