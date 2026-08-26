const API_URL =
  'http://localhost:3001/api'

export interface ApiPart {
  id: number
  legacy_id: string | null
  sap_code: string | null
  oem_code: string | null
  name: string
  notes: string | null
  status: string
  verification_status:
    | 'pending'
    | 'review'
    | 'verified'
}

export interface ApiPartStats {
  total: number
  pending: number
  review: number
  verified: number
}

export interface ApiFamily {
  id: number
  code: string
  name: string
  status: string
  notes: string | null
  model_count?: number
}

export interface ApiModel {
  id: number
  family_id: number
  family_code: string
  family_name: string
  brand: string
  name: string
  variant: string | null
  status: string
}

export interface ApiCompatibility {
  id: number
  part_id: number
  model_id: number
  notes: string | null
  verified_at: string | null

  brand: string
  model_name: string
  variant: string | null

  family_id: number
  family_code: string
  family_name: string
}

export interface ApiSuggestion {
  id: number
  part_id: number
  family_id: number
  model_id: number | null
  source: string | null
  confidence:
    | 'high'
    | 'medium'
    | 'low'
    | null

  family_code: string
  family_name: string

  brand: string | null
  model_name: string | null
  variant: string | null
}


/* =========================================================
   Helper
   ========================================================= */

async function apiRequest<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(
    `${API_URL}${url}`,
    {
      ...options,

      headers: {
        'Content-Type':
          'application/json',

        ...options?.headers,
      },
    },
  )

  const body =
    await response.json()

  if (!response.ok) {
    throw new Error(
      body.error ??
        `Error HTTP ${response.status}`,
    )
  }

  return body
}


/* =========================================================
   Parts
   ========================================================= */

export function getParts(
  options?: {
    q?: string
    verification?: string
  },
) {
  const params =
    new URLSearchParams()

  if (options?.q) {
    params.set(
      'q',
      options.q,
    )
  }

  if (options?.verification) {
    params.set(
      'verification',
      options.verification,
    )
  }

  const query =
    params.toString()

  return apiRequest<ApiPart[]>(
    `/parts${
      query ? `?${query}` : ''
    }`,
  )
}

export function getPart(
  id: number,
) {
  return apiRequest<ApiPart>(
    `/parts/${id}`,
  )
}

export function getPartStats() {
  return apiRequest<ApiPartStats>(
    '/parts/stats',
  )
}

export function getPartCompatibilities(
  partId: number,
) {
  return apiRequest<
    ApiCompatibility[]
  >(
    `/parts/${partId}/compatibilities`,
  )
}

export function getPartSuggestions(
  partId: number,
) {
  return apiRequest<ApiSuggestion[]>(
    `/parts/${partId}/suggestions`,
  )
}

export function addCompatibility(
  partId: number,
  modelId: number,
) {
  return apiRequest<ApiCompatibility>(
    `/parts/${partId}/compatibilities`,
    {
      method: 'POST',

      body: JSON.stringify({
        modelId,
      }),
    },
  )
}

export function deleteCompatibility(
  partId: number,
  modelId: number,
) {
  return apiRequest<{
    ok: boolean
  }>(
    `/parts/${partId}/compatibilities/${modelId}`,
    {
      method: 'DELETE',
    },
  )
}

export function updatePartVerification(
  partId: number,
  status:
    | 'pending'
    | 'review'
    | 'verified',
) {
  return apiRequest<ApiPart>(
    `/parts/${partId}/verification`,
    {
      method: 'PATCH',

      body: JSON.stringify({
        status,
      }),
    },
  )
}


/* =========================================================
   Families
   ========================================================= */

export function getFamilies() {
  return apiRequest<ApiFamily[]>(
    '/families',
  )
}

export function createFamily(
  code: string,
  name: string,
) {
  return apiRequest<ApiFamily>(
    '/families',
    {
      method: 'POST',

      body: JSON.stringify({
        code,
        name,
      }),
    },
  )
}


/* =========================================================
   Models
   ========================================================= */

export function getModels(
  familyId?: number,
) {
  if (familyId) {
    return apiRequest<ApiModel[]>(
      `/models?familyId=${familyId}`,
    )
  }

  return apiRequest<ApiModel[]>(
    '/models',
  )
}

export function createModel(
  data: {
    familyId: number
    brand: string
    name: string
    variant?: string
  },
) {
  return apiRequest<ApiModel>(
    '/models',
    {
      method: 'POST',

      body:
        JSON.stringify(data),
    },
  )
}