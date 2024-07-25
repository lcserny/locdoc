const globals = require('globals');
const pluginJs = require("@eslint/js");
const tsEslint = require("typescript-eslint");

module.exports = [
    {
        files: ["**/*.js"],
        languageOptions: {
            sourceType: "commonjs",
        },
    },
    ...tsEslint.configs.recommended.map(conf => ({
        files: ['**/*.ts'],
        ...conf,
    })),
    {
        files: ['**/*.ts'],
        rules: {
            '@typescript-eslint/array-type': 'error',
            '@typescript-eslint/consistent-type-imports': 'error',
            "@typescript-eslint/no-explicit-any": "off"
        },
    },
    {
        languageOptions: {globals: {...globals.node, ...globals.jest, ...globals.es2021}}
    },
    pluginJs.configs.recommended
]