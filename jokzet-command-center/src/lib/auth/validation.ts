import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Email is too long")
  .pipe(z.email("Enter a valid email address"));

export const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters")
  .max(128, "Use at most 128 characters")
  .refine((value) => /[a-z]/i.test(value) && /\d/.test(value), "Include at least one letter and one number");

export const registerSchema = z.object({
  displayName: z.string().trim().min(1, "Enter your name").max(80, "Name is too long"),
  email: emailSchema,
  password: passwordSchema,
});

/** The sign-up form additionally requires the person to confirm they are 18 or older (a checkbox, so "on" when ticked). */
export const registerFormSchema = registerSchema.extend({
  adult: z.literal("on", { error: "Confirm that you are 18 or older to create an account" }),
});

// Login does not enforce password rules: it only needs a non-empty value.
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password").max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
