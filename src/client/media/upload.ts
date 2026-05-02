import { mediaCreateSignedUpload, mediaRegister } from "../../server/fn/media";

/** Uploads one browser File through the configured storage adapter's signed URL flow. */
export async function uploadMediaFile(params: {
  file: File;
  folder?: string;
  path?: string;
  upsert?: boolean;
}): Promise<{ path: string; publicUrl: string }> {
  const folder = params.path ? params.path.split("/").slice(0, -1).join("/") : params.folder;
  const signed = await mediaCreateSignedUpload({
    data: {
      filename: params.path?.split("/").at(-1) ?? params.file.name,
      contentType: params.file.type || "application/octet-stream",
      ...(folder ? { folder } : {}),
      ...(params.upsert === undefined ? {} : { upsert: params.upsert }),
    },
  });

  const response = await fetch(signed.uploadUrl, {
    method: signed.method,
    headers: signed.headers,
    body: params.file,
  });
  if (!response.ok) {
    throw new Error(`Upload failed with ${response.status}`);
  }

  const registered = await mediaRegister({
    data: {
      path: signed.libraryPath,
      mimeType: params.file.type || "application/octet-stream",
      size: params.file.size,
    },
  });

  return {
    path: registered.item.path,
    publicUrl: registered.item.publicUrl,
  };
}
