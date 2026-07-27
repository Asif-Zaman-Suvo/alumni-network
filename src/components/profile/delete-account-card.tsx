"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { deleteOwnAccountAction } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";

const CONFIRM_WORD = "DELETE";

export function DeleteAccountCard() {
  const router = useRouter();
  const [confirmation, setConfirmation] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteOwnAccountAction();
      if (result.ok) {
        toast({ title: result.message ?? "Account closed.", variant: "success" });
        // Sign-out happens server side on the next request; land on the marketing page.
        router.push("/");
        router.refresh();
      } else {
        toast({ title: result.error, variant: "error" });
      }
    });
  };

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-base text-destructive">Close your account</CardTitle>
        <CardDescription>
          Your profile is removed from the directory immediately and every field is cleared.
          The verification record is kept so the alumni office retains an audit trail.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="destructive" size="sm">
              Close my account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Close your account?</DialogTitle>
              <DialogDescription>
                This cannot be undone from here. You would need an administrator to restore
                access.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-delete">
                Type {CONFIRM_WORD} to confirm
              </Label>
              <Input
                id="confirm-delete"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
              />
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button
                variant="destructive"
                disabled={confirmation !== CONFIRM_WORD || pending}
                onClick={handleDelete}
              >
                {pending ? "Closing..." : "Close account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
