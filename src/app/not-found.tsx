import Link from "next/link";
import { CompassIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <CompassIcon className="size-8 text-muted-foreground" />
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground">
        This page does not exist, or the profile you are looking for is not visible to you.
      </p>
      <Button asChild>
        <Link href="/">Back to the homepage</Link>
      </Button>
    </div>
  );
}
