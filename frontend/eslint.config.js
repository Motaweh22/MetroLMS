import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import boundaries from 'eslint-plugin-boundaries';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'public'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx,js,jsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      boundaries,
    },
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
      },
      'boundaries/include': ['src/**/*'],
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app' },
        { type: 'pages', pattern: 'src/pages' },
        { type: 'features', pattern: 'src/features/*', capture: ['featureName'] },
        { type: 'core', pattern: 'src/core' },
        { type: 'shared', pattern: 'src/shared' },
        { type: 'styles', pattern: 'src/styles' },
        { type: 'mocks', pattern: 'src/mocks' },
      ],
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: 'app', allow: ['pages', 'features', 'core', 'shared', 'styles', 'mocks'] },
            { from: 'pages', allow: ['features', 'core', 'shared', 'styles'] },
            { from: 'features', allow: ['core', 'shared', 'styles'] },
            {
              from: 'features',
              disallow: [['features', { featureName: '!${from.featureName}' }]],
              message: 'Cross-feature imports are strictly forbidden. Elevate shared concepts to @core or @shared.',
            },
            { from: 'core', allow: ['core', 'shared', 'styles'] },
            { from: 'shared', allow: ['shared', 'styles'] },
            { from: 'mocks', allow: ['core', 'shared', 'styles'] },
          ],
        },
      ],
    },
  }
);
