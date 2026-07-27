"use client";

import * as React from "react";
import { DownloadIcon } from "lucide-react";
import { exportOwnDataAction } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toaster";

export function ExportDataCard() {
  const [pending, startTransition] = React.useTransition();

  const handleExport = () => {
    startTransition(async () => {
      const result = await exportOwnDataAction();
      if (!result.ok) {
        toast({ title: result.error, variant: "error" });
        return;
      }

      const blob = new Blob([JSON.stringify(result.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `alumni-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export downloaded.", variant: "success" });
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
      <CardContent>
        <Button variant="outline" size="sm" disabled={pending} onClick={handleExport}>
          <DownloadIcon />
          {pending ? "Preparing..." : "Download JSON"}
        </Button>
      </CardContent>
    </Card>
  );
}
