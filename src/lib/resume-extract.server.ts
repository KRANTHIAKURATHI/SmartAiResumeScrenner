/**
 * Server-only resume text extraction. PDFs go through unpdf (edge compatible);
 * text/markdown resumes are read directly.
 */

export class ResumeExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResumeExtractionError";
  }
}

const MIN_USEFUL_CHARS = 120;

export async function extractResumeText(file: Blob, filename: string): Promise<string> {
  const lower = filename.toLowerCase();
  let text = "";

  if (lower.endsWith(".pdf")) {
    try {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const buffer = new Uint8Array(await file.arrayBuffer());
      const pdf = await getDocumentProxy(buffer);
      const result = await extractText(pdf, { mergePages: true });
      text = Array.isArray(result.text) ? result.text.join("\n") : result.text;
    } catch (error) {
      console.error("[resume-extract] pdf failure", error);
      throw new ResumeExtractionError(
        "This PDF couldn't be read. It may be corrupted or password protected.",
      );
    }
  } else if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    text = await file.text();
  } else {
    throw new ResumeExtractionError("Unsupported file type. Upload a PDF or text resume.");
  }

  const cleaned = text
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (cleaned.replace(/\s/g, "").length < MIN_USEFUL_CHARS) {
    throw new ResumeExtractionError(
      "No readable text found in this document. It may be a scanned or image-based resume.",
    );
  }

  return cleaned.slice(0, 24000);
}
