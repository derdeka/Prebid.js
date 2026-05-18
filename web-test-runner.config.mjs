import { playwrightLauncher } from '@web/test-runner-playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = __dirname;

// Bare specifiers used by precompiled tests that map into dist/src/
const BARE_PREFIXES = ['src/', 'test/', 'modules/', 'libraries/', 'metadata/', 'plugins/'];

/**
 * Rewrites bare path specifiers (e.g. `src/config.js`) to root-relative URLs.
 */
const prebidResolvePlugin = {
  name: 'prebid-resolve',
  resolveImport({ source }) {
    if (BARE_PREFIXES.some(p => source.startsWith(p))) {
      return `/${source}`;
    }
  },
};

// Matches /__wds-outside-root__/<n>/<rest> paths (node_modules outside rootDir)
const OUTSIDE_ROOT_RE = /^\/__wds-outside-root__\/(\d+)\/(.*)$/;

// Cache of CJS module exports keys (computed once via require() in Node.js)
const cjsExportKeys = new Map();

function getExportKeys(filePath) {
  if (cjsExportKeys.has(filePath)) return cjsExportKeys.get(filePath);
  try {
    const mod = require(filePath);
    const keys = typeof mod === 'object' && mod !== null
      ? Object.keys(mod).filter(k => /^[a-zA-Z_$]/.test(k))
      : [];
    cjsExportKeys.set(filePath, keys);
    return keys;
  } catch {
    cjsExportKeys.set(filePath, []);
    return [];
  }
}

function cjsToEsm(src, filePath) {
  const keys = getExportKeys(filePath);
  const namedExports = keys.map(k => `export const ${k} = __default__?.${k};`).join('\n');

  return `const __cjs_module__ = { exports: {} };
(function(module, exports) {
${src}
})(__cjs_module__, __cjs_module__.exports);
const __default__ = __cjs_module__.exports;
export default __default__;
${namedExports}
`;
}

/**
 * Koa middleware that intercepts /__wds-outside-root__/ paths for CJS/UMD modules
 * and serves them as ESM so the browser can import them.
 */
function cjsOutsideRootMiddleware() {
  return async (ctx, next) => {
    const match = ctx.path.match(OUTSIDE_ROOT_RE);
    if (!match) return next();

    const ups = parseInt(match[1], 10);
    const rest = match[2];
    let base = path.join(projectRoot, 'dist', 'src');
    for (let i = 0; i < ups; i++) base = path.dirname(base);
    const filePath = path.join(base, rest);

    let src;
    try {
      src = fs.readFileSync(filePath, 'utf8');
    } catch {
      return next();
    }

    // Skip if already ESM
    if (/^(import |export (default |const |function |class |\{))/m.test(src)) return next();

    // Only handle CJS/UMD
    if (!/\bmodule\.exports\b|\bexports\.[a-zA-Z_$]/.test(src)) return next();

    ctx.type = 'text/javascript';
    ctx.body = cjsToEsm(src, filePath);
  };
}

export default {
  rootDir: path.join(__dirname, 'dist/src'),
  files: 'dist/src/test/spec/**/*_spec.js',
  nodeResolve: true,

  browsers: [
    playwrightLauncher({ product: 'chromium', launchOptions: { headless: true, args: ['--no-sandbox'] } }),
  ],

  testFramework: {
    config: {
      timeout: 3000,
    },
  },

  middleware: [cjsOutsideRootMiddleware()],

  plugins: [prebidResolvePlugin],

  // Timeouts matching current Karma settings
  browserStartTimeout: 20000,
  testsStartTimeout: 30000,
  testsFinishTimeout: 120000,

  // testFramework (Mocha) must load first so it/describe globals exist for pipeline_setup.js
  testRunnerHtml: (testFramework) => `
    <html>
      <body>
        <script type="module" src="${testFramework}"></script>
        <script type="module" src="/test/pipeline_setup.js"></script>
        <script type="module" src="/test/test_deps_wtr.js"></script>
        <script type="module" src="/test/helpers/hookSetup.js"></script>
      </body>
    </html>
  `,
};
