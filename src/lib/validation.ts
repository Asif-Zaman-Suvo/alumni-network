import { z } from "zod";
import { EDUCATION_GROUPS } from "@/lib/education-groups";

export const EARLIEST_PASSING_YEAR = 1950;
export const LATEST_PASSING_YEAR = new Date().getFullYear();

const email = z
  .string()
  .trim()
  .min(1, "Email is required")
  .max(254)
  .email("Enter a valid email address")
  // Stored lowercase so a case-sensitive unique index cannot admit duplicate accounts.
  .transform((value) => value.toLowerCase());

const password = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128, "Use at most 128 characters")
  .refine((value) => /[a-zA-Z]/.test(value) && /[0-9]/.test(value), {
    message: "Include at least one letter and one number",
  });

const fullName = z
  .string()
  .trim()
  .min(2, "Enter your full name")
  .max(80, "Name is too long");

/**
 * SSC identifiers are numeric strings of varying length across boards and years, so the
 * rules stay deliberately loose: digits only, plausible length. The admin is the real check.
 */
const sscRoll = z
  .string()
  .trim()
  .regex(/^\d{4,12}$/, "Roll number should be 4 to 12 digits");

const sscRegistration = z
  .string()
  .trim()
  .regex(/^\d{6,16}$/, "Registration number should be 6 to 16 digits");

const passingYear = z.coerce
  .number()
  .int("Enter a four digit year")
  .min(EARLIEST_PASSING_YEAR, `Year must be ${EARLIEST_PASSING_YEAR} or later`)
  .max(LATEST_PASSING_YEAR, `Year cannot be after ${LATEST_PASSING_YEAR}`);

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z.object({
  fullName,
  email,
  password,
  sscRoll,
  sscRegistration,
  passingYear,
});

/** Google OAuth users skip the register form, so they submit SSC details on their own. */
export const sscSubmissionSchema = z.object({
  fullNameOnCert: fullName,
  sscRoll,
  sscRegistration,
  passingYear,
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password,
    confirmPassword: z.string().min(1),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

const optionalUrl = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional()
  .refine(
    (value) => {
      if (!value) return true;
      try {
        const parsed = new URL(value);
        return parsed.protocol === "https:" || parsed.protocol === "http:";
      } catch {
        return false;
      }
    },
    { message: "Enter a full URL starting with https://" },
  );

const requiredUrl = z
  .string()
  .trim()
  .min(1, "This link is required")
  .refine(
    (value) => {
      try {
        const parsed = new URL(value);
        return parsed.protocol === "https:" || parsed.protocol === "http:";
      } catch {
        return false;
      }
    },
    { message: "Enter a full URL starting with https://" },
  );

/** BD / international WhatsApp numbers: optional +, digits, spaces, dashes. */
const whatsappPhone = z
  .string()
  .trim()
  .min(8, "Enter a valid WhatsApp number")
  .max(20, "Phone number is too long")
  .regex(/^\+?[\d\s\-()]{8,20}$/, "Use digits, spaces, or +country code");

export const profileSchema = z.object({
  displayName: fullName,
  headline: optionalText(120),
  bio: optionalText(1000),
  graduationYear: z
    .union([passingYear, z.literal("").transform(() => null), z.null()])
    .optional(),
  hscPassingYear: z
    .union([passingYear, z.literal("").transform(() => null), z.null()])
    .optional(),
  degree: optionalText(80),
  departmentId: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional(),
  company: optionalText(120),
  position: optionalText(120),
  whatsappPhone,
  facebookUrl: requiredUrl,
  linkedInUrl: optionalUrl,
  websiteUrl: optionalUrl,
  city: optionalText(80),
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Use a two letter country code")
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  collegeName: optionalText(120),
  collegeDepartment: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional()
    .refine(
      (value) => value == null || (EDUCATION_GROUPS as readonly string[]).includes(value),
      { message: "Choose Science, Business Studies, or Humanities" },
    ),
  collegeSession: optionalText(40),
  universityName: optionalText(120),
  universityDepartment: optionalText(120),
  universitySession: optionalText(40),
  visibility: z.enum(["PUBLIC", "MEMBERS_ONLY", "PRIVATE"]),
  showEmail: z.coerce.boolean(),
  showEmployer: z.coerce.boolean(),
});

export const reviewDecisionSchema = z
  .object({
    requestId: z.string().min(1),
    decision: z.enum(["APPROVE", "REJECT"]),
    reviewNote: z.string().trim().max(500).optional(),
  })
  .refine(
    (value) => value.decision === "APPROVE" || (value.reviewNote?.length ?? 0) >= 10,
    {
      message: "Explain the rejection in at least 10 characters — the user sees this note",
      path: ["reviewNote"],
    },
  );

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type SscSubmissionInput = z.infer<typeof sscSubmissionSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
