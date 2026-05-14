// Ambient declarations for non-TS asset imports.
// Diperlukan agar TypeScript (strict mode) menerima side-effect import
// seperti `import "./globals.css"` di app/layout.tsx.

declare module "*.css";
declare module "*.scss";
declare module "*.sass";
