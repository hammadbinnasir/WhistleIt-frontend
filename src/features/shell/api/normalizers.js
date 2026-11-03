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
  if (!record || record.id == null || !String(record.name ?? '').trim()) {
    throw new Error('A team is missing its ID or name.')
  }

  const name = String(record.name).trim()
  const teamWorkspaceId = workspaceId ?? record.company_id
  if (teamWorkspaceId == null) {
    throw new Error('A team is missing its workspace ID.')
  }

  return {
    id: String(record.id),
    workspaceId: String(teamWorkspaceId),
    name,
    initials: getInitials(name),
    description: record.description == null ? '' : String(record.description),
    memberCount: Array.isArray(record.user_ids) ? record.user_ids.length : 0,
  }
}

export function normalizeTeams(response, workspaceId) {
  const records = unwrapResponse(response)?.teams
  if (!Array.isArray(records)) {
    throw new Error('The teams response is missing data.teams.')
  }
  return records.map((record) => normalizeTeam(record, workspaceId))
}

export function normalizeTeamDetail(response, workspaceId) {
  const record = unwrapResponse(response)?.team
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
    return {
      id: String(record.id),
      name: 'Member',
      email: '',
      role: String(record.role ?? 'member'),
      status: 'offline',
      avatar: null,
    }
  })
}

export function normalizeDeleteResult(response) {
  unwrapResponse(response)
  return { success: true }
}
