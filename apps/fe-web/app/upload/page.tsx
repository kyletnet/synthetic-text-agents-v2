"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, File } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [inputType, setInputType] = useState<string>("document");
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      const allowedTypes = [".txt", ".rtf", ".jsonl"];
      const fileExt = "." + selectedFile.name.split(".").pop()?.toLowerCase();

      if (!allowedTypes.includes(fileExt)) {
        setUploadStatus(
          `Error: Only ${allowedTypes.join(", ")} files are supported`,
        );
        return;
      }

      setFile(selectedFile);
      setUploadStatus("");
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setUploadStatus("Please select a file");
      return;
    }

    setUploading(true);
    setUploadStatus("Uploading...");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("input_type", inputType);

      const apiBase = process.env.NEXT_PUBLIC_API_BASE || "/api";
      const response = await fetch(`${apiBase}/upload`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        setUploadStatus(`Upload successful! File ID: ${result.fileId}`);

        // Store file info for later use
        localStorage.setItem(
          "lastUpload",
          JSON.stringify({
            fileId: result.fileId,
            fileName: file.name,
            inputType: inputType,
            uploadedAt: new Date().toISOString(),
          }),
        );

        // Redirect to run page after successful upload
        setTimeout(() => {
          router.push("/run");
        }, 1500);
      } else {
        const error = await response.json();
        setUploadStatus(`Upload failed: ${error.message || "Unknown error"}`);
      }
    } catch (error) {
      setUploadStatus(
        `Upload failed: ${error instanceof Error ? error.message : "Network error"}`,
      );
    } finally {
      setUploading(false);
    }
  };

  const getFileIcon = () => {
    if (!file) return <File className="w-8 h-8 text-gray-400" />;

    const ext = file.name.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "txt":
        return <FileText className="w-8 h-8 text-blue-500" />;
      case "rtf":
        return <FileText className="w-8 h-8 text-purple-500" />;
      case "jsonl":
        return <File className="w-8 h-8 text-green-500" />;
      default:
        return <File className="w-8 h-8 text-gray-400" />;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Upload Data</h1>
        <p className="text-gray-600">
          Upload your document or QA pair files to start the generation process
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            File Upload
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Input Type Selector */}
          <div className="space-y-2">
            <Label htmlFor="input-type">Input Type</Label>
            <Select value={inputType} onValueChange={setInputType}>
              <SelectTrigger>
                <SelectValue placeholder="Select input type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="document">Document</SelectItem>
                <SelectItem value="gold">Gold QA Pairs</SelectItem>
                <SelectItem value="mixed">
                  Mixed (Document + Examples)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-500">
              {inputType === "document" &&
                "Upload a text document to generate QA pairs from"}
              {inputType === "gold" &&
                "Upload existing QA pairs in JSONL format for evaluation"}
              {inputType === "mixed" &&
                "Upload both document and example QA pairs"}
            </p>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="file-upload">File</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
              <input
                id="file-upload"
                type="file"
                accept=".txt,.rtf,.jsonl"
                onChange={handleFileChange}
                className="hidden"
              />

              {file ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    {getFileIcon()}
                    <span className="font-medium">{file.name}</span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      document.getElementById("file-upload")?.click()
                    }
                  >
                    Change File
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                  <div>
                    <Button
                      variant="outline"
                      onClick={() =>
                        document.getElementById("file-upload")?.click()
                      }
                    >
                      Choose File
                    </Button>
                  </div>
                  <p className="text-sm text-gray-500">
                    Supported formats: .txt, .rtf, .jsonl
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Upload Status */}
          {uploadStatus && (
            <div
              className={`p-3 rounded-md ${
                uploadStatus.includes("Error") ||
                uploadStatus.includes("failed")
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : uploadStatus.includes("successful")
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-blue-50 text-blue-700 border border-blue-200"
              }`}
            >
              {uploadStatus}
            </div>
          )}

          {/* Upload Button */}
          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full"
            size="lg"
          >
            {uploading ? "Uploading..." : "Upload File"}
          </Button>

          {/* Help Text */}
          <div className="text-sm text-gray-500 space-y-1">
            <p>
              <strong>File Types:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>
                <strong>.txt</strong> - Plain text documents
              </li>
              <li>
                <strong>.rtf</strong> - Rich text format documents
              </li>
              <li>
                <strong>.jsonl</strong> - JSON Lines format for QA pairs
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
