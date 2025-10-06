import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), "data", "uploads");

async function ensureUploadsDir() {
  if (!existsSync(uploadsDir)) {
    await mkdir(uploadsDir, { recursive: true });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureUploadsDir();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const inputType = formData.get("input_type") as string;

    if (!file) {
      return NextResponse.json(
        { error: true, message: "No file provided" },
        { status: 400 },
      );
    }

    // Validate file type
    const allowedTypes = [".txt", ".rtf", ".jsonl"];
    const fileExt = "." + file.name.split(".").pop()?.toLowerCase();

    if (!allowedTypes.includes(fileExt)) {
      return NextResponse.json(
        {
          error: true,
          message: `File type ${fileExt} not supported. Allowed types: ${allowedTypes.join(
            ", ",
          )}`,
        },
        { status: 400 },
      );
    }

    // Validate input type
    const allowedInputTypes = ["document", "gold", "mixed"];
    if (!allowedInputTypes.includes(inputType)) {
      return NextResponse.json(
        {
          error: true,
          message: `Invalid input type. Allowed types: ${allowedInputTypes.join(
            ", ",
          )}`,
        },
        { status: 400 },
      );
    }

    // Generate unique filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileId = `${timestamp}_${inputType}_${file.name.replace(
      /[^a-zA-Z0-9.-]/g,
      "_",
    )}`;
    const filePath = path.join(uploadsDir, fileId);

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, new Uint8Array(buffer));

    // Return success response
    return NextResponse.json({
      success: true,
      fileId,
      fileName: file.name,
      inputType,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      path: filePath,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      {
        error: true,
        message: error instanceof Error ? error.message : "Upload failed",
      },
      { status: 500 },
    );
  }
}
