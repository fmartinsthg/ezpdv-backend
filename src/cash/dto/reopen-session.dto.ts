import { IsString } from 'class-validator';

export class ReopenSessionDto {
  @IsString()
  reason!: string;
}
