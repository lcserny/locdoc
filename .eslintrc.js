module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    parserOptions: {
        project: ['./tsconfig.json']
    },
    plugins: ['@typescript-eslint', 'jest'],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:jest/recommended'
    ],
    env: {
        node: true,
        es2021: true,
        jest: true
    },
    rules: {
        // your custom rules
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        'jest/no-disabled-tests': 'warn'
    }
};