import { apiRequest } from '@/lib/api/client'
import { USE_SHELL_MOCKS } from './config'
import { normalizeDeleteResult, normalizeTeamDetail, normalizeTeams } from './normalizers'

const companyIdByTeamId = new Map()

function getTeamsPath(workspaceId) {
  if (!workspaceId) throw new Error('A workspace ID is required to load teams.')
  return `/v1/${encodeURIComponent(workspaceId)}/teams`
}

function rememberTeams(teams, workspaceId) {
  teams.forEach((team) => companyIdByTeamId.set(team.id, String(workspaceId)))
  return teams
}

export function getCompanyIdForTeam(teamId) {
  return companyIdByTeamId.get(String(teamId)) ?? null
}

export function getTeams(workspaceId) {
  const path = getTeamsPath(workspaceId)
  if (USE_SHELL_MOCKS) {
    return import('./__mocks__/teams.mock')
      .then((mock) => mock.mockWorkspaceTeams(workspaceId))
      .then((teams) => rememberTeams(teams, workspaceId))
  }
  return apiRequest(path)
    .then((response) => normalizeTeams(response, workspaceId))
    .then((teams) => rememberTeams(teams, workspaceId))
}

export function getTeam(workspaceId, teamId) {
  if (!teamId) throw new Error('A team ID is required to load a team.')
  const path = `${getTeamsPath(workspaceId)}/${encodeURIComponent(teamId)}`
  if (USE_SHELL_MOCKS) {
    return import('./__mocks__/teams.mock').then((mock) =>
      mock.mockWorkspaceTeams(workspaceId).then((teams) => {
        const team = teams.find((item) => String(item.id) === String(teamId))
        if (!team) throw new Error('The team could not be found.')
        return team
      }),
    )
  }
  return apiRequest(path)
    .then((response) => normalizeTeamDetail(response, workspaceId))
    .then((team) => {
      companyIdByTeamId.set(team.id, String(workspaceId))
      return team
    })
}

export function createTeam(payload) {
  const workspaceId = payload?.workspaceId
  const path = getTeamsPath(workspaceId)
  if (USE_SHELL_MOCKS) {
    return import('./__mocks__/teams.mock')
      .then((mock) => mock.mockCreateTeam(payload))
      .then((team) => {
        companyIdByTeamId.set(String(team.id), String(workspaceId))
        return team
      })
  }

  const body = { name: payload.name }
  if (payload.description !== undefined) body.description = payload.description
  return apiRequest(path, { method: 'POST', body: JSON.stringify(body) })
    .then((response) => normalizeTeamDetail(response, workspaceId))
    .then((team) => {
      companyIdByTeamId.set(team.id, String(workspaceId))
      return team
    })
}

export function joinTeam(inviteCode, workspaceId = null) {
  // TODO: Replace with the team-join endpoint when the backend contract is available.
  return import('./__mocks__/teams.mock').then((mock) =>
    mock.mockJoinTeam(inviteCode, USE_SHELL_MOCKS ? null : workspaceId),
  )
}

export function updateTeam(workspaceId, teamId, payload) {
  const path = `${getTeamsPath(workspaceId)}/${encodeURIComponent(teamId)}`
  if (USE_SHELL_MOCKS) {
    return import('./__mocks__/teams.mock').then((mock) =>
      mock.mockUpdateTeam(workspaceId, teamId, payload),
    )
  }

  const body = {}
  if (payload.name !== undefined) body.name = payload.name
  if (payload.description !== undefined) body.description = payload.description
  return apiRequest(path, { method: 'PUT', body: JSON.stringify(body) }).then((response) =>
    normalizeTeamDetail(response, workspaceId),
  )
}

export function deleteTeam(workspaceId, teamId) {
  const path = `${getTeamsPath(workspaceId)}/${encodeURIComponent(teamId)}`
  if (USE_SHELL_MOCKS) {
    return import('./__mocks__/teams.mock').then((mock) => mock.mockDeleteTeam(workspaceId, teamId))
  }
  return apiRequest(path, { method: 'DELETE' }).then(normalizeDeleteResult)
}
