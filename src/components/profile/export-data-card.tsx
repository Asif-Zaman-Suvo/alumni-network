"use client";

import * as React from "react";
import { DownloadIcon } from "lucide-react";
import { exportOwnDataAction, exportOwnDataXlsxAction } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toaster";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function base64ToBlob(base64: string, mimeType: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

export function ExportDataCard() {
  const [pending, startTransition] = React.useTransition();
  const [pendingFormat, setPendingFormat] = React.useState<"json" | "xlsx" | null>(null);

  const runExport = (format: "json" | "xlsx", work: () => Promise<void>) => {
    setPendingFormat(format);
    startTransition(async () => {
      try {
        await work();
      } finally {
        setPendingFormat(null);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Download your data</CardTitle>
        <CardDescription>
          A machine-readable copy of your account, profile and verification submissions.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            runExport("json", async () => {
              const result = await exportOwnDataAction();
              if (!result.ok) {
                toast({ title: result.error, variant: "error" });
                return;
              }
              const date = new Date().toISOString().slice(0, 10);
              triggerDownload(
                new Blob([JSON.stringify(result.data, null, 2)], {
                  type: "application/json",
                }),
                `alumni-data-export-${date}.json`,
              );
              toast({ title: "Export downloaded.", variant: "success" });
            })
          }
        >
          <DownloadIcon />
          {pendingFormat === "json" ? "Preparing..." : "Download JSON"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            runExport("xlsx", async () => {
              const result = await exportOwnDataXlsxAction();
              if (!result.ok) {
                toast({ title: result.error, variant: "error" });
                return;
              }
              triggerDownload(
                base64ToBlob(result.data.base64, result.data.mimeType),
                result.data.filename,
              );
              toast({ title: "Export downloaded.", variant: "success" });
            })
          }
        >
          <DownloadIcon />
          {pendingFormat === "xlsx" ? "Preparing..." : "Download Excel"}
        </Button>
      </CardContent>
    </Card>
  );
}
