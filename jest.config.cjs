/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true
    }]
  },
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/shared/$1'
  },
  testMatch: ['**/__tests__/**/*.(spec|test).ts'],
  extensionsToTreatAsEsm: ['.ts'],
};
