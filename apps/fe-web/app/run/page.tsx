"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Play, CheckCircle, Clock, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type RunStatus = "idle" | "running" | "completed" | "error";

interface UploadInfo {
  fileId: string;
  fileName: string;
  inputType: string;
  uploadedAt: string;
}

export default function RunPage() {
  const router = useRouter();
  const [uploadInfo, setUploadInfo] = useState<UploadInfo | null>(null);
  const [qaStatus, setQaStatus] = useState<RunStatus>("idle");
  const [evalStatus, setEvalStatus] = useState<RunStatus>("idle");
  const [qaResult, setQaResult] = useState<any>(null);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");

  useEffect(() => {
    // Load upload info from localStorage
    const stored = localStorage.getItem("lastUpload");
    if (stored) {
      try {
        setUploadInfo(JSON.parse(stored));
      } catch (error) {
        console.error("Failed to parse upload info:", error);
      }
    }
  }, []);

  const runQAGeneration = async () => {
    if (!uploadInfo) {
      setStatusMessage("No file uploaded. Please go to upload page first.");
      return;
    }

    setQaStatus("running");
    setStatusMessage("Starting QA generation...");

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || "/api";
      const response = await fetch(`${apiBase}/run/qa`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileId: uploadInfo.fileId,
          inputType: uploadInfo.inputType,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setQaResult(result);
        setQaStatus("completed");
        setStatusMessage(
          `QA generation completed! Generated ${result.pairsGenerated || "N/A"} QA pairs.`,
        );
      } else {
        const error = await response.json();
        setQaStatus("error");
        setStatusMessage(
          `QA generation failed: ${error.message || "Unknown error"}`,
        );
      }
    } catch (error) {
      setQaStatus("error");
      setStatusMessage(
        `QA generation failed: ${error instanceof Error ? error.message : "Network error"}`,
      );
    }
  };

  const runQualityEvaluation = async () => {
    if (!uploadInfo && !qaResult) {
      setStatusMessage(
        "No QA data available for evaluation. Run QA generation first.",
      );
      return;
    }

    setEvalStatus("running");
    setStatusMessage("Starting quality evaluation...");

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || "/api";
      const response = await fetch(`${apiBase}/run/eval`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileId: uploadInfo?.fileId,
          runId: qaResult?.runId,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setEvalResult(result);
        setEvalStatus("completed");
        setStatusMessage(
          `Quality evaluation completed! Overall score: ${result.overallScore || "N/A"}`,
        );

        // Store completion status for results page
        localStorage.setItem(
          "lastRun",
          JSON.stringify({
            qaCompleted: qaStatus === "completed",
            evalCompleted: true,
            qaResult,
            evalResult: result,
            completedAt: new Date().toISOString(),
          }),
        );
      } else {
        const error = await response.json();
        setEvalStatus("error");
        setStatusMessage(
          `Quality evaluation failed: ${error.message || "Unknown error"}`,
        );
      }
    } catch (error) {
      setEvalStatus("error");
      setStatusMessage(
        `Quality evaluation failed: ${error instanceof Error ? error.message : "Network error"}`,
      );
    }
  };

  const getStatusIcon = (status: RunStatus) => {
    switch (status) {
      case "running":
        return <Clock className="w-5 h-5 text-blue-500 animate-spin" />;
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "error":
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Play className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: RunStatus) => {
    switch (status) {
      case "running":
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            Running
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            Completed
          </Badge>
        );
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Ready</Badge>;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Run QA Generation & Evaluation
        </h1>
        <p className="text-gray-600">
          Generate QA pairs from your uploaded data and evaluate their quality
        </p>
      </div>

      {/* Upload Status */}
      {uploadInfo ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Uploaded File</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{uploadInfo.fileName}</p>
                <p className="text-sm text-gray-500">
                  Type: {uploadInfo.inputType} • Uploaded:{" "}
                  {new Date(uploadInfo.uploadedAt).toLocaleString()}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/upload")}
              >
                Upload New File
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-6 border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              <div>
                <p className="font-medium text-orange-800">No file uploaded</p>
                <p className="text-sm text-orange-600">
                  Please upload a file first to continue.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => router.push("/upload")}
                className="ml-auto"
              >
                Go to Upload
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Run Controls */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* QA Generation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                {getStatusIcon(qaStatus)}
                QA Generation
              </span>
              {getStatusBadge(qaStatus)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Generate question-answer pairs from your uploaded document using
              the 8-Agent orchestration system.
            </p>

            {qaResult && (
              <div className="p-3 bg-gray-50 rounded-md text-sm">
                <p>
                  <strong>Run ID:</strong> {qaResult.runId}
                </p>
                <p>
                  <strong>Pairs Generated:</strong>{" "}
                  {qaResult.pairsGenerated || "N/A"}
                </p>
                <p>
                  <strong>Processing Time:</strong>{" "}
                  {qaResult.processingTime || "N/A"}
                </p>
              </div>
            )}

            <Button
              onClick={runQAGeneration}
              disabled={!uploadInfo || qaStatus === "running"}
              className="w-full"
              size="lg"
            >
              {qaStatus === "running" ? "Generating..." : "Generate QA"}
            </Button>
          </CardContent>
        </Card>

        {/* Quality Evaluation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                {getStatusIcon(evalStatus)}
                Quality Evaluation
              </span>
              {getStatusBadge(evalStatus)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Evaluate the quality of generated QA pairs using comprehensive
              metrics including duplication, evidence quality, and hallucination
              detection.
            </p>

            {evalResult && (
              <div className="p-3 bg-gray-50 rounded-md text-sm">
                <p>
                  <strong>Overall Score:</strong>{" "}
                  {evalResult.overallScore || "N/A"}
                </p>
                <p>
                  <strong>Quality Level:</strong>{" "}
                  {evalResult.qualityLevel || "N/A"}
                </p>
                <p>
                  <strong>Issues Found:</strong> {evalResult.issuesCount || 0}
                </p>
              </div>
            )}

            <Button
              onClick={runQualityEvaluation}
              disabled={(!uploadInfo && !qaResult) || evalStatus === "running"}
              className="w-full"
              size="lg"
              variant={qaStatus === "completed" ? "default" : "secondary"}
            >
              {evalStatus === "running" ? "Evaluating..." : "Evaluate Quality"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Status Message */}
      {statusMessage && (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <p
              className={`text-sm ${
                statusMessage.includes("failed") ||
                statusMessage.includes("error")
                  ? "text-red-600"
                  : statusMessage.includes("completed")
                    ? "text-green-600"
                    : "text-blue-600"
              }`}
            >
              {statusMessage}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      {(qaStatus === "completed" || evalStatus === "completed") && (
        <div className="mt-8 flex gap-4 justify-center">
          <Button
            onClick={() => router.push("/results")}
            variant="outline"
            size="lg"
          >
            View Results
          </Button>
          <Button
            onClick={() => router.push("/dashboard")}
            variant="outline"
            size="lg"
          >
            View Dashboard
          </Button>
        </div>
      )}
    </div>
  );
}
