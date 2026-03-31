import { requirePermission } from "@/lib/auth";
import NewMusicalForm from "@/components/NewMusicalForm";
import { getCurrentLanguage } from "@/lib/i18n-server";
import { getTranslations } from "@/lib/i18n";
import { PERMISSIONS } from "@/lib/permissions";

type NewMusicalPageProps = {
  searchParams?: Promise<{
    error?: string;
    title?: string;
    description?: string;
    year?: string;
    isPublished?: string;
  }>;
};

const buildNewMusicalInitialValues = (searchParams?: {
  title?: string;
  description?: string;
  year?: string;
  isPublished?: string;
}) => {
  return {
    title: searchParams?.title ?? "",
    description: searchParams?.description ?? "",
    year: searchParams?.year ?? "",
    isPublished: searchParams?.isPublished === "1",
  };
};

function getErrorMessage(error: string | undefined, language: "he" | "en") {
  const t = getTranslations(language).contentEditor.musicals;

  switch (error) {
    case "missing-title":
      return t.titleRequired;
    case "invalid-year":
      return t.yearInvalid;
    case "invalid-slug":
      return t.invalidSlug;
    case "invalid-image-type":
      return t.invalidImageType;
    case "image-too-large":
      return t.imageTooLarge;
    default:
      return null;
  }
}

export default async function NewMusicalPage(props: NewMusicalPageProps) {
  await requirePermission(PERMISSIONS.musicalCreate);

  const language = await getCurrentLanguage();
  const t = getTranslations(language).contentEditor.musicals;
  const searchParams = await props.searchParams;
  const errorMessage = getErrorMessage(searchParams?.error, language);

  return (
    <main className="page-shell">
      <div className="orb one" />
      <div className="orb two" />

      <div className="container">
        <section className="card">
          <h1 className="viewer-title">{t.newPageTitle}</h1>
          <p className="viewer-text">{t.newPageText}</p>

          {errorMessage ? <div className="auth-error">{errorMessage}</div> : null}
          <NewMusicalForm
            language={language}
            serverError={searchParams?.error}
            initialValues={buildNewMusicalInitialValues(searchParams)}
          />
        </section>
      </div>
    </main>
  );
}
