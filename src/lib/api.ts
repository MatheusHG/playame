const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  private getPlayerToken(): string | null {
    const session = localStorage.getItem('player_session');
    if (session) {
      try {
        const parsed = JSON.parse(session);
        return parsed.token;
      } catch {
        return null;
      }
    }
    return null;
  }

  private async request<T>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      params?: Record<string, string>;
      usePlayerAuth?: boolean;
      rawResponse?: boolean;
    }
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (options?.params) {
      Object.entries(options.params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          url.searchParams.set(k, v);
        }
      });
    }

    const token = options?.usePlayerAuth ? this.getPlayerToken() : this.getToken();

    const res = await fetch(url.toString(), {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: res.statusText }));
      const error = new Error(errorData.error || errorData.message || 'Request failed');
      (error as any).status = res.status;
      (error as any).details = errorData.details;
      throw error;
    }

    if (options?.rawResponse) {
      return res as unknown as T;
    }

    const text = await res.text();
    if (!text) return {} as T;
    return JSON.parse(text);
  }

  get<T>(path: string, params?: Record<string, string>) {
    return this.request<T>('GET', path, { params });
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>('POST', path, { body });
  }

  patch<T>(path: string, body?: unknown) {
    return this.request<T>('PATCH', path, { body });
  }

  put<T>(path: string, body?: unknown) {
    return this.request<T>('PUT', path, { body });
  }

  delete<T>(path: string) {
    return this.request<T>('DELETE', path);
  }

  // Player-auth specific methods
  playerPost<T>(path: string, body?: unknown) {
    return this.request<T>('POST', path, { body, usePlayerAuth: true });
  }

  playerGet<T>(path: string, params?: Record<string, string>) {
    return this.request<T>('GET', path, { params, usePlayerAuth: true });
  }

  // TODO: descomentar quando S3 estiver configurado
  // async upload(file: File, companyId: string, folder: string): Promise<{ url: string }> {
  //   const formData = new FormData();
  //   formData.append('file', file);
  //   formData.append('companyId', companyId);
  //   formData.append('folder', folder);
  //   const token = this.getToken();
  //   const res = await fetch(`${this.baseUrl}/upload`, {
  //     method: 'POST',
  //     headers: {
  //       ...(token ? { Authorization: `Bearer ${token}` } : {}),
  //     },
  //     body: formData,
  //   });
  //   if (!res.ok) {
  //     const errorData = await res.json().catch(() => ({ error: 'Upload failed' }));
  //     throw new Error(errorData.error || 'Upload failed');
  //   }
  //   return res.json();
  // }
}

export const api = new ApiClient(API_BASE);
