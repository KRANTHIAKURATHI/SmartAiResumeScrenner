import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Upload, FileText, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { screenApplication } from "@/lib/screening.functions";
import { validateResumeFile, formatBytes, ACCEPTED_RESUME_TYPES } from "@/lib/domain";
import { btn } from "@/components/app/primitives";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type QueueItem = {
  id: string;
  file: File;
  state: "queued" | "uploading" | "screening" | "done" | "error";
  message?: string;
};

export function ResumeUpload({ jobId }: { jobId: string }) {
  const queryClient = useQueryClient();
  const screen = useServerFn(screenApplication);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);

  const patch = (id: string, changes: Partial<QueueItem>) =>
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...changes } : item)));

  const processOne = useCallback(
    async (item: QueueItem) => {
      patch(item.id, { state: "uploading", message: undefined });

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        patch(item.id, { state: "error", message: "Your session expired. Sign in again." });
        return;
      }

      const safeName = item.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${userId}/${crypto.randomUUID()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(path, item.file, { contentType: item.file.type || "application/octet-stream" });
      if (uploadError) {
        patch(item.id, { state: "error", message: "Upload failed. Check your connection and retry." });
        return;
      }

      const { data: candidate, error: candidateError } = await supabase
        .from("candidates")
        .insert({
          user_id: userId,
          name: "Unknown candidate",
          resume_path: path,
          resume_filename: item.file.name,
        })
        .select("id")
        .single();
      if (candidateError || !candidate) {
        patch(item.id, { state: "error", message: "Could not create the candidate record." });
        return;
      }

      const { data: application, error: applicationError } = await supabase
        .from("applications")
        .insert({
          user_id: userId,
          job_id: jobId,
          candidate_id: candidate.id,
          source_filename: item.file.name,
          status: "uploaded",
        })
        .select("id")
        .single();
      if (applicationError || !application) {
        patch(item.id, { state: "error", message: "Could not attach this resume to the job." });
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["applications"] });
      patch(item.id, { state: "screening" });

      try {
        const result = await screen({ data: { applicationId: application.id } });
        if (result.ok) {
          patch(item.id, { state: "done", message: `Scored ${result.score}/10` });
        } else {
          patch(item.id, { state: "error", message: result.error });
        }
      } catch (error) {
        console.error(error);
        patch(item.id, { state: "error", message: "Screening could not be completed. Retry from the table." });
      } finally {
        queryClient.invalidateQueries({ queryKey: ["applications"] });
        queryClient.invalidateQueries({ queryKey: ["candidates"] });
      }
    },
    [jobId, queryClient, screen],
  );

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const incoming: QueueItem[] = [];
      for (const file of Array.from(files)) {
        const problem = validateResumeFile(file);
        if (problem) {
          toast.error(`${file.name}: ${problem}`);
          continue;
        }
        incoming.push({ id: crypto.randomUUID(), file, state: "queued" });
      }
      if (!incoming.length) return;
      setQueue((prev) => [...prev, ...incoming]);
      setRunning(true);
      for (const item of incoming) {
        await processOne(item);
      }
      setRunning(false);
    },
    [processOne],
  );

  return (
    <section>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center border border-dashed px-6 py-10 text-center transition-colors",
          dragging ? "border-primary bg-accent" : "border-border bg-paper",
        )}
      >
        <Upload className="size-5 text-muted-foreground" strokeWidth={1.5} aria-hidden />
        <p className="mt-3 font-serif text-lg">Drop resumes to screen</p>
        <p className="mt-1 text-xs text-muted-foreground">
          PDF, TXT or MD · up to 10 MB each · multiple files supported
        </p>
        <button type="button" className={cn(btn.ghost, "mt-4")} onClick={() => inputRef.current?.click()}>
          Choose files
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_RESUME_TYPES.join(",")}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {queue.length > 0 && (
        <ul className="mt-4 divide-y divide-rule border-y border-rule">
          {queue.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-2.5">
              <FileText className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm">{item.file.name}</span>
              <span className="hidden text-xs text-muted-foreground sm:inline">{formatBytes(item.file.size)}</span>
              <span
                className={cn(
                  "w-40 text-right text-xs",
                  item.state === "error" ? "text-destructive" : "text-muted-foreground",
                  item.state === "done" && "text-primary",
                )}
              >
                {item.state === "queued" && "Waiting"}
                {item.state === "uploading" && "Uploading…"}
                {item.state === "screening" && "Screening…"}
                {(item.state === "done" || item.state === "error") && item.message}
              </span>
              {!running && (
                <button
                  aria-label={`Remove ${item.file.name} from list`}
                  onClick={() => setQueue((prev) => prev.filter((q) => q.id !== item.id))}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" strokeWidth={1.75} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
