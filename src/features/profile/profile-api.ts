
import type { MarketplaceUser } from '@/contracts/account'
import { apiClient } from '@/lib/api/client'

export interface UpdateProfileInput {
  name: string
  email: string
}

export interface ChangePasswordInput {
  currentPassword: string
  newPassword: string
}

interface ProfileResponse {
  user: MarketplaceUser
}

export async function fetchProfile(): Promise<MarketplaceUser> {
  const response = await apiClient.get<ProfileResponse>('/api/profile')
  return response.data.user
}

export async function updateProfile(
  input: UpdateProfileInput,
): Promise<MarketplaceUser> {
  const response = await apiClient.put<ProfileResponse>(
    '/api/profile',
    input,
  )

  return response.data.user
}

export async function changePassword(
  input: ChangePasswordInput,
): Promise<void> {
  await apiClient.put('/api/profile/password', input)
}
