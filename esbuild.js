const esbuild = require("esbuild");
const path = require("node:path");
const fs = require("node:fs");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

/* --- very small alias helper ----------------------------------------- */
const pathAliasPlugin = {
  name: "path-alias",
  setup(build) {
    const map = {
      "@infra/": "src/infrastructure/",
      "@ext/": "src/extension/",
      "@features/": "src/features/",
      "@root/": "src/",
      "@utils/": "src/utils/",
    };
    build.onResolve({ filter: /^[.@]/ }, (args) => {
      for (const [prefix, repl] of Object.entries(map)) {
        if (args.path.startsWith(prefix)) {
          let abs = path.join(
            process.cwd(),
            repl,
            args.path.slice(prefix.length)
          );
          // if path exists and is a directory, use its index file
          if (fs.existsSync(abs) && fs.lstatSync(abs).isDirectory()) {
            const idx = ["index.ts", "index.tsx", "index.js"].find((f) =>
              fs.existsSync(path.join(abs, f))
            );
            if (idx) {
              abs = path.join(abs, idx);
            }
          }
          // if still no extension, append common ones
          if (!path.extname(abs)) {
            const candidates = [".ts", ".tsx", ".mjs", ".cjs", ".js"];
            const found = candidates.find((ext) => fs.existsSync(abs + ext));
            if (found) {
              abs = abs + found;
            }
          }
          return { path: abs };
        }
      }
      return; // let esbuild handle
    });
  },
};
/* --------------------------------------------------------------------- */

const watchPlugin = {
  name: "build-watch-log",
  setup(build) {
    build.onStart(() => console.log("[watch] build started"));
    build.onEnd((r) =>
      console.log(
        "[watch] build finished",
        r.errors.length ? "with errors" : "✅"
      )
    );
  },
};

(async () => {
  const ctx = await esbuild.context({
    entryPoints: ["src/extension/extension.ts"],
    bundle: true,
    format: "cjs",
    platform: "node",
    minify: production,
    sourcemap: !production,
    outfile: "dist/extension.cjs",
    external: [
      "vscode",
      "fs",
      "path",
      "os",
      "util",
      "crypto",
      "stream",
      "events",
      "remark",
      "remark-parse",
      "remark-stringify",
      "remark-frontmatter",
      "remark-lint",
    ],
    plugins: [pathAliasPlugin, watchPlugin],
    logLevel: "silent",
    tsconfig: "tsconfig.json",
  });

  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
})();
