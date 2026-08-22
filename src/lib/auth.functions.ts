import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const signUpSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(6).max(128),
  fullName: z.string().max(120).optional().default(""),
  role: z.enum(["recruiter", "candidate"]),
});

/**
 * Creates an account with the email already confirmed, so no confirmation
 * email is sent and the project's auth email quota is never touched.
 * The client signs in with the same credentials right after.
 */
export const createAccount = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => signUpSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, role: data.role },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("already") && (msg.includes("registered") || msg.includes("exists"))) {
        throw new Error("already registered");
      }
      throw new Error(error.message);
    }

    return { ok: true as const };
  });
