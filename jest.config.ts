import type { Config } from 'jest';

const config: Config = {
    roots: ['<rootDir>/src', '<rootDir>/tests'],
    transform: {
        '^.+\\.ts$': 'ts-jest'
    },
    setupFilesAfterEnv: ['./setup.js'],
    testRegex: '(/tests/.*|(\\.|/)(test|spec))\\.ts$',
    moduleFileExtensions: ['ts', 'js', 'json', 'node'],
    collectCoverage: true,
    coverageDirectory: 'coverage',
    testEnvironment: 'node'
};

export default config;