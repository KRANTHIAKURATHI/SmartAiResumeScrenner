/**
 * Server-only resume text extraction. PDFs go through unpdf (edge compatible);
 * .docx is unzipped and stripped of OOXML markup; text/markdown is read directly.
 */

export class ResumeExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResumeExtractionError";
  }
}

const MIN_USEFUL_CHARS = 120;

function xmlToText(xml: string): string {
  return xml
    .replace(/<w:tab[^>]*\/>/g, "\t")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function extractDocx(file: Blob): Promise<string> {
  const { unzipSync, strFromU8 } = await import("fflate");
  const zipped = new Uint8Array(await file.arrayBuffer());
  const files = unzipSync(zipped, {
    filter: (f) => f.name === "word/document.xml" || f.name.startsWith("word/header") || f.name.startsWith("word/footer"),
  });
  const main = files["word/document.xml"];
  if (!main) throw new ResumeExtractionError("This Word file couldn't be read. Try exporting it as PDF.");
  return xmlToText(strFromU8(main));
}

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
  } else if (lower.endsWith(".docx")) {
    try {
      text = await extractDocx(file);
    } catch (error) {
      if (error instanceof ResumeExtractionError) throw error;
      console.error("[resume-extract] docx failure", error);
      throw new ResumeExtractionError("This Word file couldn't be read. Try exporting it as PDF.");
    }
  } else if (lower.endsWith(".doc")) {
    throw new ResumeExtractionError("Legacy .doc files aren't supported. Save as .docx or PDF and upload again.");
  } else if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    text = await file.text();
  } else {
    throw new ResumeExtractionError("Unsupported file type. Upload a PDF, DOCX or text resume.");
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
