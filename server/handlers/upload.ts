/** @file File upload route handler */
import { handleS3Upload, getUploadedFiles } from "../../app/util/s3.server.ts";

/**
 * Convert FormData file entry to async iterable
 */
async function* formDataToAsyncIterable(file: File): AsyncIterable<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  const chunkSize = 1024;
  let offset = 0;

  while (offset < uint8Array.length) {
    const chunk = uint8Array.slice(offset, offset + chunkSize);
    offset += chunkSize;
    yield chunk;
  }
}

export async function handleUpload(req: Request): Promise<Response> {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return new Response("No files provided", { status: 400 });
    }

    // Process each file
    for (const file of files) {
      if (file instanceof File) {
        const data = formDataToAsyncIterable(file);
        await handleS3Upload("files", file.type, data);
      }
    }

    // Force refresh of file cache
    await getUploadedFiles(true);

    // Redirect to home page
    return new Response(null, {
      status: 303,
      headers: { Location: "/" },
    });
  } catch (error) {
    console.error("Upload error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return new Response(`Upload failed: ${errorMessage}`, { status: 500 });
  }
}
