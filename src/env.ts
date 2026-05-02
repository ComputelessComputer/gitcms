import { z } from "zod";

const envSchema = z.object({
  GITCMS_APP_URL: z.string().url().default("http://localhost:3000"),
  GITCMS_CONFIG_PATH: z.string().optional(),
  GITCMS_STORAGE_BACKEND: z.enum(["supabase", "s3", "github", "local"]).default("supabase"),
  GITHUB_OAUTH_CLIENT_ID: z.string().optional(),
  GITHUB_OAUTH_CLIENT_SECRET: z.string().optional(),
  GITHUB_OAUTH_CALLBACK_URL: z.string().url().optional(),
  SESSION_SECRET: z.string().optional(),
  GITCMS_ADMIN_LOGINS: z.string().optional(),
  GITCMS_MEMBERS: z.string().optional(),
  GITCMS_AUTH_MODE: z.enum(["github", "jwt"]).default("github"),
  GITCMS_GITHUB_TOKEN_SOURCE: z.enum(["oauth", "service"]).default("oauth"),
  GITCMS_GITHUB_SERVICE_TOKEN: z.string().optional(),
  GITCMS_AUTH_JWT_ISSUER: z.string().url().optional(),
  GITCMS_AUTH_JWT_AUDIENCE: z.string().optional(),
  GITCMS_AUTH_JWT_JWKS_URL: z.string().url().optional(),
  GITCMS_AUTH_JWT_COOKIE_NAME: z.string().default("gitcms_jwt"),
  GITCMS_AUTH_JWT_CLAIM_SUBJECT: z.string().default("sub"),
  GITCMS_AUTH_JWT_CLAIM_EMAIL: z.string().default("email"),
  GITCMS_AUTH_JWT_CLAIM_LOGIN: z.string().default("preferred_username"),
  GITCMS_AUTH_JWT_CLAIM_NAME: z.string().default("name"),
  GITCMS_AUTH_JWT_CLAIM_AVATAR: z.string().default("picture"),
  GITCMS_CONTEXT_PUBLIC: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
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
  GITCMS_GITHUB_MEDIA_REPO: z.string().optional(),
  GITCMS_GITHUB_MEDIA_BRANCH: z.string().optional(),
  GITCMS_GITHUB_MEDIA_PATH: z.string().default("public/uploads"),
  GITCMS_GITHUB_MEDIA_TOKEN: z.string().optional(),
  GITCMS_GITHUB_MEDIA_PUBLIC: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  GITCMS_GITHUB_MEDIA_PUBLIC_URL_BASE: z.string().url().optional(),
  LOCAL_STORAGE_ROOT: z.string().default("./LOCAL_STORAGE_ROOT"),
  LOCAL_STORAGE_PUBLIC_URL: z.string().default("http://localhost:3000/media"),
});

export type RuntimeEnv = z.infer<typeof envSchema>;

/** Parses and validates all environment variables used by gitcms. */
export function getEnv(): RuntimeEnv {
  return envSchema.parse(process.env);
}
