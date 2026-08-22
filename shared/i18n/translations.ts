// Shared English/Urdu translation-key catalog for the candidate experience.
// Both apps look up copy by the same keys so behavior, wording and coverage
// stay in sync -- see AGENTS.md's "Use shared translation-key naming across
// platforms." Web and mobile each keep their own admin/dev-only screens
// (e.g. the web admin dashboard) out of this catalog by product scope.

export type Language = 'en' | 'ur';

export const SUPPORTED_LANGUAGES: Language[] = ['en', 'ur'];

export const translations = {
  en: {
    // Welcome
    welcomeTitle: 'Welcome',
    welcomeMessage: 'Descon Engineering Manpower Onboarding Portal',
    selectLanguage: 'Select Your Preferred Language',
    continue: 'Continue',
    englishLabel: 'English',
    englishHint: 'Continue in English',
    urduLabel: 'Urdu',
    urduHint: 'اردو میں جاری رکھیں',

    // Login
    login: 'Sign In',
    loginMessage: 'Enter your registered mobile number and CNIC to continue',
    cnic: 'CNIC Number',
    mobileNumber: 'Registered Mobile Number',
    password: 'Password',
    enterCNIC: 'Enter your CNIC',
    enterMobileNumber: '03XXXXXXXXX',
    enterRegNumber: 'Enter registration number',
    enterPassword: 'Enter password',
    signIn: 'Sign In',
    sendOTP: 'Send OTP',
    verifyOTP: 'Verify OTP',
    otpSentMessage: 'Enter the 6-digit code sent to',
    enterOTP: 'One-Time Password',
    resendOTP: 'Resend OTP',
    verifyAndLogin: 'Verify & Login',
    back: 'Back',

    // Dashboard
    dashboard: 'Dashboard',
    welcome: 'Welcome',
    currentStatus: 'Current Status',
    nextSteps: 'Next Steps',
    uploadDocuments: 'Upload Documents',
    makePayment: 'Make Payment',
    viewStatus: 'View Status',

    // Documents
    documents: 'Documents',
    uploadDocument: 'Upload Document',
    pending: 'Pending',
    verified: 'Verified',
    rejected: 'Rejected',
    uploaded: 'Uploaded',
    passport: 'Passport',
    cnicFront: 'CNIC (Front)',
    cnicBack: 'CNIC (Back)',
    nextOfKinCNIC: 'Next of Kin CNIC',
    policeCharacter: 'Police Character Certificate',
    bankDetails: 'Bank Details',
    chequeImage: 'Cheque/ATM Image',
    cv: 'CV/Resume',
    experienceLetter: 'Experience Letter',
    certificates: 'Certificates',
    polioCertificate: 'Polio Certificate',

    // Status
    status: 'Status',
    mobilizationProgress: 'Mobilization Progress',
    registered: 'Registered',
    documentsPending: 'Documents Pending',
    documentsUploaded: 'Documents Uploaded',
    documentsVerified: 'Verified',
    feePending: 'Fee Pending',
    feePaid: 'Fee Paid',
    sharedWithBU: 'Shared with Business Unit',
    qvcBooked: 'QVC Appointment Booked',
    qvcOutcome: 'QVC Outcome',
    visaIssued: 'Visa Issued',
    protectionCompleted: 'Protection Completed',
    readyToFly: 'Ready to Fly',
    flightDetailsUploaded: 'Flight Details Uploaded',
    mobilized: 'Mobilized',

    // Profile
    profile: 'Profile',
    personalInfo: 'Personal Information',
    contactInfo: 'Contact Information',
    language: 'Language',
    logout: 'Logout',

    // Payment
    payment: 'Payment',
    paymentStatus: 'Payment Status',
    payNow: 'Pay Now',
    amount: 'Amount',
    reference: 'Reference Number',

    // Not found
    notFoundTitle: "This page doesn't exist",
    notFoundMessage: "We couldn't find what you were looking for.",
    goHome: 'Go to homepage',
  },
  ur: {
    // Welcome
    welcomeTitle: 'خوش آمدید',
    welcomeMessage: 'ڈیسکون انجینئرنگ مین پاور آن بورڈنگ پورٹل',
    selectLanguage: 'اپنی پسندیدہ زبان منتخب کریں',
    continue: 'جاری رکھیں',
    englishLabel: 'English',
    englishHint: 'Continue in English',
    urduLabel: 'اردو',
    urduHint: 'اردو میں جاری رکھیں',

    // Login
    login: 'سائن ان',
    loginMessage: 'جاری رکھنے کے لیے اپنا رجسٹرڈ موبائل نمبر اور شناختی کارڈ نمبر درج کریں',
    cnic: 'شناختی کارڈ نمبر',
    mobileNumber: 'رجسٹرڈ موبائل نمبر',
    password: 'پاس ورڈ',
    enterCNIC: 'اپنا شناختی کارڈ نمبر درج کریں',
    enterMobileNumber: '03XXXXXXXXX',
    enterRegNumber: 'رجسٹریشن نمبر درج کریں',
    enterPassword: 'پاس ورڈ درج کریں',
    signIn: 'سائن ان کریں',
    sendOTP: 'او ٹی پی بھیجیں',
    verifyOTP: 'او ٹی پی کی تصدیق کریں',
    otpSentMessage: 'بھیجے گئے 6 ہندسوں کا کوڈ درج کریں',
    enterOTP: 'ایک بار کا پاس ورڈ',
    resendOTP: 'دوبارہ او ٹی پی بھیجیں',
    verifyAndLogin: 'تصدیق اور لاگ ان',
    back: 'واپس',

    // Dashboard
    dashboard: 'ڈیش بورڈ',
    welcome: 'خوش آمدید',
    currentStatus: 'موجودہ حیثیت',
    nextSteps: 'اگلے اقدامات',
    uploadDocuments: 'دستاویزات اپ لوڈ کریں',
    makePayment: 'ادائیگی کریں',
    viewStatus: 'حیثیت دیکھیں',

    // Documents
    documents: 'دستاویزات',
    uploadDocument: 'دستاویز اپ لوڈ کریں',
    pending: 'زیر التواء',
    verified: 'تصدیق شدہ',
    rejected: 'مسترد',
    uploaded: 'اپ لوڈ شدہ',
    passport: 'پاسپورٹ',
    cnicFront: 'شناختی کارڈ (سامنے)',
    cnicBack: 'شناختی کارڈ (پیچھے)',
    nextOfKinCNIC: 'قریبی رشتہ دار کا شناختی کارڈ',
    policeCharacter: 'پولیس کریکٹر سرٹیفکیٹ',
    bankDetails: 'بینک کی تفصیلات',
    chequeImage: 'چیک/اے ٹی ایم تصویر',
    cv: 'سی وی',
    experienceLetter: 'تجربہ کار خط',
    certificates: 'سرٹیفکیٹ',
    polioCertificate: 'پولیو سرٹیفکیٹ',

    // Status
    status: 'حیثیت',
    mobilizationProgress: 'متحرک کاری کی پیشرفت',
    registered: 'رجسٹرڈ',
    documentsPending: 'دستاویزات زیر التواء',
    documentsUploaded: 'دستاویزات اپ لوڈ',
    documentsVerified: 'تصدیق شدہ',
    feePending: 'فیس زیر التواء',
    feePaid: 'فیس ادا شدہ',
    sharedWithBU: 'بزنس یونٹ کے ساتھ شیئر',
    qvcBooked: 'کیو وی سی ملاقات بک',
    qvcOutcome: 'کیو وی سی نتیجہ',
    visaIssued: 'ویزا جاری',
    protectionCompleted: 'تحفظ مکمل',
    readyToFly: 'پرواز کے لیے تیار',
    flightDetailsUploaded: 'پرواز کی تفصیلات اپ لوڈ',
    mobilized: 'متحرک',

    // Profile
    profile: 'پروفائل',
    personalInfo: 'ذاتی معلومات',
    contactInfo: 'رابطہ کی معلومات',
    language: 'زبان',
    logout: 'لاگ آؤٹ',

    // Payment
    payment: 'ادائیگی',
    paymentStatus: 'ادائیگی کی حیثیت',
    payNow: 'ابھی ادا کریں',
    amount: 'رقم',
    reference: 'حوالہ نمبر',

    // Not found
    notFoundTitle: 'یہ صفحہ موجود نہیں ہے',
    notFoundMessage: 'ہم وہ نہیں ڈھونڈ سکے جس کی آپ کو تلاش تھی۔',
    goHome: 'ہوم پیج پر جائیں',
  },
} as const satisfies Record<Language, Record<string, string>>;

export type TranslationKey = keyof (typeof translations)['en'];
