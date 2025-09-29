import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Mock documents data - replace with actual RAG service call
    const mockDocuments = {
      documents: [
        {
          id: 'claude-md',
          path: './CLAUDE.md',
          chunkCount: 25,
          lastModified: new Date().toISOString(),
          size: 15420,
          metadata: {
            strategy: 'markdown',
            indexed: true,
          },
        },
        {
          id: 'readme-md',
          path: './README.md',
          chunkCount: 8,
          lastModified: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          size: 5120,
          metadata: {
            strategy: 'paragraph-pack',
            indexed: true,
          },
        },
      ],
    };

    // TODO: Replace with actual RAG service call
    // const response = await fetch(`${process.env.BACKEND_URL}/api/rag/documents`);
    // const documents = await response.json();

    return NextResponse.json(mockDocuments);
  } catch (error) {
    console.error('Failed to fetch documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}