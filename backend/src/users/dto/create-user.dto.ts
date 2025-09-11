import { IsEmail, IsNotEmpty, IsString, IsIn } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  displayName: string;

  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  @IsIn(['HR', 'MKT', 'IT', 'SP', 'AF', 'CG'])
  department: string;

  @IsNotEmpty()
  @IsString()
  @IsIn(['STAFF', 'HD'])
  role: string;
}
