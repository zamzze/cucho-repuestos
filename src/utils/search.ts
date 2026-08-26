export function normalizeSearchText(value?: string | null) {
  if (!value) return ''

  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function tokenizeSearch(value: string) {
  return normalizeSearchText(value)
    .split(' ')
    .filter(Boolean)
}

export function matchesSearch(
  query: string,
  fields: Array<string | undefined | null>,
) {
  const tokens = tokenizeSearch(query)

  if (tokens.length === 0) {
    return false
  }

  const searchableText = normalizeSearchText(
    fields.filter(Boolean).join(' '),
  )

  return tokens.every((token) =>
    searchableText.includes(token),
  )
}