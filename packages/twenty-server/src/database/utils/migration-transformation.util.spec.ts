import {
  transformLinksToFirestore,
  transformEmailsToFirestore,
  transformPhonesToFirestore,
} from './migration-transformation.util';

describe('migration-transformation.util', () => {
  describe('transformLinksToFirestore', () => {
    it('should return null if links is null', () => {
      expect(transformLinksToFirestore(null)).toBeNull();
    });

    it('should return primary link if secondary links are empty', () => {
      const links = {
        primaryLinkLabel: 'Primary',
        primaryLinkUrl: 'https://primary.com',
        secondaryLinks: [],
      };
      expect(transformLinksToFirestore(links)).toEqual([
        { label: 'Primary', url: 'https://primary.com' },
      ]);
    });

    it('should combine primary and secondary links', () => {
      const links = {
        primaryLinkLabel: 'Primary',
        primaryLinkUrl: 'https://primary.com',
        secondaryLinks: [{ label: 'Secondary', url: 'https://secondary.com' }],
      };
      expect(transformLinksToFirestore(links)).toEqual([
        { label: 'Primary', url: 'https://primary.com' },
        { label: 'Secondary', url: 'https://secondary.com' },
      ]);
    });

    it('should handle missing labels with empty strings', () => {
      const links = {
        primaryLinkLabel: '',
        primaryLinkUrl: 'https://primary.com',
        secondaryLinks: [{ label: '', url: 'https://secondary.com' }],
      };
      expect(transformLinksToFirestore(links)).toEqual([
        { label: '', url: 'https://primary.com' },
        { label: '', url: 'https://secondary.com' },
      ]);
    });
  });

  describe('transformEmailsToFirestore', () => {
    it('should return null if emails is null', () => {
      expect(transformEmailsToFirestore(null)).toBeNull();
    });

    it('should return primary email if additional emails are empty', () => {
      const emails = {
        primaryEmail: 'primary@example.com',
        additionalEmails: [],
      };
      expect(transformEmailsToFirestore(emails)).toEqual([
        { email: 'primary@example.com' },
      ]);
    });

    it('should combine primary and additional emails', () => {
      const emails = {
        primaryEmail: 'primary@example.com',
        additionalEmails: ['secondary@example.com', 'tertiary@example.com'],
      };
      expect(transformEmailsToFirestore(emails)).toEqual([
        { email: 'primary@example.com' },
        { email: 'secondary@example.com' },
        { email: 'tertiary@example.com' },
      ]);
    });
  });

  describe('transformPhonesToFirestore', () => {
    it('should return null if phones is null', () => {
      expect(transformPhonesToFirestore(null)).toBeNull();
    });

    it('should return primary phone if additional phones are empty', () => {
      const phones = {
        primaryPhoneNumber: '1234567890',
        primaryPhoneCountryCode: 'US',
        primaryPhoneCallingCode: '+1',
        additionalPhones: [],
      };
      expect(transformPhonesToFirestore(phones)).toEqual([
        { number: '1234567890', countryCode: 'US', callingCode: '+1' },
      ]);
    });

    it('should combine primary and additional phones', () => {
      const phones = {
        primaryPhoneNumber: '1234567890',
        primaryPhoneCountryCode: 'US',
        primaryPhoneCallingCode: '+1',
        additionalPhones: [
          { number: '0987654321', countryCode: 'UK', callingCode: '+44' },
        ],
      };
      expect(transformPhonesToFirestore(phones as any)).toEqual([
        { number: '1234567890', countryCode: 'US', callingCode: '+1' },
        { number: '0987654321', countryCode: 'UK', callingCode: '+44' },
      ]);
    });

    it('should handle missing country/calling codes with empty strings', () => {
      const phones = {
        primaryPhoneNumber: '1234567890',
        primaryPhoneCountryCode: '',
        primaryPhoneCallingCode: '',
        additionalPhones: [
          { number: '0987654321', countryCode: '', callingCode: '' },
        ],
      };
      expect(transformPhonesToFirestore(phones as any)).toEqual([
        { number: '1234567890', countryCode: '', callingCode: '' },
        { number: '0987654321', countryCode: '', callingCode: '' },
      ]);
    });
  });
});
