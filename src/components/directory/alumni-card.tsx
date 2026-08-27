import Image from "next/image";
import Link from "next/link";
import { BriefcaseIcon, GraduationCapIcon, MapPinIcon } from "lucide-react";
import { HoverLift } from "@/components/motion/hover-lift";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn, initialsOf } from "@/lib/utils";
import { countryName } from "@/lib/countries";
import { genderLabel } from "@/lib/gender";
import type { DirectoryEntry } from "@/lib/dal/profiles";

export function AlumniCard({
  entry,
  view,
}: {
  entry: DirectoryEntry;
  view: "grid" | "list";
}) {
  const location = [entry.city, entry.countryCode ? countryName(entry.countryCode) : null]
    .filter(Boolean)
    .join(", ");
  const role = [entry.position, entry.company].filter(Boolean).join(" at ");

  return (
    <HoverLift>
      <Card className="h-full transition-shadow motion-safe:hover:shadow-md">
        <CardContent
          className={cn(
            "pt-6",
            view === "list" && "flex items-center gap-4 py-4 sm:gap-6",
          )}
        >
          <Link
            href={`/profile/${entry.slug}`}
            className={cn(
              "block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              view === "list" ? "flex flex-1 items-center gap-4" : "space-y-3",
            )}
          >
            <span
              className={cn(
                "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-medium text-muted-foreground",
                view === "list" ? "size-11" : "size-14",
              )}
            >
              {entry.avatarUrl ? (
                <Image
                  src={entry.avatarUrl}
                  alt=""
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              ) : (
                initialsOf(entry.displayName)
              )}
            </span>

            <span className="block min-w-0 flex-1">
              <span className="block truncate font-medium">{entry.displayName}</span>
              {entry.headline ? (
                <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                  {entry.headline}
                </span>
              ) : null}

              {view === "grid" ? (
                <span className="mt-3 block space-y-1.5 text-sm text-muted-foreground">
                  {role ? (
                    <span className="flex items-center gap-1.5">
                      <BriefcaseIcon className="size-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{role}</span>
                    </span>
                  ) : null}
                  {location ? (
                    <span className="flex items-center gap-1.5">
                      <MapPinIcon className="size-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{location}</span>
                    </span>
                  ) : null}
                </span>
              ) : null}
            </span>

            {view === "list" ? (
              <span className="hidden min-w-0 flex-1 truncate text-sm text-muted-foreground sm:block">
                {role || location || "—"}
              </span>
            ) : null}
          </Link>

          <div
            className={cn(
              "flex flex-wrap items-center gap-1.5",
              view === "grid" && "mt-4",
            )}
          >
            {entry.graduationYear ? (
              <Badge variant="secondary">
                <GraduationCapIcon aria-hidden />
                {entry.graduationYear}
              </Badge>
            ) : null}
            {entry.departmentName ? (
              <Badge variant="outline">{entry.departmentName}</Badge>
            ) : null}
            {entry.gender ? (
              <Badge variant="outline">{genderLabel(entry.gender)}</Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </HoverLift>
  );
}
