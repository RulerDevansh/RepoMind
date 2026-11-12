# RepoMind

RepoMind is a three-service application for asking grounded questions about public GitHub repositories.

## Architecture

```text
React/Vite frontend -> Express backend -> FastAPI ML service -> ChromaDB + embeddings + LLM
```

The backend fetches public repository files through the GitHub REST API, filters source files, and sends them to the ML service. The ML service chunks and embeds the files in a repository-specific ChromaDB collection. Questions retrieve only from that collection and optionally use an OpenAI-compatible LLM.

## Requirements

- Node.js 20+
- Python 3.11+
- MongoDB (local or hosted)
- A GitHub token is optional but recommended for higher API limits.
- An OpenAI-compatible API key is optional. Without one, the ML service returns a useful context-based answer.

## Configuration

Copy each `.env.example` to `.env`.

### Backend

```powershell
cd backend
copy .env.example .env
npm install
npm run dev
```

### ML service

```powershell
cd ml-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

### Frontend

```powershell
cd frontend
copy .env.example .env
npm install
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`).

## API

- `POST /api/repositories` with `{ "url": "https://github.com/owner/repo" }`
- `GET /api/repositories/:id`
- `POST /api/repositories/:id/questions` with `{ "question": "..." }`
- `GET /api/repositories/:id/messages`
- `GET /health`

The backend starts ingestion asynchronously and reports `pending`, `processing`, `ready`, or `failed`. MongoDB stores repository records and chat messages. The ML service exposes `/health`, `/ingest`, and `/query`.

## Notes

Only public GitHub repositories are supported. Large files, binary files, vendored directories, and common build artifacts are excluded before ingestion. Set `CORS_ORIGIN`, `GITHUB_TOKEN`, `ML_SERVICE_URL`, and `MONGODB_URI` as needed.
