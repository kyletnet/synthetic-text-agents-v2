import { NextRequest, NextResponse } from 'next/server';
import { RAGSystem } from '@/lib/rag-utils';

export async function POST(request: NextRequest) {
  const sessionId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const inputType = formData.get('input_type') as string;

    if (!file) {
      console.error('Upload error: No file provided');
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['.md', '.txt', '.rtf', '.json', '.jsonl', '.ts', '.js', '.py'];
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!allowedTypes.includes(fileExt)) {
      console.error(`Upload error: File type ${fileExt} not supported. File: ${file.name}`);
      return NextResponse.json(
        { error: `File type ${fileExt} not supported. Allowed: ${allowedTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Read file content
    const content = await file.text();

    // Validate input type
    const validInputTypes = ['document', 'gold', 'mixed'];
    if (inputType && !validInputTypes.includes(inputType)) {
      console.error(`Upload error: Invalid input type ${inputType}. Valid types: ${validInputTypes.join(', ')}`);
      return NextResponse.json(
        { error: `Invalid input type. Allowed types: ${validInputTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Add to RAG system with input type context
    const startTime = Date.now();
    const document = RAGSystem.addDocument(file.name, content);
    const processingTime = Date.now() - startTime;

    console.log(`📄 Document uploaded: ${file.name} (${content.length} chars, input_type: ${inputType || 'default'})`)

    // Get updated stats
    const stats = RAGSystem.getStats();

    console.log(`📄 Document uploaded: ${file.name} (${content.length} chars, ${stats.chunksCount} total chunks)`);

    return NextResponse.json({
      success: true,
      sessionId,
      inputType: inputType || 'default',
      document: {
        id: document.id,
        filename: document.filename,
        size: content.length,
        uploadedAt: document.uploadedAt,
      },
      stats,
      processingTime,
      message: `File uploaded and processed successfully. Document has been chunked for RAG. Input type: ${inputType || 'default'}`,
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed', sessionId },
      { status: 500 }
    );
  }
}