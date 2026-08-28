"use strict";

/**
 * Webpack `resolve.extensionAlias` equivalent for Turbopack.
 * Orval (and other TypeScript ESM) emit `.js` specifiers that point at `.ts` files.
 * Next.js 16.3 Turbopack does not remap those; this loader strips the suffix so
 * default `resolveExtensions` can pick up `.ts` / `.tsx`.
 */
module.exports = function turbopackExtensionAliasLoader(source) {
  return source.replace(
    /((?:from|import)\s*\(?\s*)(['"])([^'"]+)\.js\2/g,
    "$1$2$3$2",
  );
};
