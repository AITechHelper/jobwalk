import { auth } from "@clerk/nextjs/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

// Issues short-lived client-upload tokens for Vercel Blob. The browser
// uploads audio/photos directly to Blob storage (bypassing the 4.5MB
// serverless request-body limit); this route only authorizes the upload.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          "audio/webm",
          "audio/mp4",
          "audio/mpeg",
          "audio/ogg",
          "audio/wav",
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/heic",
        ],
        maximumSizeInBytes: 100 * 1024 * 1024, // 100MB — long walkthroughs
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {
        // Metadata is persisted by the finalize endpoint instead; nothing
        // to do here (this callback doesn't fire on localhost anyway).
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 400 },
    );
  }
}
