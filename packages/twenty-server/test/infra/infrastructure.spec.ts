import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

describe('Infrastructure Configuration', () => {
  const rootDir = path.resolve(__dirname, '../../../../..');

  test('cloudbuild.yaml should have the correct structure and no legacy secrets', () => {
    const cloudbuildPath = path.join(rootDir, 'cloudbuild.yaml');
    expect(fs.existsSync(cloudbuildPath)).toBe(true);

    const fileContents = fs.readFileSync(cloudbuildPath, 'utf8');
    const config = yaml.load(fileContents) as any;

    expect(config).toBeDefined();
    expect(config.steps).toBeInstanceOf(Array);

    // Verify Secret Manager integration and absence of legacy secrets
    const deployStep = config.steps.find((step: any) =>
      step.args && step.args.includes('deploy')
    );

    expect(deployStep).toBeDefined();

    const setSecretsArg = deployStep.args.find((arg: string) => arg.startsWith('--set-secrets'));
    expect(setSecretsArg).toBeDefined();

    // Legacy secrets that should be REMOVED
    expect(setSecretsArg).not.toContain('PG_DATABASE_URL');
    expect(setSecretsArg).not.toContain('REDIS_URL');

    // Required cloud-native secrets
    expect(setSecretsArg).toContain('APP_SECRET');
    expect(setSecretsArg).toContain('FIREBASE_CONFIG');
  });

  test('README.md should contain Firebase Emulator instructions and no legacy database setup', () => {
    const readmePath = path.join(rootDir, 'README.md');
    expect(fs.existsSync(readmePath)).toBe(true);

    const content = fs.readFileSync(readmePath, 'utf8');

    // Should contain Firebase Emulator mentions
    expect(content).toContain('Firebase Emulators');
    expect(content).toContain('yarn firebase:emulators');

    // Should NOT contain legacy setup instructions (PostgreSQL/Redis/BullMQ)
    expect(content).not.toContain('PostgreSQL Database');
    expect(content).not.toContain('Redis Database');
    expect(content).not.toContain('npx nx worker');
  });

  test('Documentation for JSON-schema driven metadata system should exist', () => {
    const docsPath = path.join(rootDir, 'packages/twenty-docs/developers/metadata-system.mdx');
    expect(fs.existsSync(docsPath)).toBe(true);

    const content = fs.readFileSync(docsPath, 'utf8');
    expect(content).toContain('JSON-schema driven metadata system');
  });
});
