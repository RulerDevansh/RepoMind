from pydantic import BaseModel, Field

class DocumentInput(BaseModel):
    path: str
    content: str

class IngestRequest(BaseModel):
    repositoryId: str = Field(min_length=1)
    owner: str
    name: str
    documents: list[DocumentInput]

class QueryRequest(BaseModel):
    repositoryId: str = Field(min_length=1)
    question: str = Field(min_length=1, max_length=4000)

class Source(BaseModel):
    path: str
    startLine: int
    endLine: int

class QueryResponse(BaseModel):
    answer: str
    sources: list[Source]
