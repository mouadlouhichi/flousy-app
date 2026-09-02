export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface HouseholdInviteCopy {
  emailSubject: string;
  emailGreeting: string;
  emailBody: string;
  emailAccept: string;
  emailExpires: string;
}

export interface HouseholdInviteInput {
  recipient: string;
  language: 'en' | 'fr' | 'ar';
  householdName: string;
  roleLabel: string;
  acceptUrl: string;
  copy: HouseholdInviteCopy;
  interpolate: (template: string) => string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderHouseholdInvite(input: HouseholdInviteInput): RenderedEmail {
  const { copy, interpolate, acceptUrl, language } = input;
  return {
    subject: interpolate(copy.emailSubject),
    html: `<div dir="${language === 'ar' ? 'rtl' : 'ltr'}"><p>${escapeHtml(copy.emailGreeting)}</p><p>${escapeHtml(interpolate(copy.emailBody))}</p><p><a href="${escapeHtml(acceptUrl)}">${escapeHtml(copy.emailAccept)}</a></p><p>${escapeHtml(copy.emailExpires)}</p></div>`,
    text: [
      copy.emailGreeting,
      interpolate(copy.emailBody),
      `${copy.emailAccept}: ${acceptUrl}`,
      copy.emailExpires,
    ].join('\n\n'),
  };
}
