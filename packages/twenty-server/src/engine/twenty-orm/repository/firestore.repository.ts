import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
import Ajv, { AnySchema, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Base repository for Firestore-backed entities.
 *
 * Provides basic CRUD and querying functionalities mirroring the TypeORM Repository interface
 * while persisting data to Firestore instead of a relational database.
 *
 * **Limitations compared to standard TypeORM Repository:**
 * - Limited query parsing in `find()` (basic equality, some simple operators like moreThan, lessThan, in).
 * - Only basic support for `skip` and `take` based on Firestore's native pagination capabilities. No complex ordering logic out-of-the-box.
 * - Validation is done via `ajv` and extracted JSON schemas instead of class-validator decorators.
 * - Does not natively manage complex relation mappings out-of-the-box in the same way TypeORM does.
 */
export class BaseFirestoreRepository<T extends Record<string, any>> {
  protected readonly db: admin.firestore.Firestore;
  protected readonly collection: admin.firestore.CollectionReference;
  protected readonly ajv: Ajv;
  protected readonly validator: ValidateFunction;
  protected readonly partialValidator: ValidateFunction;
  protected schema: AnySchema;

  constructor(
    protected readonly collectionName: string,
    schemaOrName: AnySchema | string,
  ) {
    if (!admin.apps.length) {
      admin.initializeApp();
    }
    this.db = admin.firestore();
    this.collection = this.db.collection(this.collectionName);

    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv);

    // Load all schemas from the json-schemas directory dynamically
    const schemasPath = path.join(__dirname, '../../metadata-modules/json-schemas');
    if (fs.existsSync(schemasPath)) {
      const files = fs.readdirSync(schemasPath);
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const rawSchema = fs.readFileSync(path.join(schemasPath, file), 'utf8');
            const parsedSchema = JSON.parse(rawSchema);
            if (parsedSchema.$id) {
              // Ensure we don't add the same schema twice if ajv automatically handles some
              if (!this.ajv.getSchema(parsedSchema.$id)) {
                this.ajv.addSchema(parsedSchema);
              }
            } else {
               // Fallback if schema doesn't have an ID, use filename
               const id = file.replace('.json', '');
               parsedSchema.$id = id;
               if (!this.ajv.getSchema(id)) {
                 this.ajv.addSchema(parsedSchema);
               }
            }
          } catch (e) {
            console.error(`Error loading schema from ${file}:`, e);
          }
        }
      }
    }

    if (typeof schemaOrName === 'string') {
      const rawSchema = fs.readFileSync(path.join(schemasPath, `${schemaOrName}.json`), 'utf8');
      this.schema = JSON.parse(rawSchema);
    } else {
      this.schema = schemaOrName;
    }

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

  async findOne(idOrOptions: string | any): Promise<T | null> {
    if (typeof idOrOptions === 'string') {
      const doc = await this.collection.doc(idOrOptions).get();
      if (!doc.exists) {
        return null;
      }
      return doc.data() as T;
    } else {
      const docs = await this.find({ ...idOrOptions, take: 1 });
      return docs.length > 0 ? docs[0] : null;
    }
  }

  private applyOptionsToQuery(qs: admin.firestore.Query, options?: any): admin.firestore.Query {
    if (options) {
      if (options.where) {
        // Handle basic where clauses
        for (const [key, value] of Object.entries(options.where)) {
           // If it's a simple equality (including nulls)
           if (value !== undefined && (typeof value !== 'object' || value === null)) {
             qs = qs.where(key, '==', value);
           } else if (value && typeof value === 'object') {
             // Handle some basic TypeORM-like objects if they match basic shape
             if ('_type' in value) {
               const opType = (value as any)._type;
               const opValue = (value as any)._value;
               if (opType === 'moreThan') {
                 qs = qs.where(key, '>', opValue);
               } else if (opType === 'lessThan') {
                 qs = qs.where(key, '<', opValue);
               } else if (opType === 'in') {
                 qs = qs.where(key, 'in', opValue);
               }
             }
           }
        }
      }

      if (options.take) {
        qs = qs.limit(options.take);
      }

      if (options.skip) {
         qs = qs.offset(options.skip);
      }
    }
    return qs;
  }

  async find(options?: any): Promise<T[]> {
    let qs: admin.firestore.Query = this.collection;
    qs = this.applyOptionsToQuery(qs, options);

    const snapshot = await qs.get();
    return snapshot.docs.map(doc => doc.data() as T);
  }

  async delete(id: string): Promise<admin.firestore.WriteResult> {
    return this.collection.doc(id).delete();
  }

  async save(data: T | T[]): Promise<T | T[]> {
    if (Array.isArray(data)) {
      for (const item of data) {
        const isValid = this.validator(item);
        if (!isValid) {
          throw new Error(`Validation failed: ${this.ajv.errorsText(this.validator.errors)}`);
        }
      }

      const batch = this.db.batch();
      for (const item of data) {
        // If the item already has an ID field, use it as the document ID
        // Note: The TypeORM save uses `id` primarily.
        const docRef = item.id ? this.collection.doc(item.id) : this.collection.doc();
        if (!item.id) {
          item.id = docRef.id;
        }
        batch.set(docRef, item, { merge: true });
      }
      await batch.commit();
      return data;
    } else {
      const isValid = this.validator(data);
      if (!isValid) {
        throw new Error(`Validation failed: ${this.ajv.errorsText(this.validator.errors)}`);
      }
      const docRef = data.id ? this.collection.doc(data.id) : this.collection.doc();
      if (!data.id) {
        data.id = docRef.id;
      }
      await docRef.set(data, { merge: true });
      return data;
    }
  }

  async count(options?: any): Promise<number> {
    let qs: admin.firestore.Query = this.collection;
    qs = this.applyOptionsToQuery(qs, options);

    const snapshot = await qs.count().get();
    return snapshot.data().count;
  }

  async upsert(data: any, conflictPathsOrOptions: string[] | any): Promise<any> {
    // Basic upsert logic. TypeORM's Upsert requires data and options.
    const items = Array.isArray(data) ? data : [data];
    const batch = this.db.batch();

    for (const item of items) {
      if (!item.id) {
         throw new Error("Upsert requires an 'id' field in the data to be able to upsert in Firestore.");
      }
      const docRef = this.collection.doc(item.id);
      batch.set(docRef, item, { merge: true });
    }

    await batch.commit();

    return {
      raw: [],
      generatedMaps: [],
      identifiers: items.map(item => ({ id: item.id })),
    };
  }

  async insert(data: any | any[]): Promise<any> {
    const items = Array.isArray(data) ? data : [data];

    for (const item of items) {
      const isValid = this.validator(item);
      if (!isValid) {
        throw new Error(`Validation failed: ${this.ajv.errorsText(this.validator.errors)}`);
      }
    }

    const batch = this.db.batch();
    for (const item of items) {
      const docRef = item.id ? this.collection.doc(item.id) : this.collection.doc();
      if (!item.id) {
        item.id = docRef.id;
      }
      batch.set(docRef, item);
    }
    await batch.commit();

    return {
      raw: [],
      generatedMaps: [],
      identifiers: items.map(item => ({ id: item.id })),
    };
  }
}
