import { NextRequest, NextResponse } from "next/server";
import { RAGSystem } from "@/lib/rag-utils";

export async function POST(request: NextRequest) {
  const searchId = `search_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 11)}`;

  try {
    const body = await request.json();
    const { query, topK = 5 } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required and must be a string" },
        { status: 400 },
      );
    }

    // Use real RAG system search
    const startTime = Date.now();
    const searchResults = RAGSystem.search(query, topK);
    const searchDuration = Date.now() - startTime;

    // Format results for API response
    const formattedResults = searchResults.map((result) => ({
      id: result.chunk.id,
      score: Math.round(result.score * 100) / 100, // Round to 2 decimal places
      algorithm: result.algorithm,
      chunk: {
        id: result.chunk.id,
        content: result.chunk.content,
        meta: {
          strategy: "smart_chunking",
          source: result.chunk.metadata.filename,
          chunkIndex: result.chunk.metadata.chunkIndex,
        },
      },
    }));

    const stats = RAGSystem.getStats();

    console.log(
      `🔍 Search performed: "${query}" (${searchResults.length} results, ${searchDuration}ms)`,
    );

    return NextResponse.json({
      success: true,
      searchId,
      query,
      results: formattedResults,
      metadata: {
        searchDuration,
        totalChunks: stats.chunksCount,
        resultsCount: formattedResults.length,
        algorithm: "bm25",
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Search request failed", searchId },
      { status: 500 },
    );
  }
}
