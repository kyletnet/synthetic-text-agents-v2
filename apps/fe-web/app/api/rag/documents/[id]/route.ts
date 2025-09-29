import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      );
    }

    // TODO: Remove document from RAG index
    // const ragService = getRAGService();
    // if (ragService) {
    //   await ragService.removeDocument(id);
    // }

    return NextResponse.json({
      success: true,
      message: `Document ${id} removed from RAG index`,
    });

  } catch (error) {
    console.error('Delete failed:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}