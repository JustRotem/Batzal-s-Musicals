import { redirect } from "next/navigation";

type LegacyResetPasswordPageProps = {
  searchParams?: Promise<{
    token?: string;
    error?: string;
  }>;
};

export default async function LegacyResetPasswordPage(
  props: LegacyResetPasswordPageProps,
) {
  const searchParams = await props.searchParams;
  const nextSearchParams = new URLSearchParams();

  if (searchParams?.token) {
    nextSearchParams.set("token", searchParams.token);
  }

  if (searchParams?.error) {
    nextSearchParams.set("error", searchParams.error);
  }

  const suffix = nextSearchParams.toString();
  redirect(`/auth/reset-password${suffix ? `?${suffix}` : ""}`);
}
