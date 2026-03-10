import { EmailsMetadata, LinksMetadata, PhonesMetadata } from 'twenty-shared';

export function transformLinksToFirestore(
  links: LinksMetadata | null,
): Array<{ label: string; url: string }> | null {
  if (!links) return null;
  const result: Array<{ label: string; url: string }> = [];
  if (links.primaryLinkUrl) {
    result.push({
      label: links.primaryLinkLabel || '',
      url: links.primaryLinkUrl,
    });
  }
  if (links.secondaryLinks && Array.isArray(links.secondaryLinks)) {
    for (const link of links.secondaryLinks) {
      if (link.url) {
        result.push({
          label: link.label || '',
          url: link.url,
        });
      }
    }
  }
  return result.length > 0 ? result : null;
}

export function transformEmailsToFirestore(
  emails: EmailsMetadata | null,
): Array<{ email: string }> | null {
  if (!emails) return null;
  const result: Array<{ email: string }> = [];
  if (emails.primaryEmail) {
    result.push({
      email: emails.primaryEmail,
    });
  }
  if (emails.additionalEmails && Array.isArray(emails.additionalEmails)) {
    for (const email of emails.additionalEmails) {
      if (email) {
        result.push({
          email: email,
        });
      }
    }
  }
  return result.length > 0 ? result : null;
}

export function transformPhonesToFirestore(
  phones: PhonesMetadata | null,
): Array<{ number: string; countryCode: string; callingCode: string }> | null {
  if (!phones) return null;
  const result: Array<{
    number: string;
    countryCode: string;
    callingCode: string;
  }> = [];
  if (phones.primaryPhoneNumber) {
    result.push({
      number: phones.primaryPhoneNumber,
      countryCode: phones.primaryPhoneCountryCode || '',
      callingCode: phones.primaryPhoneCallingCode || '',
    });
  }
  if (phones.additionalPhones && Array.isArray(phones.additionalPhones)) {
    for (const phone of phones.additionalPhones) {
      if (phone.number) {
        result.push({
          number: phone.number,
          countryCode: phone.countryCode || '',
          callingCode: phone.callingCode || '',
        });
      }
    }
  }
  return result.length > 0 ? result : null;
}
