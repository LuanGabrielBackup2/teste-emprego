export interface MarketplaceUser {
  id: string
  name: string
  email: string
}

export interface MarketplaceSession {
  token: string
  expiresAt: string
  user: MarketplaceUser
}

export interface LoginInput { email: string; password: string }
export interface RegisterInput { name: string; email: string; password: string }
export interface AuthResponse { session: MarketplaceSession }

export interface AuthErrorResponse { error: { code: string; message: string } }
