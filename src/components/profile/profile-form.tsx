"use client";

import * as React from "react";
import Image from "next/image";
import { GlobeIcon, LockIcon, UsersIcon, XIcon } from "lucide-react";
import { updateProfileAction } from "@/app/actions/profile";
import { Field } from "@/components/forms/field";
import { GenderField } from "@/components/forms/gender-field";
import { useActionForm } from "@/components/forms/use-action-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { COUNTRY_OPTIONS } from "@/lib/countries";
import type { EditableProfile } from "@/lib/dal/profiles";
import { EDUCATION_GROUPS } from "@/lib/education-groups";
import { genderLabel } from "@/lib/gender";
import { EARLIEST_PASSING_YEAR, LATEST_PASSING_YEAR } from "@/lib/validation";
import { initialsOf } from "@/lib/utils";

type ProfileFormProps = {
  profile: EditableProfile;
  departments: Array<{ id: string; name: string }>;
  email: string;
};

const VISIBILITY_OPTIONS = [
  {
    value: "PUBLIC",
    icon: GlobeIcon,
    title: "Public",
    description: "Anyone with the link can see your profile, including signed-out visitors.",
  },
  {
    value: "MEMBERS_ONLY",
    icon: UsersIcon,
    title: "Verified alumni only",
    description: "Only members whose SSC details have been approved can see your profile.",
  },
  {
    value: "PRIVATE",
    icon: LockIcon,
    title: "Hidden",
    description: "You are removed from the directory. Only you and administrators can see it.",
  },
] as const;

/** Must match `MAX_AVATAR_BYTES` in `src/lib/storage.ts`. Kept here so the client never imports that module. */
const MAX_AVATAR_BYTES = 100 * 1024;
const AVATAR_TOO_LARGE = "Image must be 100 KB or smaller.";

