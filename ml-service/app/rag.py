import re
import httpx
import chromadb
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
from . import config

client = chromadb.PersistentClient(path=config.CHROMA_PATH)
embedder = SentenceTransformer(config.EMBEDDING_MODEL)
splitter = RecursiveCharacterTextSplitter(chunk_size=1200, chunk_overlap=180, separators=["\n\n", "\n", " ", ""])

def collection_for(repository_id: str):
    safe_id = re.sub(r"[^a-zA-Z0-9_-]", "-", repository_id)
    return client.get_or_create_collection(f"repo-{safe_id}", metadata={"repositoryId": repository_id})

def chunks_for(path: str, content: str):
    chunks = splitter.split_text(content)
    cursor = 0
    for index, chunk in enumerate(chunks):
        start = content.find(chunk, cursor)
        start = start if start >= 0 else cursor
        cursor = start + len(chunk)
        yield chunk, {
            "path": path,
            "startLine": content[:start].count("\n") + 1,
            "endLine": content[:start + len(chunk)].count("\n") + 1,
            "chunkIndex": index
        }

def ingest(repository_id: str, documents):
    collection = collection_for(repository_id)
    if collection.count() > 0:
        collection.delete(where={"repositoryId": repository_id})
    texts, ids, metadatas = [], [], []
    for document in documents:
        for index, (text, metadata) in enumerate(chunks_for(document.path, document.content)):
            texts.append(text)
            ids.append(f"{document.path}:{index}")
            metadatas.append({**metadata, "repositoryId": repository_id})
    if texts:
        embeddings = embedder.encode(texts, normalize_embeddings=True).tolist()
        collection.add(ids=ids, documents=texts, embeddings=embeddings, metadatas=metadatas)
    return len(texts)

def retrieve(repository_id: str, question: str, limit: int = 6):
    collection = collection_for(repository_id)
    if collection.count() == 0:
        return []
    embedding = embedder.encode([question], normalize_embeddings=True).tolist()
    result = collection.query(query_embeddings=embedding, n_results=min(limit, collection.count()), where={"repositoryId": repository_id})
    return [{"text": text, "metadata": metadata} for text, metadata in zip(result["documents"][0], result["metadatas"][0])]

async def generate_answer(question: str, contexts):
    sources = []
    for item in contexts:
        metadata = item["metadata"]
        source = {key: metadata[key] for key in ("path", "startLine", "endLine")}
        if source not in sources:
            sources.append(source)
    if not contexts:
        return "I could not find indexed source code for this repository yet.", sources
    context = "\n\n".join(f"FILE: {item['metadata']['path']} (lines {item['metadata']['startLine']}-{item['metadata']['endLine']})\n{item['text']}" for item in contexts)
    if config.LLM_API_URL and config.LLM_API_KEY and config.LLM_MODEL:
        payload = {
            "model": config.LLM_MODEL,
            "messages": [
                {"role": "system", "content": "Answer using only the supplied repository context. If it is insufficient, say so. Cite relevant file paths and line ranges."},
                {"role": "user", "content": f"Question: {question}\n\nRepository context:\n{context}"}
            ],
            "temperature": 0.1
        }
        async with httpx.AsyncClient(timeout=config.LLM_TIMEOUT) as http:
            response = await http.post(config.LLM_API_URL, headers={"Authorization": f"Bearer {config.LLM_API_KEY}"}, json=payload)
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"], sources
    answer = "Relevant repository context:\n\n" + "\n\n".join(f"**{item['metadata']['path']}** (lines {item['metadata']['startLine']}-{item['metadata']['endLine']})\n\n```text\n{item['text']}\n```" for item in contexts)
    return answer, sources
