import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { build } from "vite";

function bundleReportPlugin() {
  return {
    name: "bundle-report",
    generateBundle(_options, bundle) {
      const outputs = Object.entries(bundle).map(([fileName, output]) => {
        if (output.type === "asset") {
          const bytes = typeof output.source === "string"
            ? Buffer.byteLength(output.source)
            : output.source.byteLength;
          return { fileName, type: output.type, bytes };
        }

        const modules = Object.entries(output.modules)
          .map(([id, details]) => ({
            id: path.relative(process.cwd(), id).replaceAll("\\", "/"),
            originalBytes: details.originalLength,
            renderedBytes: details.renderedLength,
          }))
          .sort((a, b) => b.renderedBytes - a.renderedBytes);

        return {
          fileName,
          type: output.type,
          bytes: Buffer.byteLength(output.code),
          imports: output.imports,
          dynamicImports: output.dynamicImports,
          modules,
        };
      });

      this.emitFile({
        type: "asset",
        fileName: "bundle-report.json",
        source: JSON.stringify({ generatedAt: new Date().toISOString(), outputs }, null, 2),
      });
    },
  };
}

function chunkFileName(chunkInfo) {
  const containsThreeRuntime = chunkInfo.moduleIds.some((id) => {
    const normalizedId = id.replaceAll("\\", "/");
    return normalizedId.includes("/node_modules/three/build/")
      || normalizedId.includes("/node_modules/@react-three/fiber/");
  });

  return containsThreeRuntime ? "assets/three-runtime-[hash].js" : "assets/[name]-[hash].js";
}

await build({
  configFile: false,
  mode: "production",
  plugins: [react(), tailwindcss(), bundleReportPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "."),
    },
  },
  build: {
    rollupOptions: {
      output: {
        chunkFileNames: chunkFileName,
      },
    },
  },
});
