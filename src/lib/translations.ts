export type Language = 'en' | 'fr' | 'ar';

export interface TranslationDictionary {
  appName: string;
  tagline: string;
  overview: string;
  variable: string;
  fixed: string;
  savings: string;
  trends: string;
  settings: string;
  totalIncome: string;
  totalSpent: string;
  remaining: string;
  needs: string;
  wants: string;
  addExpense: string;
  addBill: string;
  addGoal: string;
  moveMoney: string;
  category: string;
  amount: string;
  date: string;
  place: string;
  note: string;
  person: string;
  receipt: string;
  recurring: string;
  proPlan: string;
  upgradeToPro: string;
  freePlan: string;
  save: string;
  cancel: string;
  delete: string;
  edit: string;
  searchPlaceholder: string;
  filterByPerson: string;
  allPersons: string;
  importCsv: string;
  exportCsv: string;
  alerts: string;
  noAlerts: string;
  language: string;
  currency: string;
  theme: string;
  incomeSources: string;
  household: string;
  close: string;
}

export const TRANSLATIONS: Record<Language, TranslationDictionary> = {
  en: {
    appName: 'Flousy',
    tagline: 'Private, mobile-first budget tracker that separates what money is for from where it is.',
    overview: 'Overview',
    variable: 'Variable',
    fixed: 'Fixed',
    savings: 'Savings',
    trends: 'Trends',
    settings: 'Settings',
    totalIncome: 'Total Income',
    totalSpent: 'Total Spent',
    remaining: 'Remaining',
    needs: 'Needs',
    wants: 'Wants',
    addExpense: 'Add Expense',
    addBill: 'Add Bill',
    addGoal: 'Add Goal',
    moveMoney: 'Move Money',
    category: 'Category',
    amount: 'Amount',
    date: 'Date',
    place: 'Place',
    note: 'Note',
    person: 'Person',
    receipt: 'Receipt',
    recurring: 'Recurring',
    proPlan: 'Pro Plan',
    upgradeToPro: 'Upgrade to Pro',
    freePlan: 'Free Plan',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    searchPlaceholder: 'Search expenses, categories, or notes...',
    filterByPerson: 'Filter by person',
    allPersons: 'All Members',
    importCsv: 'Import CSV',
    exportCsv: 'Export CSV',
    alerts: 'Budget Alerts',
    noAlerts: 'All budget envelopes are healthy!',
    language: 'Language',
    currency: 'Currency',
    theme: 'Theme',
    incomeSources: 'Income Sources',
    household: 'Household',
    close: 'Close',
  },
  fr: {
    appName: 'Flousy',
    tagline: 'Suivi budgétaire privé et mobile séparant la destination de l\'argent de son emplacement.',
    overview: 'Aperçu',
    variable: 'Variable',
    fixed: 'Fixe',
    savings: 'Épargne',
    trends: 'Tendances',
    settings: 'Paramètres',
    totalIncome: 'Revenu Total',
    totalSpent: 'Dépenses Totales',
    remaining: 'Restant',
    needs: 'Besoins',
    wants: 'Envies',
    addExpense: 'Ajouter Dépense',
    addBill: 'Ajouter Facture',
    addGoal: 'Ajouter Objectif',
    moveMoney: 'Déplacer Argent',
    category: 'Catégorie',
    amount: 'Montant',
    date: 'Date',
    place: 'Emplacement',
    note: 'Note',
    person: 'Personne',
    receipt: 'Reçu',
    recurring: 'Récurrent',
    proPlan: 'Plan Pro',
    upgradeToPro: 'Passer au Pro',
    freePlan: 'Plan Gratuit',
    save: 'Enregistrer',
    cancel: 'Annuler',
    delete: 'Supprimer',
    edit: 'Modifier',
    searchPlaceholder: 'Rechercher des dépenses, catégories...',
    filterByPerson: 'Filtrer par personne',
    allPersons: 'Tous les membres',
    importCsv: 'Importer CSV',
    exportCsv: 'Exporter CSV',
    alerts: 'Alertes Budget',
    noAlerts: 'Tous vos enveloppes budgétaires sont saines !',
    language: 'Langue',
    currency: 'Devise',
    theme: 'Thème',
    incomeSources: 'Sources de Revenus',
    household: 'Foyer',
    close: 'Fermer',
  },
  ar: {
    appName: 'فلوسي',
    tagline: 'تطبيق إدارة ميزانية شخصية بفصل بين غرض المال ومكان وجوده الحقيقي.',
    overview: 'نظرة عامة',
    variable: 'متغيرة',
    fixed: 'ثابتة',
    savings: 'الادخار',
    trends: 'الاتجاهات',
    settings: 'الإعدادات',
    totalIncome: 'إجمالي الدخل',
    totalSpent: 'إجمالي المصاريف',
    remaining: 'المتبقي',
    needs: 'الاحتياجات',
    wants: 'الرغبات',
    addExpense: 'إضافة مصورف',
    addBill: 'إضافة فاتورة',
    addGoal: 'إضافة هدف',
    moveMoney: 'تحويل أموال',
    category: 'الفئة',
    amount: 'المبلغ',
    date: 'التاريخ',
    place: 'المكان',
    note: 'ملاحظة',
    person: 'الشخص',
    receipt: 'وصل / إيصال',
    recurring: 'متكرر',
    proPlan: 'الخطة الاحترافية',
    upgradeToPro: 'الترقية إلى Pro',
    freePlan: 'الخطة المجانية',
    save: 'حفظ',
    cancel: 'إلغاء',
    delete: 'حذف',
    edit: 'تعديل',
    searchPlaceholder: 'بحث في المصاريف، الفئات، الملاحظات...',
    filterByPerson: 'تصفية حسب الشخص',
    allPersons: 'جميع الأعضاء',
    importCsv: 'استيراد CSV',
    exportCsv: 'تصدير CSV',
    alerts: 'تنبيهات الميزانية',
    noAlerts: 'جميع ميزانياتك في وضع ممتازة!',
    language: 'اللغة',
    currency: 'العملة',
    theme: 'المظهر',
    incomeSources: 'مصادر الدخل',
    household: 'العائلة / العائلة',
    close: 'إغلاق',
  },
};
