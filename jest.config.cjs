/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node', // Default to node for server tests
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true
    }]
  },
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@/(.*)$': '<rootDir>/client/src/$1'
  },
  testMatch: ['**/__tests__/**/*.(spec|test).ts', '**/__tests__/**/*.(spec|test).tsx'],
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  // Use jsdom for client tests, node for server tests
  projects: [
    {
      displayName: 'server',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/server/__tests__/**/*.test.ts'],
      transform: {
        '^.+\\.tsx?$': ['ts-jest', {
          useESM: true
        }]
      },
      moduleNameMapper: {
        '^@shared/(.*)$': '<rootDir>/shared/$1',
      },
      extensionsToTreatAsEsm: ['.ts'],
    },
    {
      displayName: 'client',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/client/__tests__/**/*.test.tsx'],
      setupFilesAfterEnv: ['<rootDir>/client/__tests__/setup.ts'],
      transform: {
        '^.+\\.tsx?$': ['ts-jest', {
          useESM: true
        }]
      },
      moduleNameMapper: {
        '^@shared/(.*)$': '<rootDir>/shared/$1',
        '^@/(.*)$': '<rootDir>/client/src/$1'
      },
      extensionsToTreatAsEsm: ['.ts', '.tsx'],
    },
    {
      displayName: 'client-node',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/client/__tests__/**/*.test.ts'],
      transform: {
        '^.+\\.tsx?$': ['ts-jest', {
          useESM: true
        }]
      },
      moduleNameMapper: {
        '^@shared/(.*)$': '<rootDir>/shared/$1',
        '^@/(.*)$': '<rootDir>/client/src/$1'
      },
      extensionsToTreatAsEsm: ['.ts'],
    },
  ],
};
