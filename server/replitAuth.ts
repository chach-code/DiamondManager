// Deprecated compatibility layer: re-export Google-based auth implementation.
// The original Replit-specific auth implementation has been replaced with
// `googleAuth`. Keep this file for backward compatibility with imports that
// referenced `./replitAuth`.
export { setupAuth, isAuthenticated, getSession } from "./googleAuth";
