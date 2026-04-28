const jsdoc = require('eslint-plugin-jsdoc')
const lintImports = require('eslint-plugin-import')
const stylistic = require('@stylistic/eslint-plugin')
const eslintPluginN = require('eslint-plugin-n')
const eslintPluginPromise = require('eslint-plugin-promise')
const globals = require('globals');
const prebid = require('./plugins/eslint/index.js');
const chaiFriendly = require('eslint-plugin-chai-friendly');
const {includeIgnoreFile} = require('@eslint/compat');
const path = require('path');
const _ = require('lodash');
const tseslint = require('typescript-eslint');
const {getSourceFolders} = require('./gulpHelpers.js');
const APPROVED_LOAD_EXTERNAL_SCRIPT_PATHS = require('./plugins/eslint/approvedLoadExternalScriptPaths.js');

function jsPattern(name) {
  return [`${name}/**/*.js`, `${name}/**/*.mjs`]
}

function tsPattern(name) {
  return [`${name}/**/*.ts`]
}

function sourcePattern(name) {
  return jsPattern(name).concat(tsPattern(name));
}

const allowedImports = {
  modules: [
    'crypto-js',
    'live-connect' // Maintained by LiveIntent : https://github.com/liveintent-berlin/live-connect/
  ],
  src: [
    'fun-hooks/no-eval',
    'klona',
    'dlv',
    'dset'
  ],
  // [false] means disallow ANY import outside of modules/debugging
  // this is because debugging also gets built as a standalone module,
  // and importing global state does not work as expected.
  // in theory imports that do not involve global state are fine, but
  // even innocuous imports can become problematic if the source changes,
  // and it's too easy to forget this is a problem for debugging-standalone.
  'modules/debugging': [false],
  libraries: [],
  creative: [],
}

function noGlobals(names) {
  return {
    globals: Object.entries(names).map(([name, message]) => ({
      name,
      message
    })),
    props: Object.entries(names).map(([name, message]) => ({
      object: 'window',
      property: name,
      message
    }))
  }
}

// TypeScript rules that are redundant with the type checker
const tsRedundantRules = {
  'getter-return': 'off',
  'constructor-super': 'off',
  'no-const-assign': 'off',
  'no-dupe-args': 'off',
  'no-dupe-class-members': 'off',
  'no-dupe-keys': 'off',
  'no-func-assign': 'off',
  'no-import-assign': 'off',
  'no-new-native-nonconstructor': 'off',
  'no-obj-calls': 'off',
  'no-redeclare': 'off',
  'no-setter-return': 'off',
  'no-this-before-super': 'off',
  'no-undef': 'off',
  'no-unreachable': 'off',
  'no-unsafe-negation': 'off',
}

