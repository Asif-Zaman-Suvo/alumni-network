"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  CheckIcon,
  CopyIcon,
  FileTextIcon,
  ShieldAlertIcon,
  XIcon,
} from "lucide-react";
import {
  bulkApproveAction,
  getCertificateUrlAction,
  reviewVerificationAction,
} from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import type { ReviewQueueItem } from "@/lib/dal/admin";

type ReviewQueueProps = { items: ReviewQueueItem[]; canDecide: boolean };

export function ReviewQueue({ items, canDecide }: ReviewQueueProps) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [rejecting, setRejecting] = React.useState<ReviewQueueItem | null>(null);
  const [reviewNote, setReviewNote] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const selectableIds = items.filter((item) => !item.duplicateOfVerified).map((item) => item.id);
  const allSelected = selectableIds.length > 0 && selected.size === selectableIds.length;

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runAction = (work: () => Promise<{ ok: boolean; message?: string; error?: string }>) => {
    startTransition(async () => {
      const result = await work();
      toast({
        title: result.ok ? (result.message ?? "Done.") : (result.error ?? "Something went wrong."),
        variant: result.ok ? "success" : "error",
      });
      if (result.ok) {
        setSelected(new Set());
        setRejecting(null);
        setReviewNote("");
        router.refresh();
      }
    });
  };

  const approve = (item: ReviewQueueItem) => {
    const formData = new FormData();
    formData.set("requestId", item.id);
    formData.set("decision", "APPROVE");
    runAction(() => reviewVerificationAction(formData));
  };

  const confirmReject = () => {
    if (!rejecting) return;
    const formData = new FormData();
    formData.set("requestId", rejecting.id);
    formData.set("decision", "REJECT");
    formData.set("reviewNote", reviewNote);
    runAction(() => reviewVerificationAction(formData));
  };

  const openCertificate = (item: ReviewQueueItem) => {
    startTransition(async () => {
      const result = await getCertificateUrlAction(item.id);
      if (result.ok) {
        window.open(result.data.url, "_blank", "noopener,noreferrer");
      } else {
        toast({ title: result.error, variant: "error" });
      }
    });
  };

  return (
    <div className="space-y-4">
      {canDecide && selectableIds.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
          <Label className="flex items-center gap-2 text-sm font-normal">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(checked) =>
                setSelected(checked === true ? new Set(selectableIds) : new Set())
              }
            />
            Select all on this page
          </Label>

          {selected.size > 0 ? (
            <Button
              size="sm"
              disabled={pending}
              onClick={() => runAction(() => bulkApproveAction([...selected]))}
            >
              <CheckIcon />
              Approve {selected.size} selected
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Use this after checking a printed batch list. Duplicates cannot be selected.
            </p>
          )}
        </div>
      ) : null}

      {items.map((item) => (
        <Card key={item.id} className={item.duplicateOfVerified ? "border-destructive/40" : ""}>
          <CardContent className="space-y-4 pt-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                {canDecide && !item.duplicateOfVerified ? (
                  <Checkbox
                    checked={selected.has(item.id)}
                    onCheckedChange={() => toggle(item.id)}
                    className="mt-1"
                    aria-label={`Select ${item.fullNameOnCert}`}
                  />
                ) : null}

                <div>
                  <p className="font-medium">{item.fullNameOnCert}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.user.email} · submitted{" "}
                    {formatDistanceToNow(item.createdAt, { addSuffix: true })}
                    {item.attemptNumber > 1 ? ` · attempt ${item.attemptNumber}` : ""}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {item.hasDocument ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => openCertificate(item)}
                  >
                    <FileTextIcon />
                    View certificate
                  </Button>
                ) : (
                  <Badge variant="warning">No document</Badge>
                )}
              </div>
            </div>

            {item.duplicateOfVerified ? (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/8 p-3 text-sm">
                <ShieldAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
                <p className="text-muted-foreground">
                  These SSC details are already approved on another account. Investigate
                  before deciding — approving this would be rejected by the database anyway.
                </p>
              </div>
            ) : null}

            <dl className="grid gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">SSC roll</dt>
                <dd className="mt-0.5 flex items-center gap-1.5 font-medium tabular-nums">
                  {item.sscRoll}
                  <CopyButton value={item.sscRoll} label="roll number" />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Registration</dt>
                <dd className="mt-0.5 flex items-center gap-1.5 font-medium tabular-nums">
                  {item.sscRegistration}
                  <CopyButton value={item.sscRegistration} label="registration number" />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Passing year</dt>
                <dd className="mt-0.5 font-medium tabular-nums">{item.passingYear}</dd>
              </div>
            </dl>

            {canDecide && item.status === "PENDING" ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="success"
                  size="sm"
                  disabled={pending}
                  onClick={() => approve(item)}
                >
                  <CheckIcon />
                  Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    setRejecting(item);
                    setReviewNote("");
                  }}
                >
                  <XIcon />
                  Reject
                </Button>
              </div>
            ) : null}

            {item.reviewNote ? (
              <p className="text-xs text-muted-foreground">
                Reviewer note: {item.reviewNote}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ))}

      <Dialog
        open={rejecting !== null}
        onOpenChange={(open) => {
          if (!open) setRejecting(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this request</DialogTitle>
            <DialogDescription>
              {rejecting?.fullNameOnCert} will see this note and may submit again.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="reviewNote">Reason</Label>
            <Textarea
              id="reviewNote"
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
              rows={4}
              maxLength={500}
              placeholder="e.g. The roll number does not match our 2016 records. Please re-check your marksheet and attach a photo."
            />
            <p className="text-xs text-muted-foreground">
              At least 10 characters. A vague reason means they will just resubmit the same
              thing.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={reviewNote.trim().length < 10 || pending}
              onClick={confirmReject}
            >
              {pending ? "Rejecting..." : "Reject and notify"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  return (
    <button
      type="button"
      className="text-muted-foreground transition-colors hover:text-foreground"
      onClick={() => {
        void navigator.clipboard.writeText(value);
        toast({ title: `Copied ${label}.`, variant: "info" });
      }}
    >
      <CopyIcon className="size-3.5" />
      <span className="sr-only">Copy {label}</span>
    </button>
  );
}
