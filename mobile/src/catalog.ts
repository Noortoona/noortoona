import { templateCatalog, templatesFor, type OccasionKey, type ActivityKey } from "./templateCatalog";

import {defaultPackages,type PricingPackage} from '../../shared/pricing-policy.mjs';
export type CatalogPackage = PricingPackage & {referenceAmountSar?:number;promoLicenseId?:string;savingsPercent?:number};
export type CatalogService = { id: string; name: string; description: string; enabled: boolean };
export type PublicCatalog = { version?:number;packages: CatalogPackage[]; hiddenTemplateKeys: string[]; services: CatalogService[];entry?:{unitAmount:number;standardHours:number|null;enabled:boolean};tax?:{status:string};business?:Array<{code:string;name:string;nameEn:string;startingAmount:number;features:string[];featuresEn:string[]}> };
export const DEFAULT_PACKAGES: CatalogPackage[] = defaultPackages();

export function publicCatalog(value: unknown): PublicCatalog | null {
  if (!value || typeof value !== "object") return null;
  const data = value as { version?: unknown; packages?: unknown; hiddenTemplateKeys?: unknown; services?: unknown };
  if (![1,2].includes(Number(data.version)) || !Array.isArray(data.packages) || !Array.isArray(data.hiddenTemplateKeys) || !Array.isArray(data.services)) return null;
  const packages = data.packages as CatalogPackage[];
  const codes = DEFAULT_PACKAGES.map(pkg => pkg.code);
  if(!packages.length||packages.length>3||packages.some(p=>!p||!codes.includes(p.code))||new Set(packages.map(p=>p.code)).size!==packages.length)return null;
  if (packages.some((pkg: CatalogPackage) => !pkg || typeof pkg.name !== "string" || pkg.currency !== "SAR" || !Number.isInteger(pkg.amount) || pkg.amount < 100 || pkg.amount > 10_000_000 || !Number.isInteger(pkg.guestLimit) || pkg.guestLimit < 1 || pkg.guestLimit > 5000)) return null;
  const keys = new Set(Object.entries(templateCatalog).flatMap(([group, items]) => items.map(item => `${group}:${item.name}`)));
  if (data.hiddenTemplateKeys.some(key => typeof key !== "string" || !keys.has(key))) return null;
  const hidden = data.hiddenTemplateKeys as string[];
  if (Object.entries(templateCatalog).some(([group, items]) => items.every(item => hidden.includes(`${group}:${item.name}`)))) return null;
  return {
    ...value as PublicCatalog,
    packages: packages.map((pkg: CatalogPackage) => ({ ...pkg, amountSar: pkg.amount / 100 })),
    hiddenTemplateKeys: [...new Set(data.hiddenTemplateKeys as string[])],
    services: data.services.filter((service: CatalogService) => service?.enabled !== false && typeof service.name === "string" && typeof service.description === "string").map((service: CatalogService) => ({ id: String(service.id), name: service.name, description: service.description, enabled: true })),
  };
}

export function availableTemplatesFor(occasion: OccasionKey, activity: ActivityKey, hidden: string[] = []) {
  const group = occasion === "activity" ? activity : occasion;
  const blocked = new Set(hidden);
  return templatesFor(occasion, activity).filter(template => !blocked.has(`${group}:${template.name}`));
}
