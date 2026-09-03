export type Role = 'Administrator' | 'Editor' | 'Contributor';

export interface CmsUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface CmsSession {
  user: CmsUser;
  issuedAt: number;
  expiresAt: number;
}

export type CmsPermission =
  | 'content.create'
  | 'content.edit'
  | 'content.review'
  | 'content.publish'
  | 'content.delete'
  | 'media.manage'
  | 'collaboration.manage'
  | 'users.manage';

export const ROLE_PERMISSIONS: Record<Role, CmsPermission[]> = {
  Administrator: [
    'content.create', 'content.edit', 'content.review', 'content.publish', 'content.delete',
    'media.manage', 'collaboration.manage', 'users.manage'
  ],
  Editor: [
    'content.create', 'content.edit', 'content.review', 'content.publish', 'content.delete',
    'media.manage', 'collaboration.manage'
  ],
  Contributor: [
    'content.create', 'content.edit', 'collaboration.manage'
  ]
};

export const AUTH_EVENTS = {
  login: 'cms:auth:login',
  logout: 'cms:auth:logout',
  expired: 'cms:auth:expired',
  unauthorized: 'cms:auth:unauthorized'
} as const;

export function can(role: Role, permission: CmsPermission): boolean {
  return ROLE_PERMISSIONS[role].indexOf(permission) !== -1;
}

export function publishAuthEvent(type: string, session: CmsSession | null, reason?: string): void {
  window.dispatchEvent(new CustomEvent(type, {
    detail: {
      authenticated: Boolean(session),
      user: session ? session.user : null,
      expiresAt: session ? session.expiresAt : null,
      reason: reason || null
    }
  }));
}
