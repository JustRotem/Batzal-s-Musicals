import { logAccountEmailProviderStatus } from "@/lib/account-email";

export async function register() {
  logAccountEmailProviderStatus("startup");
}
