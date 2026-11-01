const BASE_URL = (process.env.EXPO_PUBLIC_API_URL || "https://halainvites.com").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set("accept", "application/json");
  if (options.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (options.signal?.aborted) cancel();
  options.signal?.addEventListener("abort", cancel);
  const timeout = setTimeout(cancel, 20_000);
  try {
    const response = await fetch(`${BASE_URL}${path}`, { ...options, headers, signal: controller.signal });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(data?.error || "تعذر الاتصال بخدمة هلا", response.status);
    if (!data || typeof data !== "object") throw new ApiError("استجابة الخدمة غير صالحة. تحقق من عنوان خادم هلا.", 502);
    return data as T;
  } catch (error) {
    if (controller.signal.aborted) throw new ApiError("انتهت مهلة الاتصال. حاول مرة أخرى.", 408);
    throw error;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", cancel);
  }
}

export { BASE_URL };
