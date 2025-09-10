export class UserRoleDto {
  id: string;
  email: string;
  displayName: string;
  roles: { role: string; department: string }[];
}
