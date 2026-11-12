import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "./api.js";

function ErrorMessage({ children }) { return children ? <p className="error">{children}</p> : null; }

export default function App() {
  const [repository, setRepository] = useState(null);
  const [url, setUrl] = useState("");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!repository || ["ready", "failed"].includes(repository.status)) return undefined;
    const timer = setInterval(async () => {
      try {
        const { data } = await api.get(`/repositories/${repository._id}`);
        setRepository(data.repository);
      } catch (requestError) { setError(requestError.response?.data?.error || requestError.message); }
    }, 2000);
    return () => clearInterval(timer);
  }, [repository]);

  useEffect(() => {
    if (repository?.status !== "ready") return;
    api.get(`/repositories/${repository._id}/messages`).then(({ data }) => setMessages(data.messages)).catch((requestError) => setError(requestError.message));
  }, [repository?.status, repository?._id]);

  async function submitRepository(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/repositories", { url });
      setRepository(data.repository);
      setMessages([]);
    } catch (requestError) { setError(requestError.response?.data?.error || requestError.message); }
    finally { setLoading(false); }
  }

  async function submitQuestion(event) {
    event.preventDefault();
    if (!question.trim() || loading) return;
    const value = question.trim();
    setQuestion("");
    setLoading(true);
    setError("");
    setMessages((current) => [...current, { role: "user", content: value }]);
    try {
      const { data } = await api.post(`/repositories/${repository._id}/questions`, { question: value });
      setMessages((current) => [...current, data.message]);
    } catch (requestError) {
      setError(requestError.response?.data?.error || requestError.message);
    } finally { setLoading(false); }
  }

  if (!repository) return <main className="landing"><div className="hero"><span className="eyebrow">REPOSITORY INTELLIGENCE</span><h1>Understand any codebase.</h1><p>Connect a public GitHub repository and ask questions grounded in its actual source code.</p><form onSubmit={submitRepository} className="repo-form"><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://github.com/owner/repository" required /><button disabled={loading}>{loading ? "Connecting..." : "Analyze repository"}</button></form><ErrorMessage>{error}</ErrorMessage></div></main>;

  return <main className="workspace">
    <header><div><span className="eyebrow">REPOMIND</span><h1>{repository.owner}/{repository.name}</h1></div><a href={repository.url} target="_blank" rel="noreferrer">View on GitHub ↗</a></header>
    <section className="status-card"><div><strong>{repository.status === "ready" ? "Repository ready" : repository.status === "failed" ? "Analysis failed" : "Analyzing repository..."}</strong><p>{repository.description || "We're indexing source files and documentation for grounded answers."}</p></div><span className={`status ${repository.status}`}>{repository.status}</span></section>
    <ErrorMessage>{error || repository.error}</ErrorMessage>
    {repository.status === "ready" && <section className="chat"><div className="messages">{messages.length === 0 && <div className="empty"><h2>Ask about this codebase</h2><p>Try “Where is authentication implemented?” or “Explain the API architecture.”</p></div>}{messages.map((message, index) => <article className={`message ${message.role}`} key={`${message._id || message.role}-${index}`}><div className="role">{message.role === "user" ? "You" : "RepoMind"}</div><div className="content"><ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>{message.sources?.length > 0 && <div className="sources"><strong>Sources</strong>{message.sources.map((source) => <span key={`${source.path}-${source.startLine}`}>{source.path}:{source.startLine}-{source.endLine}</span>)}</div>}</div></article>)}</div><form className="question-form" onSubmit={submitQuestion}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask a question about the repository..." /><button disabled={loading || !question.trim()}>{loading ? "Thinking..." : "Ask"}</button></form></section>}
  </main>;
}
