import { z } from "zod";

/**
 * File naming pattern options
 */
export const FileNamingPatternSchema = z
  .enum(["kebab-case", "snake_case", "original"])
  .default("kebab-case");

/**
 * Extension configuration schema with defaults and validation
 */
export const ExtensionConfigSchema = z
  .object({
    // Core settings
    defaultPromptDirectory: z
      .string()
      .min(1, "Directory name cannot be empty")
      .regex(
        /^[a-zA-Z0-9._-]+$/,
        "Directory name can only contain letters, numbers, dots, underscores, and hyphens"
      )
      .refine((val) => !val.includes(".."), {
        message: "Directory name cannot contain path traversal (..)",
      })
      .refine((val) => !val.startsWith("/") && !val.includes(":"), {
        message: "Use relative directory names only",
      })
      .refine(
        (val) =>
          ![
            "con",
            "prn",
            "aux",
            "nul",
            "com1",
            "com2",
            "lpt1",
            "lpt2",
          ].includes(val.toLowerCase()),
        { message: "Directory name cannot be a reserved system name" }
      )
      .refine((val) => !/[<>:"|?*]/.test(val), {
        message: "Directory name contains invalid characters",
      })
      .default(".prompt_manager"),

    fileNamingPattern: FileNamingPatternSchema,

    showDescriptionInTree: z.boolean().default(true),

    // Search settings
    searchCaseSensitive: z.boolean().default(false),

    maxSearchResults: z
      .number()
      .int()
      .min(1, "Must allow at least 1 search result")
      .max(1000, "Maximum search results cannot exceed 1000")
      .default(100),

    // Performance settings
    enableCaching: z.boolean().default(true),

    cacheTimeout: z
      .number()
      .int()
      .min(0, "Cache timeout must be non-negative")
      .max(3600000, "Cache timeout cannot exceed 1 hour")
      .default(300000), // 5 minutes

    autoRefreshInterval: z
      .number()
      .int()
      .min(0, "Auto-refresh interval must be non-negative")
      .max(60000, "Auto-refresh interval cannot exceed 1 minute")
      .default(0), // Disabled by default

    // File scanning settings
    excludePatterns: z
      .array(z.string().min(1, "Exclude patterns cannot be empty"))
      .default([".git", "node_modules", ".vscode"]),
  })
  .strict() // Reject unknown keys
  .refine((config) => !config.enableCaching || config.cacheTimeout >= 0, {
    message: "Cache timeout should be set when caching is enabled",
    path: ["cacheTimeout"],
  })
  .refine(
    (config) =>
      config.autoRefreshInterval === 0 || config.autoRefreshInterval >= 1000,
    {
      message: "Auto-refresh interval should be at least 1000ms if enabled",
      path: ["autoRefreshInterval"],
    }
  );

/**
 * Type inference for the configuration
 */
export type ExtensionConfig = z.infer<typeof ExtensionConfigSchema>;

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: ExtensionConfig = ExtensionConfigSchema.parse({});
