import { z } from "zod";

const envSchema = z.object({
  GITCMS_APP_URL: z.string().url().default("http://localhost:3000"),
  GITCMS_CONFIG_PATH: z.string().optional(),
  GITCMS_STORAGE_BACKEND: z.enum(["supabase", "s3", "local"]).default("supabase"),
  GITHUB_OAUTH_CLIENT_ID: z.string().optional(),
  GITHUB_OAUTH_CLIENT_SECRET: z.string().optional(),
  GITHUB_OAUTH_CALLBACK_URL: z.string().url().optional(),
  SESSION_SECRET: z.string().optional(),
  GITCMS_ADMIN_LOGINS: z.string().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_MEDIA_BUCKET: z.string().default("gitcms-media"),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_URL_BASE: z.string().optional(),
  S3_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  LOCAL_STORAGE_ROOT: z.string().default("./LOCAL_STORAGE_ROOT"),
  LOCAL_STORAGE_PUBLIC_URL: z
    .string()
    .default("http://localhost:3000/media"),
});

export type RuntimeEnv = z.infer<typeof envSchema>;

/** Parses and validates all environment variables used by gitcms. */
export function getEnv(): RuntimeEnv {
  return envSchema.parse(process.env);
}

/** Parses the comma-separated GitHub admin allowlist from env. */
export function getAdminLogins(env = getEnv()): Set<string> {
  return new Set(
    (env.GITCMS_ADMIN_LOGINS ?? "")
      .split(",")
      .map((login) => login.trim().toLowerCase())
      .filter(Boolean),
  );
}
