import type { LegalDocument } from './types';

const CONTACT_EMAIL = 'info.mps@descon.com';
const POSTAL_ADDRESS =
  'Descon Engineering Limited, Descon Head Quarters, 18 KM Ferozepur Road, Lahore 54760, Pakistan';
const PRIVACY_POLICY_LINK = { link: 'MPS Connect Privacy Policy', href: '/privacy' };

export const termsAndConditions: LegalDocument = {
  title: 'MPS Connect Terms and Conditions',
  effectiveDate: '30 October 2026',
  intro: [
    { kind: 'paragraph', content: [{ bold: 'Operator:' }, ` ${POSTAL_ADDRESS}`] },
    { kind: 'paragraph', content: [{ bold: 'Contact:' }, ` ${CONTACT_EMAIL}`] },
  ],
  sections: [
    {
      heading: '1. Introduction',
      blocks: [
        {
          kind: 'paragraph',
          content: [
            'These Terms and Conditions ("Terms") govern your use of the MPS Connect mobile app, website and related services ("MPS Connect"), operated by Descon Engineering Limited ("Descon", "we", "us").',
          ],
        },
        {
          kind: 'paragraph',
          content: [
            'MPS Connect supports candidate registration, recruitment, document collection and verification, onboarding fee payment, visa and work permit processing, overseas mobilization and travel.',
          ],
        },
        {
          kind: 'paragraph',
          content: [
            'By signing in, accepting these Terms in the app or submitting information, you agree to these Terms and to the ',
            PRIVACY_POLICY_LINK,
            '. If you do not agree, do not use MPS Connect and contact your Descon representative.',
          ],
        },
      ],
    },
    {
      heading: '2. Eligibility and your account',
      blocks: [
        {
          kind: 'bullets',
          items: [
            [
              'MPS Connect is for candidates registered with Descon who are 18 or older. You cannot create an account yourself: Descon creates it from its recruitment records.',
            ],
            [
              'You sign in with your CNIC and a one-time code sent by SMS to your registered mobile number. Never share this code with anyone, including people who claim to be from Descon.',
            ],
            ['Tell us at once if you think someone else has used your account or if your mobile number changes.'],
            ["You must not impersonate anyone, use another person's account or give false identity information."],
          ],
        },
      ],
    },
    {
      heading: '3. Accurate and authentic information',
      blocks: [
        {
          kind: 'paragraph',
          content: [
            'Everything you submit must be accurate, complete, current and genuine to the best of your knowledge. This includes:',
          ],
        },
        {
          kind: 'bullets',
          items: [
            ['Photographs and identity details.'],
            ['CNIC and passport details and copies.'],
            ['Educational certificates and professional qualifications.'],
            ['Employment history and experience records.'],
            ['Address, city and contact details.'],
            ['Bank account details.'],
            ['Next-of-kin and emergency contact details.'],
            ['Any other document or information requested in the app.'],
          ],
        },
        {
          kind: 'paragraph',
          content: [
            'You must not edit, alter, forge or misrepresent any document or information. If you find an error, or your details change, tell us or correct it through the app as soon as possible. We may ask for original documents or more evidence where reasonably needed.',
          ],
        },
      ],
    },
    {
      heading: '4. Consequences of false information',
      blocks: [
        {
          kind: 'paragraph',
          content: [
            'You are responsible for the information and documents you submit. If you knowingly submit false, forged, altered or misleading information, Descon may, as the law allows:',
          ],
        },
        {
          kind: 'bullets',
          items: [
            ['Ask for clarification or replacement documents.'],
            ['Pause or reject your application.'],
            ['Restrict or suspend your access to MPS Connect.'],
            ['Withdraw an offer or take other lawful employment action.'],
            ['Report suspected fraud to the relevant authorities.'],
          ],
        },
        { kind: 'paragraph', content: ['Nothing in these Terms removes rights you have under applicable law.'] },
      ],
    },
    {
      heading: '5. Personal information',
      blocks: [
        {
          kind: 'paragraph',
          content: [
            'MPS Connect collects personal information such as your photograph, CNIC, passport, contact details, address, bank details and next-of-kin details. We use it for recruitment, identity checks, employment, visa and work permit processing, mobilization and travel.',
          ],
        },
        {
          kind: 'paragraph',
          content: [
            'How we collect, use, share, protect and delete your information, and how to ask for your account to be deleted, is explained in the ',
            PRIVACY_POLICY_LINK,
            '. Please read it before submitting information.',
          ],
        },
      ],
    },
    {
      heading: '6. Uploading documents',
      blocks: [
        {
          kind: 'bullets',
          items: [
            ['Upload documents only in the sections of the app that ask for them.'],
            ['Never upload passwords, bank PINs, one-time codes, card numbers or card security codes.'],
            ['If a requested document seems wrong or unnecessary, contact your Descon representative before uploading it.'],
          ],
        },
      ],
    },
    {
      heading: '7. Next-of-kin information',
      blocks: [
        {
          kind: 'paragraph',
          content: [
            "You may be asked for details of your next of kin or emergency contact for employment, mobilization or emergencies. Make sure the details are correct and that the person knows you are sharing them with Descon. Submit another person's identity document only when the app specifically asks for it.",
          ],
        },
      ],
    },
    {
      heading: '8. Onboarding fee and payments',
      blocks: [
        {
          kind: 'bullets',
          items: [
            ['At a set stage of your application, an onboarding fee may be due. The app shows the amount before you pay.'],
            [
              "Pay only through MPS Connect: by card on KuickPay's secure page, or with the payment code shown in the app through a mobile wallet, bank app or bank branch. Never pay cash or transfer money to an individual.",
            ],
            ['A payment code has a due date shown in the app. After that date it can no longer be paid, and you can get a new one.'],
            ['Pay the fee once only. If you have both a card checkout and a payment code open, use just one of them.'],
            ['If you pay twice by mistake, contact us. The extra payment is refunded after it is confirmed.'],
            ["Any other refund of the onboarding fee follows Descon's refund policy as communicated to you, and applicable law."],
            ['Payments are processed by KuickPay. Descon does not receive or store your card details.'],
          ],
        },
      ],
    },
    {
      heading: '9. SMS and automated calls',
      blocks: [
        {
          kind: 'paragraph',
          content: [
            'By using MPS Connect, you agree that Descon may send you SMS messages and automated phone calls about your account and application, such as login codes, document requests, appointments, fee reminders, visa updates and travel details. Standard network charges may apply to calls you make to us.',
          ],
        },
      ],
    },
    {
      heading: '10. Permitted use',
      blocks: [
        {
          kind: 'paragraph',
          content: ['Use MPS Connect only for your own recruitment, employment and related administration. You must not:'],
        },
        {
          kind: 'bullets',
          items: [
            ['Use it for anything unlawful, fraudulent or misleading.'],
            ['Submit forged, altered or unauthorized documents.'],
            ["Access another person's account or information."],
            ['Try to get around security or access controls.'],
            ['Upload malicious software or harmful content.'],
            ['Interfere with how MPS Connect works or is available.'],
            ["Copy, extract or share other candidates' information."],
          ],
        },
      ],
    },
    {
      heading: '11. Review and verification',
      blocks: [
        {
          kind: 'paragraph',
          content: [
            'Descon may review and verify your information where reasonably needed for recruitment, identity checks, employment, visa or work permit processing, mobilization, travel, client requirements or legal compliance, and may ask you for more documents.',
          ],
        },
        {
          kind: 'paragraph',
          content: [
            'Applying through MPS Connect does not guarantee selection, employment, deployment, visa or work permit approval, or travel. These depend on your qualifications, vacancies, client requirements, medical results, government decisions and other factors.',
          ],
        },
      ],
    },
    {
      heading: '12. Third-party services and sharing',
      blocks: [
        {
          kind: 'paragraph',
          content: [
            'MPS Connect uses third-party providers for hosting, SMS, automated calls and payments. Where needed for your recruitment, your information may be shared with Descon group companies, clients, project owners, medical centres, embassies, immigration authorities and travel providers, as described in the ',
            { link: 'Privacy Policy', href: '/privacy' },
            '.',
          ],
        },
      ],
    },
    {
      heading: '13. Availability and changes to the app',
      blocks: [
        {
          kind: 'paragraph',
          content: [
            'We may update, maintain, suspend or remove features for technical, security, operational, legal or business reasons. We try to announce important changes, but we do not guarantee that MPS Connect will always be available or error-free. If a technical problem stops you submitting or correcting information, contact us.',
          ],
        },
      ],
    },
    {
      heading: '14. Intellectual property',
      blocks: [
        {
          kind: 'paragraph',
          content: [
            'The MPS Connect software, design, branding and content belong to Descon or its licensors. You may use the app only for its intended purpose; using it gives you no ownership of any of it.',
          ],
        },
      ],
    },
    {
      heading: '15. Suspension or closing of access',
      blocks: [
        {
          kind: 'paragraph',
          content: [
            'Descon may suspend or close your access where reasonably needed because of suspected misuse, security concerns, unauthorized access, false submissions or a breach of these Terms. Where appropriate and lawful, we will tell you why and give you a chance to explain or correct it. Closing access does not end any legal duty to keep records.',
          ],
        },
        {
          kind: 'paragraph',
          content: [
            `You can ask for your account to be deleted at any time by emailing ${CONTACT_EMAIL}, as described in the `,
            { link: 'Privacy Policy', href: '/privacy' },
            '. Only Descon can deactivate or delete an account.',
          ],
        },
      ],
    },
    {
      heading: '16. Limitation of liability',
      blocks: [
        {
          kind: 'paragraph',
          content: [
            'We take reasonable steps to keep MPS Connect working and secure, but it may sometimes have errors, interruptions or maintenance downtime. To the extent the law allows, Descon is not liable for losses caused by such interruptions, or by delays or decisions of third parties such as clients, medical centres, embassies, authorities, airlines or payment providers. Nothing in these Terms limits liability that cannot be limited by law.',
          ],
        },
      ],
    },
    {
      heading: '17. Changes to these Terms',
      blocks: [
        {
          kind: 'paragraph',
          content: [
            'We may update these Terms when MPS Connect, our operations or the law change. The latest version, with its effective date, is always on this page and in the app. If a change is significant, we will ask you to accept the new Terms in the app.',
          ],
        },
      ],
    },
    {
      heading: '18. Governing law',
      blocks: [
        {
          kind: 'paragraph',
          content: [
            'These Terms are governed by the laws of Pakistan. Disputes are subject to the courts of Lahore, without affecting any mandatory rights you have under applicable law.',
          ],
        },
      ],
    },
    {
      heading: '19. Contact',
      blocks: [
        {
          kind: 'bullets',
          items: [
            [{ bold: 'Email:' }, ` ${CONTACT_EMAIL}`],
            [{ bold: 'Post:' }, ` ${POSTAL_ADDRESS}`],
          ],
        },
      ],
    },
    {
      heading: '20. Candidate acknowledgement',
      blocks: [
        { kind: 'paragraph', content: ['By selecting "I Agree" in MPS Connect, I confirm that:'] },
        {
          kind: 'steps',
          items: [
            ['I have read and understood these Terms and the MPS Connect Privacy Policy.'],
            ['The information and documents I submit will be accurate, complete and genuine.'],
            ['I will not upload forged, altered or misleading information or documents.'],
            ['I will tell Descon if I find an error in information I have submitted.'],
            [
              'My information may be shared with authorized parties for recruitment, employment, visa and work permit processing, mobilization and travel, as described in the Privacy Policy.',
            ],
            ['I will pay any onboarding fee only through MPS Connect.'],
            ['Applying does not guarantee employment, deployment, visa or work permit approval.'],
            ['I am responsible for the information and documents I submit.'],
          ],
        },
      ],
    },
  ],
};
