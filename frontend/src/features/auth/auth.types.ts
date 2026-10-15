export type Role = 'admin' | 'pelapor' | 'approver';

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export const roleLabels: Record<Role, string> = {
  admin: 'Admin',
  pelapor: 'Reporter',
  approver: 'Approver',
};

export const roleHomePaths: Record<Role, string> = {
  admin: '/workspace/admin',
  pelapor: '/workspace/reporter',
  approver: '/workspace/approver',
};
