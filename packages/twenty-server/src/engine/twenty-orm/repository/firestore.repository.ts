import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
import Ajv, { AnySchema, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

export class FirestoreRepository<T extends Record<string, any>> {
  protected readonly db: admin.firestore.Firestore;
  protected readonly collection: admin.firestore.CollectionReference;
  protected readonly ajv: Ajv;
  protected readonly validator: ValidateFunction;
  protected readonly partialValidator: ValidateFunction;

  constructor(
    protected readonly collectionName: string,
    protected readonly schema: AnySchema,
  ) {
    if (!admin.apps.length) {
      admin.initializeApp();
    }
    this.db = admin.firestore();
    this.collection = this.db.collection(this.collectionName);

    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv);

    this.validator = this.ajv.compile(this.schema);

    // Create a partial schema for update validation
    // Removing the 'required' field from the schema properties to allow partial updates
    const partialSchema = { ...this.schema } as any;
    if (partialSchema.required) {
      delete partialSchema.required;
    }
    if (partialSchema.$id) {
      partialSchema.$id = `${partialSchema.$id}-partial`;
    }
    this.partialValidator = this.ajv.compile(partialSchema);
  }

  async create(data: T): Promise<admin.firestore.DocumentReference> {
    const isValid = this.validator(data);
    if (!isValid) {
      throw new Error(`Validation failed: ${this.ajv.errorsText(this.validator.errors)}`);
    }

    return this.collection.add(data);
  }

  async update(id: string, data: Partial<T>): Promise<admin.firestore.WriteResult> {
    const isValid = this.partialValidator(data);
    if (!isValid) {
      throw new Error(`Partial validation failed: ${this.ajv.errorsText(this.partialValidator.errors)}`);
    }

    return this.collection.doc(id).update(data);
  }

  async findOne(id: string): Promise<T | null> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return doc.data() as T;
  }

  async find(query?: any): Promise<T[]> {
    // Basic implementation that fetches all documents.
    // In a real scenario, we would parse and apply the query filters.
    let qs: admin.firestore.Query = this.collection;

    // For now, if there is a query, we just ignore it as it's a basic implementation
    const snapshot = await qs.get();
    return snapshot.docs.map(doc => doc.data() as T);
  }

  async delete(id: string): Promise<admin.firestore.WriteResult> {
    return this.collection.doc(id).delete();
  }
}
