type VercelDomainVerification = {
  type?: string;
  domain?: string;
  value?: string;
  reason?: string;
};

type VercelDomainResponse = {
  name?: string;
  verified?: boolean;
  verification?: VercelDomainVerification[];
  error?: {
    code?: string;
    message?: string;
  };
};

function toVercelError(
  action: "add" | "verify" | "remove",
  status: number,
  payload: VercelDomainResponse | null,
  fallbackMessage: string,
): Error {
  const code = payload?.error?.code;
  const message = payload?.error?.message || fallbackMessage;

  if (code) {
    return new Error(
      `Vercel ${action} failed (${status}, ${code}): ${message}`,
    );
  }

  return new Error(`Vercel ${action} failed (${status}): ${message}`);
}

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function getVercelContext() {
  return {
    token: getEnv("VERCEL_API_TOKEN"),
    projectId: getEnv("VERCEL_PROJECT_ID"),
    teamId: getEnv("VERCEL_TEAM_ID"),
  };
}

async function parseJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function addProjectDomain(domain: string) {
  const { token, projectId, teamId } = getVercelContext();

  const response = await fetch(
    `https://api.vercel.com/v10/projects/${projectId}/domains?teamId=${teamId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: domain }),
    },
  );

  const payload = await parseJson<VercelDomainResponse>(response);

  if (!response.ok) {
    throw toVercelError(
      "add",
      response.status,
      payload,
      "Failed to add domain on Vercel",
    );
  }

  return {
    name: payload?.name || domain,
    verified: Boolean(payload?.verified),
    verification: payload?.verification || [],
  };
}

export async function verifyProjectDomain(domain: string) {
  const { token, projectId, teamId } = getVercelContext();

  const response = await fetch(
    `https://api.vercel.com/v9/projects/${projectId}/domains/${domain}/verify?teamId=${teamId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const payload = await parseJson<VercelDomainResponse>(response);

  if (!response.ok) {
    throw toVercelError(
      "verify",
      response.status,
      payload,
      "Failed to verify domain on Vercel",
    );
  }

  return {
    verified: Boolean(payload?.verified),
    verification: payload?.verification || [],
  };
}

export function isVercelDomainNotFoundOnRemove(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message;

  if (/\(404\b/.test(message) || /\(410\b/.test(message)) {
    return true;
  }

  return /,\s*not_found\)/i.test(message) || /domain_not_found/i.test(message);
}

export async function removeProjectDomain(domain: string) {
  const { token, projectId, teamId } = getVercelContext();

  const response = await fetch(
    `https://api.vercel.com/v9/projects/${projectId}/domains/${domain}?teamId=${teamId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    const payload = await parseJson<VercelDomainResponse>(response);
    throw toVercelError(
      "remove",
      response.status,
      payload,
      "Failed to remove domain from Vercel",
    );
  }
}
