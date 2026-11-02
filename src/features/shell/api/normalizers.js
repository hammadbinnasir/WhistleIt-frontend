function unwrapResponse(response) {
  if (response?.success === false) {
    throw new Error(response.message || 'The server rejected the request.')
  }
  if (!response || !Object.prototype.hasOwnProperty.call(response, 'data')) {
    throw new Error('The server response is missing data.')
  }
  return response.data
}

function getInitials(name) {
  return String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')
}

export function normalizeWorkspaces(response) {
  const companies = unwrapResponse(response)?.user?.companies
  if (!Array.isArray(companies)) {
    throw new Error('The workspaces response is missing data.user.companies.')
  }

  return companies.map((company) => {
    const name = String(company?.name ?? '').trim()
    if (company?.id == null || !name) {
      throw new Error('A workspace is missing its ID or name.')
    }

    return {
      id: String(company.id),
      name,
      initials:
        String(company.code ?? '')
          .trim()
          .toUpperCase() || name.slice(0, 2).toUpperCase(),
    }
  })
}

export function normalizeTeam(record, workspaceId) {
  const id = record?.id ?? record?.team_id
  const name = record?.name ?? record?.team_name
  if (!record || id == null || !String(name ?? '').trim()) {
    throw new Error('A team is missing its ID or name.')
  }

  const normalizedName = String(name).trim()
  const teamWorkspaceId = workspaceId ?? record.company_id ?? record.workspace_id
  if (teamWorkspaceId == null) {
    throw new Error('A team is missing its workspace ID.')
  }

  return {
    id: String(id),
    workspaceId: String(teamWorkspaceId),
    name: normalizedName,
    initials: getInitials(normalizedName),
    description: record.description == null ? '' : String(record.description),
    memberCount: Array.isArray(record.user_ids) ? record.user_ids.length : 0,
  }
}

export function normalizeTeams(response, workspaceId) {
  const payload = unwrapResponse(response)
  const records = Array.isArray(payload) ? payload : (payload?.teams ?? payload?.items)
  if (!Array.isArray(records)) {
    throw new Error('The teams response is missing data.teams.')
  }
  return records.map((record) => normalizeTeam(record, workspaceId))
}

export function normalizeTeamDetail(response, workspaceId) {
  const payload = unwrapResponse(response)
  const record = payload?.team ?? payload
  if (!record) throw new Error('The team response is missing data.team.')
  return normalizeTeam(record, workspaceId)
}

export function normalizeMembers(response) {
  const records = unwrapResponse(response)?.members
  if (!Array.isArray(records)) {
    throw new Error('The members response is missing data.members.')
  }

  return records.map((record) => {
    if (record?.id == null) throw new Error('A member record is missing its ID.')
    const user = record.user && typeof record.user === 'object' ? record.user : {}
    const normalized = {
      userId: String(user.id ?? record.user_id ?? record.joined_by ?? record.id),
      membershipId: String(record.id),
      role: String(record.role ?? 'member'),
      joinedDate: record.joined_date == null ? null : String(record.joined_date),
      status: 'offline',
    }

    const name = record.name ?? user.name ?? user.full_name ?? user.display_name
    const email = record.email ?? user.email
    const avatar = record.avatar ?? record.avatar_url ?? user.avatar ?? user.avatar_url
    if (typeof name === 'string' && name.trim()) normalized.name = name.trim()
    if (typeof email === 'string' && email.trim()) normalized.email = email.trim()
    if (typeof avatar === 'string' && avatar.trim()) normalized.avatar = avatar.trim()

    return normalized
  })
}

export function normalizeDeleteResult(response) {
  unwrapResponse(response)
  return {
    success: true,
    ...(typeof response.message === 'string' ? { message: response.message } : {}),
  }
}
