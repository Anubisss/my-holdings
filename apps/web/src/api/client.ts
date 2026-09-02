export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const parseError = async (response: Response): Promise<string> => {
  try {
    const data = (await response.json()) as { message?: string };
    return data.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
};

export const apiFetch = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const headers = new Headers(init?.headers);
  if (init?.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`/api${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    throw new ApiError(response.status, await parseError(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
};

export const apiFetchBlob = async (path: string): Promise<{ blob: Blob; filename: string }> => {
  const response = await fetch(`/api${path}`);
  if (!response.ok) {
    const msg = await parseError(response);
    throw new ApiError(response.status, msg);
  }
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] ?? 'download.csv';
  const blob = await response.blob();
  return { blob, filename };
};

export type UploadResult = { imported: number } | { error: string; errors: string[] };

export const apiUploadCsv = async (path: string, file: File): Promise<UploadResult> => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`/api${path}`, { method: 'POST', body: formData });

  let data: Record<string, unknown>;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    throw new ApiError(response.status, response.statusText);
  }

  if (!response.ok) {
    if (Array.isArray(data.errors)) return data as unknown as UploadResult;
    throw new ApiError(response.status, (data.message as string) ?? response.statusText);
  }
  return data as unknown as UploadResult;
};
