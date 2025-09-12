import { IsNotEmpty, IsString, IsUppercase, Length, Matches } from 'class-validator';

export class CreateDepartmentDto {
  @IsNotEmpty()
  @IsString()
  @IsUppercase()
  @Length(2, 5)
  @Matches(/^[A-Z]+$/, { message: 'Code must contain only uppercase letters' })
  code: string;

  @IsNotEmpty()
  @IsString()
  @Length(3, 50)
  name: string;
}