export function ProfileForm({ profile, departments, email }: ProfileFormProps) {
  const avatarInputRef = React.useRef<HTMLInputElement>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [avatarError, setAvatarError] = React.useState<string | undefined>();
  const [avatarRemoved, setAvatarRemoved] = React.useState(false);
  const { formRef, formAction, pending, formError, fieldError, fieldErrorSummary } =
    useActionForm(updateProfileAction);
  const displayedAvatarError = avatarError ?? fieldError("avatar");
  const showingPhoto = Boolean(preview || (profile.avatarUrl && !avatarRemoved));

  function clearAvatarPreview() {
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-6"
      onSubmit={(event) => {
        const input = event.currentTarget.elements.namedItem("avatar");
        const file = input instanceof HTMLInputElement ? input.files?.[0] : undefined;
        if (file && file.size > MAX_AVATAR_BYTES) {
          event.preventDefault();
          setAvatarError(AVATAR_TOO_LARGE);
        }
      }}
    >
      {formError || fieldErrorSummary ? (
        <Alert variant="destructive">
          <AlertDescription>{formError ?? fieldErrorSummary}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basics</CardTitle>
          <CardDescription>How you appear in the directory.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="relative size-16 shrink-0">
              <span className="relative flex size-16 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-medium text-muted-foreground">
                {preview ? (
                  <Image src={preview} alt="" fill sizes="64px" className="object-cover" />
                ) : profile.avatarUrl && !avatarRemoved ? (
                  <Image
                    src={profile.avatarUrl}
                    alt=""
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                ) : (
                  initialsOf(profile.displayName)
                )}
              </span>
              {showingPhoto ? (
                <button
                  type="button"
                  aria-label="Remove photo"
                  className="absolute -right-1 -top-1 z-10 flex size-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => {
                    if (avatarInputRef.current) avatarInputRef.current.value = "";
                    clearAvatarPreview();
                    setAvatarError(undefined);
                    setAvatarRemoved(true);
                  }}
                >
                  <XIcon className="size-3" />
                </button>
              ) : null}
              {avatarRemoved ? <input type="hidden" name="removeAvatar" value="1" /> : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="avatar">Profile photo</Label>
              <Input
                ref={avatarInputRef}
                id="avatar"
                name="avatar"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="max-w-72"
                onChange={(event) => {
                  const input = event.currentTarget;
                  const file = input.files?.[0];
                  if (!file) {
                    clearAvatarPreview();
                    setAvatarError(undefined);
                    return;
                  }
                  if (file.size > MAX_AVATAR_BYTES) {
                    input.value = "";
                    clearAvatarPreview();
                    setAvatarError(AVATAR_TOO_LARGE);
                    return;
                  }
                  setAvatarRemoved(false);
                  setAvatarError(undefined);
                  setPreview((current) => {
                    if (current) URL.revokeObjectURL(current);
                    return URL.createObjectURL(file);
                  });
                }}
              />
              <p className="text-xs text-muted-foreground">Optional. JPG, PNG or WebP, up to 100 KB.</p>
              {displayedAvatarError ? (
                <p className="text-xs font-medium text-destructive">{displayedAvatarError}</p>
              ) : null}
            </div>
          </div>

          <Field name="displayName" label="Display name" error={fieldError("displayName")} required>
            <Input
              id="displayName"
              name="displayName"
              defaultValue={profile.displayName}
              required
            />
          </Field>

          {profile.gender ? (
            <div className="space-y-1.5">
              <Label>Gender</Label>
              <p className="text-sm">{genderLabel(profile.gender)}</p>
              <p className="text-xs text-muted-foreground">Set at signup and cannot be changed.</p>
            </div>
          ) : (
            <GenderField error={fieldError("gender")} />
          )}

          <Field
            name="headline"
            label="Headline"
            error={fieldError("headline")}
            hint="One line summary, e.g. Software engineer at bKash."
          >
            <Input
              id="headline"
              name="headline"
              defaultValue={profile.headline ?? ""}
              maxLength={120}
            />
          </Field>

          <Field name="bio" label="About" error={fieldError("bio")}>
            <Textarea
              id="bio"
              name="bio"
              rows={5}
              defaultValue={profile.bio ?? ""}
              maxLength={1000}
              placeholder="What you have been up to, and what you are happy to be contacted about."
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Education</CardTitle>
          <CardDescription>School, college, and university details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="text-sm font-medium">School</p>
              <p className="text-xs text-muted-foreground">Secondary school certificate.</p>
            </div>
            <Field
              name="graduationYear"
              label="SSC passing year"
              error={fieldError("graduationYear")}
            >
              <Input
                id="graduationYear"
                name="graduationYear"
                type="number"
                min={EARLIEST_PASSING_YEAR}
                max={LATEST_PASSING_YEAR}
                defaultValue={profile.graduationYear ?? ""}
              />
            </Field>

            <Field name="departmentId" label="Group / department" error={fieldError("departmentId")}>
              <select
                id="departmentId"
                name="departmentId"
                defaultValue={profile.departmentId ?? ""}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Not specified</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid gap-4 border-t border-border pt-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="text-sm font-medium">College</p>
              <p className="text-xs text-muted-foreground">Higher secondary / intermediate.</p>
            </div>
            <Field
              name="hscPassingYear"
              label="HSC passing year"
              error={fieldError("hscPassingYear")}
            >
              <Input
                id="hscPassingYear"
                name="hscPassingYear"
                type="number"
                min={EARLIEST_PASSING_YEAR}
                max={LATEST_PASSING_YEAR}
                defaultValue={profile.hscPassingYear ?? ""}
              />
            </Field>
            <Field
              name="collegeDepartment"
              label="Group / department"
              error={fieldError("collegeDepartment")}
            >
              <select
                id="collegeDepartment"
                name="collegeDepartment"
                defaultValue={profile.collegeDepartment ?? ""}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Not specified</option>
                {EDUCATION_GROUPS.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
            </Field>
            <Field name="collegeName" label="College name" error={fieldError("collegeName")}>
              <Input
                id="collegeName"
                name="collegeName"
                defaultValue={profile.collegeName ?? ""}
                maxLength={120}
              />
            </Field>
            <Field
              name="collegeSession"
              label="Session"
              error={fieldError("collegeSession")}
              hint="e.g. 2018-19"
            >
              <Input
                id="collegeSession"
                name="collegeSession"
                defaultValue={profile.collegeSession ?? ""}
                maxLength={40}
                placeholder="2018-19"
              />
            </Field>
          </div>

          <div className="grid gap-4 border-t border-border pt-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="text-sm font-medium">University</p>
              <p className="text-xs text-muted-foreground">Undergraduate or later studies.</p>
            </div>
            <Field name="universityName" label="University name" error={fieldError("universityName")}>
              <Input
                id="universityName"
                name="universityName"
                defaultValue={profile.universityName ?? ""}
                maxLength={120}
              />
            </Field>
            <Field
              name="universityDepartment"
              label="Department"
              error={fieldError("universityDepartment")}
            >
              <Input
                id="universityDepartment"
                name="universityDepartment"
                defaultValue={profile.universityDepartment ?? ""}
                maxLength={120}
              />
            </Field>
            <Field
              name="universitySession"
              label="Session"
              error={fieldError("universitySession")}
              hint="e.g. 2020-21"
            >
              <Input
                id="universitySession"
                name="universitySession"
                defaultValue={profile.universitySession ?? ""}
                maxLength={40}
                placeholder="2020-21"
              />
            </Field>
            <Field
              name="degree"
              label="Highest degree"
              error={fieldError("degree")}
              hint="e.g. BSc in Civil Engineering."
              className="sm:col-span-2"
            >
              <Input id="degree" name="degree" defaultValue={profile.degree ?? ""} maxLength={80} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact & social</CardTitle>
          <CardDescription>
            WhatsApp is required before you can use the directory. Facebook is optional.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            name="whatsappPhone"
            label="WhatsApp number"
            error={fieldError("whatsappPhone")}
            hint="Include country code, e.g. +8801XXXXXXXXX"
            required
            className="sm:col-span-2"
          >
            <Input
              id="whatsappPhone"
              name="whatsappPhone"
              type="tel"
              defaultValue={profile.whatsappPhone ?? ""}
              required
              placeholder="+8801XXXXXXXXX"
            />
          </Field>

          <Field
            name="facebookUrl"
            label="Facebook profile"
            error={fieldError("facebookUrl")}
            className="sm:col-span-2"
          >
            <Input
              id="facebookUrl"
              name="facebookUrl"
              type="url"
              defaultValue={profile.facebookUrl ?? ""}
              placeholder="https://www.facebook.com/..."
            />
          </Field>

          <Field name="linkedInUrl" label="LinkedIn" error={fieldError("linkedInUrl")}>
            <Input
              id="linkedInUrl"
              name="linkedInUrl"
              type="url"
              defaultValue={profile.linkedInUrl ?? ""}
              placeholder="https://www.linkedin.com/in/..."
            />
          </Field>

          <Field name="websiteUrl" label="Website" error={fieldError("websiteUrl")}>
            <Input
              id="websiteUrl"
              name="websiteUrl"
              type="url"
              defaultValue={profile.websiteUrl ?? ""}
              placeholder="https://..."
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Work and location</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field name="company" label="Employer" error={fieldError("company")}>
            <Input id="company" name="company" defaultValue={profile.company ?? ""} maxLength={120} />
          </Field>

          <Field name="position" label="Role" error={fieldError("position")}>
            <Input
              id="position"
              name="position"
              defaultValue={profile.position ?? ""}
              maxLength={120}
            />
          </Field>

          <Field name="city" label="City" error={fieldError("city")}>
            <Input id="city" name="city" defaultValue={profile.city ?? ""} maxLength={80} />
          </Field>

          <Field name="countryCode" label="Country" error={fieldError("countryCode")}>
            <select
              id="countryCode"
              name="countryCode"
              defaultValue={profile.countryCode ?? ""}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Not specified</option>
              {COUNTRY_OPTIONS.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Privacy</CardTitle>
          <CardDescription>
            Visibility controls who can open your profile. The switches control individual
            fields independently.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <RadioGroup name="visibility" defaultValue={profile.visibility} className="gap-3">
            {VISIBILITY_OPTIONS.map((option) => (
              <Label
                key={option.value}
                htmlFor={`visibility-${option.value}`}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-accent/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <RadioGroupItem
                  id={`visibility-${option.value}`}
                  value={option.value}
                  className="mt-0.5"
                />
                <span className="space-y-1">
                  <span className="flex items-center gap-2 font-medium">
                    <option.icon className="size-4" />
                    {option.title}
                  </span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    {option.description}
                  </span>
                </span>
              </Label>
            ))}
          </RadioGroup>

          <div className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="showEmail">Show my email address</Label>
                <p className="text-xs text-muted-foreground">
                  {email} — shown only to verified alumni, never to signed-out visitors.
                </p>
              </div>
              <Switch id="showEmail" name="showEmail" defaultChecked={profile.showEmail} />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="showEmployer">Show my employer and role</Label>
                <p className="text-xs text-muted-foreground">
                  Hide this if your current job should not be listed publicly.
                </p>
              </div>
              <Switch
                id="showEmployer"
                name="showEmployer"
                defaultChecked={profile.showEmployer}
              />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="showGender">Show my gender</Label>
                <p className="text-xs text-muted-foreground">
                  Off by default. When on, Male or Female appears on your profile and directory
                  card.
                </p>
              </div>
              <Switch id="showGender" name="showGender" defaultChecked={profile.showGender} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
