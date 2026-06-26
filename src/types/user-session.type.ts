export interface UserSession {
  authenticated: boolean;
  email?: string;
  name?: string;
  token?: string;
}
