"use client";

import { ArrowDownToLine, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  downloadBrief,
  makeBrief,
  type WorkspaceDocument,
} from "@/lib/documents";

export function ExportDialog({
  doc,
  open,
  onOpenChange,
}: {
  doc: WorkspaceDocument;
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const text = makeBrief(doc);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Brief copied to your clipboard.");
    } catch {
      toast.error(
        "Copy is unavailable in this browser. Select and copy the text below.",
      );
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="export-modal">
        <DialogHeader>
          <DialogTitle>Your preparation brief</DialogTitle>
          <DialogDescription>
            Includes the review, original text, checklist, and your notes. Check
            the content before sharing it with a legal professional.
          </DialogDescription>
        </DialogHeader>
        <textarea
          aria-label="Preparation brief"
          className="brief-preview"
          value={text}
          readOnly
          rows={15}
        />
        <div className="modal-actions">
          <button className="secondary-button" onClick={copy}>
            <Copy size={16} />
            Copy brief
          </button>
          <button
            className="primary-button"
            onClick={() => {
              downloadBrief(doc);
              toast.success(
                "Download requested. You can also copy the brief here.",
              );
            }}
          >
            <ArrowDownToLine size={16} />
            Download .txt
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
