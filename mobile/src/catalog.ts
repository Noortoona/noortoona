import { templateCatalog, templatesFor, type OccasionKey, type ActivityKey } from "./templateCatalog";

export type CatalogPackage = { code: string; name: string; amount: number; amountSar: number; guestLimit: number; currency: string };
export type CatalogService = { id: string; name: string; description: string; enabled: boolean };
export type PublicCatalog = { packages: CatalogPackage[]; hiddenTemplateKeys: string[]; services: CatalogService[] };
export const DEFAULT_PACKAGES: CatalogPackage[] = [
  { code: "hala_basic", name: "هلا الأساسية", amount: 14900, amountSar: 149, guestLimit: 100, currency: "SAR" },
  { code: "hala_plus", name: "هلا بلس", amount: 34900, amountSar: 349, guestLimit: 250, currency: "SAR" },
  { code: "hala_premium", name: "هلا بريميوم", amount: 69900, amountSar: 699, guestLimit: 500, currency: "SAR" },
];

export function publicCatalog(value: unknown): PublicCatalog | null {
  if (!value || typeof value !== "object") return null;
  const data = value as { version?: unknown; packages?: unknown; hiddenTemplateKeys?: unknown; services?: unknown };
  if (data.version !== 1 || !Array.isArray(data.packages) || !Array.isArray(data.hiddenTemplateKeys) || !Array.isArray(data.services)) return null;
  const packages = data.packages as CatalogPackage[];
  const codes = DEFAULT_PACKAGES.map(pkg => pkg.code);
  if (packages.length !== 3 || !codes.every(code => packages.filter((pkg: CatalogPackage) => pkg?.code === code).length === 1)) return null;
  if (packages.some((pkg: CatalogPackage) => !pkg || typeof pkg.name !== "string" || pkg.currency !== "SAR" || !Number.isInteger(pkg.amount) || pkg.amount < 100 || pkg.amount > 10_000_000 || !Number.isInteger(pkg.guestLimit) || pkg.guestLimit < 1 || pkg.guestLimit > 5000)) return null;
  const keys = new Set(Object.entries(templateCatalog).flatMap(([group, items]) => items.map(item => `${group}:${item.name}`)));
  if (data.hiddenTemplateKeys.some(key => typeof key !== "string" || !keys.has(key))) return null;
  const hidden = data.hiddenTemplateKeys as string[];
  if (Object.entries(templateCatalog).some(([group, items]) => items.every(item => hidden.includes(`${group}:${item.name}`)))) return null;
  return {
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
