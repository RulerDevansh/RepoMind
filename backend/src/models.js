import mongoose from "mongoose";

const repositorySchema = new mongoose.Schema({
  owner: { type: String, required: true },
  name: { type: String, required: true },
  url: { type: String, required: true },
  description: String,
  stars: Number,
  language: String,
  status: { type: String, enum: ["pending", "processing", "ready", "failed"], default: "pending" },
  fileCount: { type: Number, default: 0 },
  error: String
}, { timestamps: true });
repositorySchema.index({ owner: 1, name: 1 }, { unique: true });

const messageSchema = new mongoose.Schema({
  repository: { type: mongoose.Schema.Types.ObjectId, ref: "Repository", required: true },
  role: { type: String, enum: ["user", "assistant"], required: true },
  content: { type: String, required: true },
  sources: [{ path: String, startLine: Number, endLine: Number }]
}, { timestamps: true });

export const Repository = mongoose.model("Repository", repositorySchema);
export const Message = mongoose.model("Message", messageSchema);
