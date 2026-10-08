import privacyPolicy from '../../legal/privacy_policy.md?raw';
import termsOfService from '../../legal/terms_of_service.md?raw';

export const legalDocuments = {
  terms: { title: '이용약관', source: termsOfService },
  privacy: { title: '개인정보처리방침', source: privacyPolicy },
} as const;

export type LegalDocumentKey = keyof typeof legalDocuments;
