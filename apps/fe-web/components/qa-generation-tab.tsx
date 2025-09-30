"use client";

import { useState } from "react";
import {
  Play,
  Lightbulb,
  AlertCircle,
  FileText,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";

interface QAComparisonResult {
  qaId: string;
  question: string;
  baselineAnswer: string;
  ragAnswer: string;
  comparison: {
    ragEnabled: boolean;
    chunksUsed: number;
    contextLength: number;
    improvementAreas: string[];
    qualityDelta: number;
  };
  metadata: {
    confidence: number;
    domain: string;
    ragSessionId?: string;
    timestamp: string;
  };
}

interface QAGenerationResponse {
  success: boolean;
  sessionId: string;
  topic: string;
  results: QAComparisonResult[];
  metadata: {
    count: number;
    compareMode: boolean;
    ragEnabled: boolean;
    generatedAt: string;
    processingTime: number;
  };
}

interface RAGStats {
  enabled: boolean;
  documentsCount: number;
  chunksCount: number;
}

interface QAGenerationTabProps {
  stats: RAGStats;
  error: string;
  setError: (error: string) => void;
}

export default function QAGenerationTab({
  stats,
  error,
  setError,
}: QAGenerationTabProps) {
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(3);
  const [domainContext, setDomainContext] = useState("general");
  const [compareMode, setCompareMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<QAGenerationResponse | null>(null);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError("Topic is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/rag/generate-qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          count,
          domainContext,
          compareMode: stats.enabled && compareMode,
        }),
      });

      if (response.ok) {
        const data: QAGenerationResponse = await response.json();
        setResults(data);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "QA generation failed");
      }
    } catch (error) {
      setError(
        `Generation error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const getDeltaColor = (delta: number) => {
    if (delta > 0.2) return "text-green-600";
    if (delta > 0) return "text-blue-600";
    if (delta < -0.2) return "text-red-600";
    return "text-gray-600";
  };

  const getDeltaText = (delta: number) => {
    if (delta > 0.2) return "Strong Improvement";
    if (delta > 0) return "Slight Improvement";
    if (delta < -0.2) return "Quality Decrease";
    return "Similar Quality";
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5" />
            Generate QA Pairs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="topic">Topic</Label>
              <Input
                id="topic"
                placeholder="Enter the topic for QA generation (e.g., 'TypeScript interfaces')"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="count">Number of QA Pairs</Label>
                <Input
                  id="count"
                  type="number"
                  min="1"
                  max="10"
                  value={count}
                  onChange={(e) =>
                    setCount(
                      Math.max(1, Math.min(10, parseInt(e.target.value) || 1)),
                    )
                  }
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="domain">Domain Context</Label>
                <Input
                  id="domain"
                  placeholder="e.g., software, marketing, sales"
                  value={domainContext}
                  onChange={(e) => setDomainContext(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="flex items-center space-x-2 pt-6">
                <input
                  type="checkbox"
                  id="compare"
                  checked={compareMode}
                  onChange={(e) => setCompareMode(e.target.checked)}
                  disabled={loading || !stats.enabled}
                />
                <Label htmlFor="compare">
                  Compare Before/After
                  {!stats.enabled && (
                    <span className="text-gray-400 text-sm">
                      {" "}
                      (RAG disabled)
                    </span>
                  )}
                </Label>
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={!topic.trim() || loading}
              className="w-full md:w-auto"
            >
              {loading ? (
                <>
                  <Play className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Generate QA Pairs
                </>
              )}
            </Button>

            {!stats.enabled && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  RAG system is disabled. QA generation will use baseline mode
                  only. Enable RAG with FEATURE_RAG_CONTEXT=true for enhanced
                  context.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {results && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Generated QA Results ({results.results.length})
            </CardTitle>
            <div className="text-sm text-gray-600">
              Session: {results.sessionId} • Generated:{" "}
              {new Date(results.metadata.generatedAt).toLocaleString()}
              {results.metadata.compareMode && " • Comparison Mode"}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {results.results.map((qa, index) => (
                <div key={qa.qaId} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-start justify-between">
                    <h3 className="font-medium text-lg">
                      Q{index + 1}: {qa.question}
                    </h3>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        Confidence: {(qa.metadata.confidence * 100).toFixed(0)}%
                      </Badge>
                      {qa.comparison.ragEnabled && (
                        <Badge variant="outline">
                          Chunks: {qa.comparison.chunksUsed}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {results.metadata.compareMode && qa.comparison.ragEnabled ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-700">
                            Baseline Answer
                          </h4>
                          <Badge variant="secondary" className="text-xs">
                            Without RAG
                          </Badge>
                        </div>
                        <div className="bg-gray-50 p-3 rounded text-sm">
                          {qa.baselineAnswer}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <ArrowRight className="w-4 h-4 text-blue-500" />
                          <h4 className="font-medium text-gray-700">
                            Enhanced Answer
                          </h4>
                          <Badge variant="default" className="text-xs">
                            With RAG Context
                          </Badge>
                        </div>
                        <div className="bg-blue-50 p-3 rounded text-sm">
                          {qa.ragAnswer}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <h4 className="font-medium text-gray-700">Answer</h4>
                      <div className="bg-gray-50 p-3 rounded text-sm">
                        {qa.ragAnswer || qa.baselineAnswer}
                      </div>
                    </div>
                  )}

                  {qa.comparison.ragEnabled &&
                    qa.comparison.qualityDelta !== 0 && (
                      <div className="border-t pt-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">Quality Impact:</span>
                          <span
                            className={getDeltaColor(
                              qa.comparison.qualityDelta,
                            )}
                          >
                            {getDeltaText(qa.comparison.qualityDelta)} (
                            {qa.comparison.qualityDelta > 0 ? "+" : ""}
                            {(qa.comparison.qualityDelta * 100).toFixed(1)}%)
                          </span>
                        </div>
                        {qa.comparison.improvementAreas.length > 0 && (
                          <div className="mt-2">
                            <span className="text-sm font-medium">
                              Improvements:
                            </span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {qa.comparison.improvementAreas.map((area, i) => (
                                <Badge
                                  key={i}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {area}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                  <div className="text-xs text-gray-500 border-t pt-2">
                    Domain: {qa.metadata.domain} • Generated:{" "}
                    {new Date(qa.metadata.timestamp).toLocaleString()}
                    {qa.comparison.contextLength > 0 &&
                      ` • Context: ${qa.comparison.contextLength} chars`}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
