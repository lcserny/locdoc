module.exports = {
    env: {
        commonjs: true,
        node: true,
        jest: true,
        es2021: true,
    },
    extends: ["eslint:recommended", "@babel/core"],
    overrides: [
        {
            files: [".eslintrc.{js,cjs}"],
        },
    ],
    parser: "@babel/eslint-parser",
    parserOptions: {
        sourceType: "script",
        ecmaFeatures: {
            globalReturn: false,
        },
        ecmaVersion: "latest",
        requireConfigFile: false,
        babelOptions: {
            babelrc: false,
            configFile: false,
            presets: ["@babel/preset-env"]
        },
    },
    rules: {},
};
