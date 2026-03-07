import { Field, HideField, InputType, OmitType } from '@nestjs/graphql';

import { Type } from 'class-transformer';
import { IsBoolean, IsArray, IsObject, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import GraphQLJSON from 'graphql-type-json';
import { RelationCreationPayload } from 'twenty-shared/types';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';
import { FieldMetadataDTO } from 'src/engine/metadata-modules/field-metadata/dtos/field-metadata.dto';

@InputType()
export class CreateFieldInput extends OmitType(
  FieldMetadataDTO,
  [
    'id',
    'createdAt',
    'updatedAt',
    'standardOverrides',
    'applicationId',
    'morphId',
    'universalIdentifier',
  ] as const,
  InputType,
) {
  @IsUUID()
  @Field(() => UUIDScalarType)
  objectMetadataId: string;

  @IsString()
  @IsOptional()
  @HideField()
  universalIdentifier?: string;

  @IsString()
  @IsOptional()
  @HideField()
  applicationId?: string;

  @IsBoolean()
  @IsOptional()
  @Field(() => Boolean, { nullable: true })
  isRemoteCreation?: boolean;

  // TODO @prastoin implement validation for this with validate nested and dedicated class instance
  @IsObject()
  @IsOptional()
  @Field(() => GraphQLJSON, { nullable: true })
  relationCreationPayload?: RelationCreationPayload;

  @IsArray()
  @IsOptional()
  @Field(() => [GraphQLJSON], { nullable: true })
  morphRelationsCreationPayload?: RelationCreationPayload[];
}

@InputType()
export class CreateOneFieldMetadataInput {
  @Type(() => CreateFieldInput)
  @ValidateNested()
  @Field(() => CreateFieldInput, {
    description: 'The record to create',
  })
  field!: CreateFieldInput;
}
