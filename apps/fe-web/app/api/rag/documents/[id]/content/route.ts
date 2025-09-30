import { NextRequest, NextResponse } from "next/server";
import { RAGSystem } from "@/lib/rag-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "Document ID is required" },
        { status: 400 },
      );
    }

    // 문서 찾기
    const documents = RAGSystem.getDocuments();
    const document = documents.find((doc) => doc.id === id);

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      content: document.content,
      metadata: {
        id: document.id,
        filename: document.filename,
        contentLength: document.content.length,
        uploadedAt: document.uploadedAt,
      },
    });
  } catch (error) {
    console.error("Failed to get document content:", error);
    return NextResponse.json(
      { error: "Failed to retrieve document content" },
      { status: 500 },
    );
  }
}
