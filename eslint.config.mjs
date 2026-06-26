import perfectionist from 'eslint-plugin-perfectionist';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['.next', 'dist', 'node_modules'] },
  {
    extends: [tseslint.configs.recommended],
    plugins: { perfectionist },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'perfectionist/sort-imports': 'warn',
      'perfectionist/sort-exports': 'warn',
      'perfectionist/sort-named-imports': 'warn',
    },
  },
);
