export interface AuthFieldErrors {
  name?: string
  email?: string
  password?: string
}

export function validateLogin(email: string, password: string): AuthFieldErrors {
  const errors: AuthFieldErrors = {}
  if (!email.trim()) errors.email = 'Informe seu e-mail.'
  else if (!/^\S+@\S+\.\S+$/.test(email.trim())) errors.email = 'Informe um e-mail válido.'
  if (!password) errors.password = 'Informe sua senha.'
  return errors
}

export function validateRegistration(name: string, email: string, password: string): AuthFieldErrors {
  const errors = validateLogin(email, password)
  if (!name.trim()) errors.name = 'Informe seu nome.'
  if (password && password.length < 8) errors.password = 'Use pelo menos 8 caracteres.'
  return errors
}
