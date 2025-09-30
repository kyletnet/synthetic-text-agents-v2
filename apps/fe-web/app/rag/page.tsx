"use client";

import { useState, useEffect } from "react";
import {
  BookOpen,
  Upload,
  Trash2,
  Search,
  FileText,
  Database,
  Settings,
  BarChart3,
  AlertCircle,
  Play,
  Lightbulb,
  ArrowRight,
  CheckCircle,
  ArrowDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import QAGenerationTab from "@/components/qa-generation-tab";

interface DocumentInfo {
  id: string;
  path: string;
  chunkCount: number;
  lastModified: string;
  size: number;
  metadata: Record<string, unknown>;
}

interface RAGStats {
  enabled: boolean;
  documentsCount: number;
  chunksCount: number;
  ragStats?: {
    enabled: boolean;
    documentsCount: number;
    chunksCount: number;
  };
  embeddingStats?: {
    enabled: boolean;
    totalEmbeddings: number;
    modelsUsed: string[];
  };
}

interface SearchResult {
  id: string;
  score: number;
  chunk: {
    id: string;
    content: string;
    meta?: Record<string, unknown>;
  };
}

export default function RAGPage() {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [stats, setStats] = useState<RAGStats | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Load initial data
  useEffect(() => {
    loadRAGStats();
    loadDocuments();
  }, []);

  const loadRAGStats = async () => {
    try {
      const response = await fetch("/api/rag/stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to load RAG stats:", error);
    }
  };

  const loadDocuments = async () => {
    try {
      const response = await fetch("/api/rag/documents");
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      }
    } catch (error) {
      console.error("Failed to load documents:", error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/rag/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, topK: 10 }),
      });

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
      } else {
        const errorData = await response.json();
        setError(errorData.message || "Search failed");
      }
    } catch (error) {
      setError(
        `Search error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = [".md", ".txt", ".json", ".ts", ".js", ".py"];
    const fileExt = "." + file.name.split(".").pop()?.toLowerCase();

    if (!allowedTypes.includes(fileExt)) {
      setError(
        `File type ${fileExt} not supported. Allowed: ${allowedTypes.join(", ")}`,
      );
      return;
    }

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/rag/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        await loadDocuments();
        await loadRAGStats();
        setCurrentStep(2); // 자동으로 다음 단계로
      } else {
        const errorData = await response.json();
        setError(errorData.message || "Upload failed");
      }
    } catch (error) {
      setError(
        `Upload error: ${error instanceof Error ? error.message : "Network error"}`,
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      const response = await fetch(`/api/rag/documents/${documentId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await loadDocuments();
        await loadRAGStats();
      } else {
        const errorData = await response.json();
        setError(errorData.message || "Delete failed");
      }
    } catch (error) {
      setError(
        `Delete error: ${error instanceof Error ? error.message : "Network error"}`,
      );
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  if (!stats) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading RAG system status...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <BookOpen className="w-8 h-8" />
          RAG 문서 관리 시스템
        </h1>
        <p className="text-gray-600">
          📝 3단계 플로우: 문서 업로드 → RAG 동작 확인 → QA 생성으로
          Before/After 비교
        </p>
      </div>

      {/* 진행 상태 표시 */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                currentStep >= 1
                  ? "bg-green-100 text-green-800"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {documents.length > 0 ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <span className="w-4 h-4 bg-current rounded-full" />
              )}
              1️⃣ 문서 업로드
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                currentStep >= 2
                  ? "bg-blue-100 text-blue-800"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {searchResults.length > 0 ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <span className="w-4 h-4 bg-current rounded-full" />
              )}
              2️⃣ RAG 동작 확인
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                currentStep >= 3
                  ? "bg-purple-100 text-purple-800"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              <span className="w-4 h-4 bg-current rounded-full" />
              3️⃣ QA 생성
            </div>
          </div>
        </div>
      </div>

      {error && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!stats.enabled && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            RAG system is currently disabled. Set FEATURE_RAG_CONTEXT=true to
            enable document context features.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-8">
        {/* 1단계: 문서 업로드 */}
        <Card className={`${currentStep === 1 ? "ring-2 ring-green-500" : ""}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              1️⃣ 문서 업로드
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 업로드 섹션 */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="file-upload">문서 선택</Label>
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".md,.txt,.json,.ts,.js,.py,text/markdown,text/plain,application/json,text/typescript,text/javascript,text/x-python"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    지원 형식: .md, .txt, .json, .ts, .js, .py
                  </p>
                  {!stats.enabled && (
                    <p className="text-sm text-amber-600 mt-1">
                      ⚠️ RAG 시스템이 비활성화되어 있습니다. 업로드는 가능하지만
                      인덱싱되지 않습니다.
                    </p>
                  )}
                </div>
                {uploading && (
                  <div className="text-blue-600">
                    문서를 업로드하고 처리하는 중...
                  </div>
                )}
              </div>

              {/* 문서 리스트 */}
              <div>
                <h3 className="font-medium mb-3">
                  업로드된 문서 ({documents.length}개)
                </h3>
                {documents.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                    아직 업로드된 문서가 없습니다
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 border rounded-lg text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-500" />
                          <div>
                            <div className="font-medium">
                              {doc.path.split("/").pop()}
                            </div>
                            <div className="text-gray-500">
                              {doc.chunkCount} chunks •{" "}
                              {formatFileSize(doc.size)}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteDocument(doc.id)}
                          disabled={!stats.enabled}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {documents.length > 0 && (
              <div className="mt-6 p-4 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">✅ 1단계 완료!</span>
                </div>
                <p className="text-green-700 mt-1">
                  문서가 성공적으로 업로드되었습니다. 이제 2단계에서 RAG 동작을
                  확인해보세요.
                </p>
                <Button
                  onClick={() => setCurrentStep(2)}
                  className="mt-3"
                  size="sm"
                >
                  다음 단계로 <ArrowDown className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2단계: RAG 동작 확인 */}
        {documents.length > 0 && (
          <Card
            className={`${currentStep === 2 ? "ring-2 ring-blue-500" : ""}`}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                2️⃣ RAG 동작 확인 (선택사항)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4">
                <Search className="h-4 w-4" />
                <AlertDescription>
                  <strong>목적:</strong> QA 생성 시 RAG가 어떻게 관련 문서를
                  찾는지 미리 확인해봅니다. 실제로는 자동으로 이루어지지만,
                  여기서는 수동으로 테스트할 수 있습니다.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="키워드를 입력하세요 (예: QA, Agent, System)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    disabled={!stats.enabled}
                  />
                  <Button
                    onClick={handleSearch}
                    disabled={!searchQuery.trim() || loading || !stats.enabled}
                  >
                    {loading ? "검색 중..." : "검색"}
                  </Button>
                </div>

                {searchResults.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">
                        검색 결과 ({searchResults.length}개)
                      </h3>
                      <div className="text-sm text-green-600">
                        ✅ RAG 동작 확인 완료!
                      </div>
                    </div>
                    <div className="grid gap-3 max-h-64 overflow-y-auto">
                      {searchResults.slice(0, 3).map((result) => (
                        <div key={result.id} className="border rounded-lg p-3">
                          <div className="flex justify-between items-start mb-2">
                            <Badge variant="outline" className="text-xs">
                              Score: {result.score.toFixed(3)}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              Chunk {result.chunk.id}
                            </span>
                          </div>
                          <div className="text-sm bg-gray-50 p-2 rounded">
                            {result.chunk.content.substring(0, 200)}
                            {result.chunk.content.length > 200 && "..."}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="p-4 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-2 text-blue-800">
                        <CheckCircle className="w-5 h-5" />
                        <span className="font-medium">✅ 2단계 완료!</span>
                      </div>
                      <p className="text-blue-700 mt-1">
                        RAG 시스템이 정상적으로 문서를 찾을 수 있습니다. 이제
                        3단계에서 실제 QA를 생성해보세요!
                      </p>
                      <Button
                        onClick={() => setCurrentStep(3)}
                        className="mt-3"
                        size="sm"
                      >
                        QA 생성하기 <ArrowDown className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* 2단계 스킵 옵션 */}
                {searchResults.length === 0 && (
                  <div className="text-center py-4">
                    <p className="text-gray-600 mb-3">
                      이 단계는 선택사항입니다.
                    </p>
                    <Button onClick={() => setCurrentStep(3)} variant="outline">
                      바로 QA 생성으로 넘어가기{" "}
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 3단계: QA 생성 */}
        {documents.length > 0 && currentStep >= 3 && (
          <Card className="ring-2 ring-purple-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5" />
                3️⃣ QA 생성 및 Before/After 비교
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4">
                <Lightbulb className="h-4 w-4" />
                <AlertDescription>
                  <strong>핵심 기능:</strong> 같은 주제로 RAG 적용 전후의 QA를
                  생성하여 품질 차이를 직접 비교해보세요. 업로드한 문서 내용이
                  어떻게 답변 품질을 향상시키는지 확인할 수 있습니다.
                </AlertDescription>
              </Alert>
              <QAGenerationTab
                stats={stats}
                error={error}
                setError={setError}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
