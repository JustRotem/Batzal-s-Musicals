import type { AppLanguage } from "@/lib/i18n";

const PASSWORD_RULE_DEFINITIONS = [
  {
    id: "length",
    test: (value: string) => value.length >= 8,
  },
  {
    id: "uppercase",
    test: (value: string) => /[A-Z]/.test(value),
  },
  {
    id: "lowercase",
    test: (value: string) => /[a-z]/.test(value),
  },
  {
    id: "number",
    test: (value: string) => /\d/.test(value),
  },
  {
    id: "special",
    test: (value: string) => /[^A-Za-z0-9]/.test(value),
  },
] as const;

const PASSWORD_RULE_LABELS: Record<AppLanguage, Record<(typeof PASSWORD_RULE_DEFINITIONS)[number]["id"], string>> = {
  he: {
    length: "לפחות 8 תווים",
    uppercase: "אות גדולה באנגלית",
    lowercase: "אות קטנה באנגלית",
    number: "ספרה אחת לפחות",
    special: "תו מיוחד אחד לפחות",
  },
  en: {
    length: "At least 8 characters",
    uppercase: "One uppercase English letter",
    lowercase: "One lowercase English letter",
    number: "At least one number",
    special: "At least one special character",
  },
};

export const PASSWORD_RULES = PASSWORD_RULE_DEFINITIONS;

export function getPasswordRules(language: AppLanguage) {
  return PASSWORD_RULE_DEFINITIONS.map((rule) => ({
    ...rule,
    label: PASSWORD_RULE_LABELS[language][rule.id],
  }));
}

export function isStrongPassword(value: string) {
  return PASSWORD_RULE_DEFINITIONS.every((rule) => rule.test(value));
}

export function getPasswordStrengthLabel(score: number, language: AppLanguage) {
  if (language === "en") {
    if (score >= 5) {
      return "Very strong";
    }

    if (score >= 4) {
      return "Strong";
    }

    if (score >= 3) {
      return "Medium";
    }

    if (score >= 1) {
      return "Weak";
    }

    return "Not entered yet";
  }

  if (score >= 5) {
    return "חזקה מאוד";
  }

  if (score >= 4) {
    return "חזקה";
  }

  if (score >= 3) {
    return "בינונית";
  }

  if (score >= 1) {
    return "חלשה";
  }

  return "עדיין לא הוזנה";
}
