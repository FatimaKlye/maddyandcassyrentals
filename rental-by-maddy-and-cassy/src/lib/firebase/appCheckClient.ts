import {
  getToken,
  initializeAppCheck,
  ReCaptchaV3Provider,
  type AppCheck,
} from "firebase/app-check";
import { app } from "@/src/lib/firebase/config";

let instance: AppCheck | null = null;

async function getInstance(): Promise<AppCheck | null> {
  if (typeof window === "undefined") return null;
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY;
  if (!siteKey) return null;
  if (!instance) {
    instance = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }
  return instance;
}

export async function getAppCheckHeaders(): Promise<Record<string, string>> {
  const appCheck = await getInstance();
  if (!appCheck) return {};
  const result = await getToken(appCheck, false);
  return { "X-Firebase-AppCheck": result.token };
}
