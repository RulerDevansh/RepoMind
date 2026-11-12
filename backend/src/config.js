import "dotenv/config";

export const config = {
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/repomind",
  mlServiceUrl: (process.env.ML_SERVICE_URL || "http://127.0.0.1:8000").replace(/\/$/, ""),
  githubToken: process.env.GITHUB_TOKEN || "",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173"
};
