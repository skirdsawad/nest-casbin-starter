import { IsInt, IsObject, IsOptional } from 'class-validator';

export class CreateRequestDto {
  @IsInt()
  departmentId: number;

  @IsObject()
  @IsOptional()
  payload?: Record<string, any>;
}