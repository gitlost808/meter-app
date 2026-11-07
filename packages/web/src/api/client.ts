import { oidcAuthService } from '@/auth/oidcAuthService';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type QueryValue = string | number | boolean | Date | null | undefined;

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  query?: Record<string, QueryValue>;
};

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = new URL(path, window.location.origin);

  if (!query) {
    return url.toString();
  }

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) {
      continue;
    }

    url.searchParams.set(
      key,
      value instanceof Date ? value.toISOString() : String(value),
    );
  }

  return url.toString();
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }

  const text = await response.text();
  if (!text) {
    return undefined;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return JSON.parse(text) as unknown;
  }

  return text;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, headers, query, ...requestOptions } = options;
  const requestHeaders = new Headers(headers);
  const accessToken = await oidcAuthService.getAccessToken();
  if (accessToken) {
    requestHeaders.set('Authorization', `Bearer ${accessToken}`);
  }

  let requestBody: BodyInit | undefined;
  if (body !== undefined) {
    requestHeaders.set('Content-Type', 'application/json');
    requestBody = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      ...requestOptions,
      headers: requestHeaders,
      body: requestBody,
    });
  } catch (error) {
    // fetch() only rejects when the server can't be reached; status 0 marks that case.
    throw new ApiError(`Request failed: ${path}`, 0, path, error);
  }

  const parsedBody = await parseResponseBody(response);

  if (!response.ok) {
    throw new ApiError(
      `Request failed ${response.status}: ${path}`,
      response.status,
      path,
      parsedBody,
    );
  }

  return parsedBody as T;
}
