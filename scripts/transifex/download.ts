import { transfiexGetRaw, transifexGet, transifexPost } from "./api";

export async function resourceTranslationDownload(id: string) {
  const data = await transifexPost("/resource_translations_async_downloads", {
    data: {
      attributes: {
        content_encoding: "text",
      },
      relationships: {
        language: { data: { id: "l:it", type: "languages" } },
        resource: { data: { id, type: "resources" } },
      },
      type: "resource_translations_async_downloads",
    },
  });

  const jobUrl = data.data.links.self;
  while (true) {
    const result = await transfiexGetRaw(jobUrl);
    const status = result?.data?.attributes?.status;
    if (status === "failed") {
      throw new Error(
        result?.data?.attributes?.errors
          ?.map((e: any) => `${e.code}: ${e.detail}`)
          .join(", ") ?? "generic error"
      );
    }
    if (status !== "pending" && status !== "processing") {
      return result;
    }
    await delay(200);
  }
}

export function delay(ms: number) {
  return new Promise<void>((ful) => setTimeout(() => ful(), ms));
}