module.exports = [
  includeIgnoreFile(path.resolve(__dirname, '.gitignore')),
  {
    ignores: [
      'integrationExamples/**/*',
      // do not lint build-related stuff
      '*.js',
      '*.mjs',
      'metadata/**/*',
      'customize/**/*',
      ...jsPattern('plugins'),
      ...jsPattern('.github'),
    ],
  },
  jsdoc.configs['flat/recommended'],
  ...tseslint.configs.recommended,
  // Base rules (replaces neostandard base + modernization + style)
  {
    files: getSourceFolders().flatMap(sourcePattern),
    plugins: {
      jsdoc,
      import: lintImports,
      prebid,
      '@stylistic': stylistic,
      n: eslintPluginN,
      promise: eslintPluginPromise,
    },
    settings: {
      jsdoc: {
        tagNamePreference: {
          return: 'return'
        }
      }
    },
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 2018,
      globals: {
        BROWSERSTACK_USERNAME: false,
        BROWSERSTACK_KEY: false,
        FEATURES: 'readonly',
        ...globals.browser
      },
    },
    rules: {
      // === ESLint core rules (from neostandard base) ===
      'no-var': 'warn',
      'object-shorthand': ['warn', 'properties'],
      'accessor-pairs': ['error', { setWithoutGet: true, enforceForClassMembers: true }],
      'array-callback-return': ['error', { allowImplicit: false, checkForEach: false }],
      camelcase: ['error', { allow: ['^UNSAFE_'], properties: 'never', ignoreGlobals: true }],
      'constructor-super': 'error',
      curly: ['error', 'multi-line'],
      'default-case-last': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'new-cap': ['error', { newIsCap: true, capIsNew: false, properties: true }],
      'no-array-constructor': 'error',
      'no-async-promise-executor': 'error',
      'no-caller': 'error',
      'no-case-declarations': 'error',
      'no-class-assign': 'error',
      'no-compare-neg-zero': 'error',
      'no-cond-assign': 'error',
      'no-const-assign': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-control-regex': 'error',
      'no-debugger': 'error',
      'no-delete-var': 'error',
      'no-dupe-args': 'error',
      'no-dupe-class-members': 'error',
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-useless-backreference': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-empty-character-class': 'error',
      'no-empty-pattern': 'error',
      'no-eval': 'error',
      'no-ex-assign': 'error',
      'no-extend-native': 'error',
      'no-extra-bind': 'error',
      'no-extra-boolean-cast': 'error',
      'no-fallthrough': 'error',
      'no-func-assign': 'error',
      'no-global-assign': 'error',
      'no-implied-eval': 'error',
      'no-import-assign': 'error',
      'no-invalid-regexp': 'error',
      'no-irregular-whitespace': 'error',
      'no-iterator': 'error',
      'no-labels': ['error', { allowLoop: false, allowSwitch: false }],
      'no-lone-blocks': 'error',
      'no-loss-of-precision': 'error',
      'no-misleading-character-class': 'error',
      'no-prototype-builtins': 'error',
      'no-useless-catch': 'error',
      'no-multi-str': 'error',
      'no-new': 'error',
      'no-new-func': 'error',
      'no-object-constructor': 'error',
      'no-new-native-nonconstructor': 'error',
      'no-new-wrappers': 'error',
      'no-obj-calls': 'error',
      'no-octal': 'error',
      'no-octal-escape': 'error',
      'no-proto': 'error',
      'no-redeclare': ['error', { builtinGlobals: false }],
      'no-regex-spaces': 'error',
      'no-return-assign': ['error', 'except-parens'],
      'no-self-assign': ['error', { props: true }],
      'no-self-compare': 'error',
      'no-sequences': 'error',
      'no-shadow-restricted-names': 'error',
      'no-sparse-arrays': 'error',
      'no-template-curly-in-string': 'error',
      'no-this-before-super': 'error',
      'no-throw-literal': 'error',
      'no-undef': 2,
      'no-undef-init': 'error',
      'no-unexpected-multiline': 'error',
      'no-unmodified-loop-condition': 'error',
      'no-unneeded-ternary': ['error', { defaultAssignment: false }],
      'no-unreachable': 'error',
      'no-unreachable-loop': 'error',
      'no-unsafe-finally': 'error',
      'no-unsafe-negation': 'error',
      'no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true, allowTaggedTemplates: true }],
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true, vars: 'all' }],
      'no-use-before-define': ['error', { functions: false, classes: false, variables: false }],
      'no-useless-call': 'error',
      'no-useless-computed-key': 'error',
      'no-useless-constructor': 'error',
      'no-useless-escape': 'error',
      'no-useless-rename': 'error',
      'no-useless-return': 'error',
      'no-void': 'error',
      'no-with': 'error',
      'one-var': ['error', { initialized: 'never' }],
      'prefer-const': ['error', { destructuring: 'all' }],
      'prefer-promise-reject-errors': 'error',
      'prefer-regex-literals': ['error', { disallowRedundantWrapping: true }],
      'symbol-description': 'error',
      'unicode-bom': ['error', 'never'],
      'use-isnan': ['error', { enforceForSwitchCase: true, enforceForIndexOf: true }],
      'valid-typeof': ['error', { requireStringLiterals: true }],
      yoda: ['error', 'never'],
      'no-console': 'error',

      // === import plugin rules ===
      'import/export': 'error',
      'import/first': 'error',
      'import/no-absolute-path': ['error', { esmodule: true, commonjs: true, amd: false }],
      'import/no-duplicates': 'error',
      'import/no-named-default': 'error',
      'import/no-webpack-loader-syntax': 'error',
      'import/extensions': ['error', 'ignorePackages'],

      // === node plugin rules ===
      'n/handle-callback-err': ['error', '^(err|error)$'],
      'n/no-callback-literal': 'error',
      'n/no-deprecated-api': 'warn',
      'n/no-exports-assign': 'error',
      'n/no-new-require': 'error',
      'n/no-path-concat': 'error',
      'n/process-exit-as-throw': 'error',

      // === promise plugin rules ===
      'promise/param-names': 'error',

      // === @stylistic rules ===
      '@stylistic/array-bracket-spacing': ['error', 'never'],
      '@stylistic/arrow-spacing': ['error', { before: true, after: true }],
      '@stylistic/block-spacing': ['error', 'always'],
      '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }],
      '@stylistic/comma-dangle': 'off',
      '@stylistic/comma-spacing': ['error', { before: false, after: true }],
      '@stylistic/comma-style': ['error', 'last'],
      '@stylistic/computed-property-spacing': ['error', 'never', { enforceForClassMembers: true }],
      '@stylistic/dot-location': ['error', 'property'],
      '@stylistic/eol-last': 'error',
      '@stylistic/func-call-spacing': ['error', 'never'],
      '@stylistic/generator-star-spacing': ['error', { before: true, after: true }],
      '@stylistic/indent': ['error', 2, {
        SwitchCase: 1,
        VariableDeclarator: 1,
        outerIIFEBody: 1,
        MemberExpression: 1,
        FunctionDeclaration: { parameters: 1, body: 1 },
        FunctionExpression: { parameters: 1, body: 1 },
        CallExpression: { arguments: 1 },
        ArrayExpression: 1,
        ObjectExpression: 1,
        ImportDeclaration: 1,
        flatTernaryExpressions: false,
        ignoreComments: false,
        ignoredNodes: ['TemplateLiteral *', 'JSXElement', 'JSXElement > *', 'JSXAttribute', 'JSXIdentifier', 'JSXNamespacedName', 'JSXMemberExpression', 'JSXSpreadAttribute', 'JSXExpressionContainer', 'JSXOpeningElement', 'JSXClosingElement', 'JSXFragment', 'JSXOpeningFragment', 'JSXClosingFragment', 'JSXText', 'JSXEmptyExpression', 'JSXSpreadChild'],
        offsetTernaryExpressions: true,
      }],
      '@stylistic/key-spacing': ['error', { beforeColon: false, afterColon: true }],
      '@stylistic/keyword-spacing': ['error', { before: true, after: true }],
      '@stylistic/lines-between-class-members': ['error', 'always', { exceptAfterSingleLine: true }],
      '@stylistic/multiline-ternary': 'off',
      '@stylistic/new-parens': 'error',
      '@stylistic/no-extra-parens': ['error', 'functions'],
      '@stylistic/no-floating-decimal': 'error',
      '@stylistic/no-mixed-operators': ['error', {
        groups: [['==', '!=', '===', '!==', '>', '>=', '<', '<='], ['&&', '||'], ['in', 'instanceof']],
        allowSamePrecedence: true,
      }],
      '@stylistic/no-mixed-spaces-and-tabs': 'error',
      '@stylistic/no-multi-spaces': ['error', { ignoreEOLComments: true }],
      '@stylistic/no-multiple-empty-lines': ['error', { max: 1, maxBOF: 0, maxEOF: 0 }],
      '@stylistic/no-tabs': 'error',
      '@stylistic/no-trailing-spaces': 'error',
      '@stylistic/no-whitespace-before-property': 'error',
      '@stylistic/object-curly-newline': ['error', { multiline: true, consistent: true }],
      '@stylistic/object-curly-spacing': ['error', 'always'],
      '@stylistic/object-property-newline': ['error', { allowMultiplePropertiesPerLine: true }],
      '@stylistic/operator-linebreak': ['error', 'after', { overrides: { '?': 'before', ':': 'before', '|>': 'before' } }],
      '@stylistic/padded-blocks': ['error', { blocks: 'never', switches: 'never', classes: 'never' }],
      '@stylistic/quote-props': 'off',
      '@stylistic/quotes': 'off',
      '@stylistic/rest-spread-spacing': ['error', 'never'],
      '@stylistic/semi': 'off',
      '@stylistic/semi-spacing': ['error', { before: false, after: true }],
      '@stylistic/space-before-blocks': ['error', 'always'],
      '@stylistic/space-before-function-paren': 'off',
      '@stylistic/space-in-parens': ['error', 'never'],
      '@stylistic/space-infix-ops': 'error',
      '@stylistic/space-unary-ops': ['error', { words: true, nonwords: false }],
      '@stylistic/spaced-comment': ['error', 'always', {
        line: { markers: ['*package', '!', '/', ',', '='] },
        block: { balanced: true, markers: ['*package', '!', ',', ':', '::', 'flow-include'], exceptions: ['*'] },
      }],
      '@stylistic/template-curly-spacing': ['error', 'never'],
      '@stylistic/template-tag-spacing': ['error', 'never'],
      '@stylistic/wrap-iife': ['error', 'any', { functionPrototypeMethods: true }],
      '@stylistic/yield-star-spacing': ['error', 'both'],

      // === Disabled rules from neostandard modernization ===
      'dot-notation': 'off',

      // === Prebid-specific restrictions ===
      'no-restricted-syntax': [
        'error',
        {
          selector: "FunctionDeclaration[id.name=/^log(Message|Info|Warn|Error|Result)$/]",
          message: "Defining a function named 'logResult, 'logMessage', 'logInfo', 'logWarn', or 'logError' is not allowed."
        },
        {
          selector: "VariableDeclarator[id.name=/^log(Message|Info|Warn|Error|Result)$/][init.type=/FunctionExpression|ArrowFunctionExpression/]",
          message: "Assigning a function to 'logResult, 'logMessage', 'logInfo', 'logWarn', or 'logError' is not allowed."
        },
      ],
      'no-restricted-imports': [
        'error', {
          patterns: [
            '**/src/adloader.js'
          ]
        }
      ],

      // === Disabled rules (project overrides) ===
      'comma-dangle': 'off',
      semi: 'off',
      'space-before-function-paren': 'off',
      'jsdoc/check-types': 'off',
      'jsdoc/no-defaults': 'off',
      'jsdoc/newline-after-description': 'off',
      'jsdoc/require-jsdoc': 'off',
      'jsdoc/require-param': 'off',
      'jsdoc/require-param-description': 'off',
      'jsdoc/require-param-name': 'off',
      'jsdoc/require-param-type': 'off',
      'jsdoc/require-property': 'off',
      'jsdoc/require-property-description': 'off',
      'jsdoc/require-property-name': 'off',
      'jsdoc/require-property-type': 'off',
      'jsdoc/require-returns': 'off',
      'jsdoc/require-returns-check': 'off',
      'jsdoc/require-returns-description': 'off',
      'jsdoc/require-returns-type': 'off',
      'jsdoc/require-yields': 'off',
      'jsdoc/require-yields-check': 'off',
      'jsdoc/tag-lines': 'off',
      'no-var': 'off',
      'no-void': 'off',
      'prefer-const': 'off',
      'no-prototype-builtins': 'off',
      'object-shorthand': 'off',
      'prefer-regex-literals': 'off',
      'no-case-declarations': 'off',
    }
  },
  ...Object.entries(allowedImports).map(([path, allowed]) => {
    const {globals, props} = noGlobals({
      require: 'use import instead',
      ...Object.fromEntries(['localStorage', 'sessionStorage'].map(k => [k, 'use storageManager instead'])),
      XMLHttpRequest: 'use ajax.js instead'
    })
    return {
      files: sourcePattern(path),
      plugins: {
        prebid,
      },
      rules: {
        'prebid/validate-imports': ['error', allowed],
        'no-restricted-globals': [
          'error',
          ...globals
        ],
        'no-restricted-properties': [
          'error',
          ...props,
          {
            property: 'cookie',
            object: 'document',
            message: 'use storageManager instead'
          },
          {
            property: 'sendBeacon',
            object: 'navigator',
            message: 'use ajax.js instead'
          },
          {
            property: 'doNotTrack',
            object: 'navigator',
            message: 'DNT was deprecated by W3C; Prebid no longer supports DNT signals'
          },
          {
            property: 'msDoNotTrack',
            object: 'navigator',
            message: 'DNT was deprecated by W3C; Prebid no longer supports DNT signals'
          },
          {
            property: 'doNotTrack',
            object: 'window',
            message: 'DNT was deprecated by W3C; Prebid no longer supports DNT signals'
          },
          ...['outerText', 'innerText'].map(property => ({
            property,
            message: 'use .textContent instead'
          })),
          {
            property: 'getBoundingClientRect',
            message: 'use libraries/boundingClientRect instead'
          },
          ...['scrollTop', 'scrollLeft', 'innerHeight', 'innerWidth', 'visualViewport'].map((property) => ({
            object: 'window',
            property,
            message: 'use utils/getWinDimensions instead'
          }))
        ]
      }
    }
  }),
  {
    files: ['**/*BidAdapter.js'],
    rules: {
      'no-restricted-imports': [
        'error', {
          patterns: [
            '**/src/events.js',
            '**/src/adloader.js'
          ]
        }
      ]
    }
  },
  {
    files: sourcePattern('test'),
    plugins: {
      'chai-friendly': chaiFriendly
    },
    languageOptions: {
      globals: {
        ...globals.mocha,
        ...globals.chai,
        'sinon': false
      }
    },
    rules: {
      'no-template-curly-in-string': 'off',
      'no-unused-expressions': 'off',
      'chai-friendly/no-unused-expressions': 'error',
      // tests were not subject to many rules and they are now a nightmare. rules below this line should be removed over time
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-useless-escape': 'off',
      'no-return-assign': 'off',
      'camelcase': 'off'
    }
  },
  {
    files: getSourceFolders().flatMap(tsPattern),
    rules: {
      ...tsRedundantRules,
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },
  {
    files: getSourceFolders().flatMap(jsPattern),
    rules: {
      // turn off typescript rules on js files - just too many violations
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-this-alias': 'off',
      '@typescript-eslint/no-require-imports': 'off'
    }
  },
  // Override: allow loadExternalScript import in approved files (excluding BidAdapters)
  {
    files: APPROVED_LOAD_EXTERNAL_SCRIPT_PATHS.filter(p => !p.includes('BidAdapter')).map(p => {
      // If path doesn't end with .js/.ts/.mjs, treat as folder pattern
      if (!p.match(/\.(js|ts|mjs)$/)) {
        return `${p}/**/*.{js,ts,mjs}`;
      }
      return p;
    }),
      rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: []
        }
      ],
      }
  },
  ]
