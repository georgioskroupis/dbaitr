import type { Role, Status } from './types';

export type RoutePolicy = {
  path: string; public?: boolean; minRole?: Role; allowedStatus?: Status[];
};

export const routePolicies: RoutePolicy[] = [
  { path: '/', public: true },
  { path: '/dashboard', minRole: 'viewer', allowedStatus: ['Grace','Verified'] },
  { path: '/topics/new', minRole: 'viewer', allowedStatus: ['Grace','Verified'] },
  { path: '/topics/', public: true }, // includes /topics/[topicId]
  { path: '/auth', public: true },
  { path: '/verify-identity', minRole: 'viewer', allowedStatus: ['Grace','Verified'] },
  { path: '/account-suspended', minRole: 'viewer', allowedStatus: ['Suspended'] },
  { path: '/admin', minRole: 'admin', allowedStatus: ['Verified'] },
  { path: '/admin/users', minRole: 'admin', allowedStatus: ['Verified'] },
  { path: '/admin/moderation', minRole: 'admin', allowedStatus: ['Verified'] },
  { path: '/admin/analysis', minRole: 'admin', allowedStatus: ['Verified'] },
  { path: '/admin/appeals', minRole: 'admin', allowedStatus: ['Verified'] },
  { path: '/live/new', minRole: 'supporter', allowedStatus: ['Verified'] },
  { path: '/live', public: true },
  { path: '/manifesto', public: true },
  { path: '/pricing', public: true },
  { path: '/transparency', public: true },
];

