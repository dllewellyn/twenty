import { Inject } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FIREBASE_ADMIN_APP } from '../../core-modules/firebase/firebase.constants';
import { MetadataService } from '../../metadata-modules/metadata.service';

/**
 * Base repository for Firestore-backed entities.
 *
 * Provides basic CRUD and querying functionalities mirroring the TypeORM Repository interface
 * while persisting data to Firestore instead of a relational database.
 *
 * **Limitations compared to standard TypeORM Repository:**
 * - Limited query parsing in `find()` (basic equality, some simple operators like moreThan, lessThan, in).
 * - Only basic support for `skip` and `take` based on Firestore's native pagination capabilities. No complex ordering logic out-of-the-box.
 * - Validation is done via `ajv` and dynamically fetched JSON schemas instead of class-validator decorators.
 * - Does not natively manage complex relation mappings out-of-the-box in the same way TypeORM does.
 */
export class BaseFirestoreRepository<T extends Record<string, any>> {
  protected readonly db: admin.firestore.Firestore;
  protected readonly collection: admin.firestore.CollectionReference;

  constructor(
    protected readonly collectionName: string,
    protected readonly metadataService: MetadataService,
    protected readonly workspaceId: string,
    @Inject(FIREBASE_ADMIN_APP) protected readonly firebaseApp?: admin.app.App,
  ) {
    this.db = this.firebaseApp
      ? this.firebaseApp.firestore()
      : admin.firestore();
    this.collection = this.db.collection(this.collectionName);
  }

  async create(data: T): Promise<admin.firestore.DocumentReference> {
    const { validator } = await this.metadataService.getValidator(this.collectionName, this.workspaceId);

    const isValid = validator(data);
    if (!isValid) {
      throw new Error(
        `Validation failed: ${JSON.stringify(validator.errors)}`,
      );
    }

    return this.collection.add(data);
  }

  async update(
    id: string,
    data: Partial<T>,
  ): Promise<admin.firestore.WriteResult> {
    const { partialValidator } = await this.metadataService.getValidator(this.collectionName, this.workspaceId);

    const isValid = partialValidator(data);
    if (!isValid) {
      throw new Error(
        `Partial validation failed: ${JSON.stringify(partialValidator.errors)}`,
      );
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

  private applyOptionsToQuery(
    qs: admin.firestore.Query,
    options?: any,
  ): admin.firestore.Query {
    if (options) {
      if (options.where) {
        // Handle basic where clauses
        for (const [key, value] of Object.entries(options.where)) {
          // If it's a simple equality (including nulls)
          if (
            value !== undefined &&
            (typeof value !== 'object' || value === null)
          ) {
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
    return snapshot.docs.map((doc) => doc.data() as T);
  }

  async delete(id: string): Promise<admin.firestore.WriteResult> {
    return this.collection.doc(id).delete();
  }

  async save(data: T | T[]): Promise<T | T[]> {
    const { validator } = await this.metadataService.getValidator(this.collectionName, this.workspaceId);

    if (Array.isArray(data)) {
      for (const item of data) {
        const isValid = validator(item);
        if (!isValid) {
          throw new Error(
            `Validation failed: ${JSON.stringify(validator.errors)}`,
          );
        }
      }

      const batch = this.db.batch();
      for (const item of data) {
        // If the item already has an ID field, use it as the document ID
        // Note: The TypeORM save uses `id` primarily.
        const docRef = item.id
          ? this.collection.doc(item.id)
          : this.collection.doc();
        if (!item.id) {
          item.id = docRef.id;
        }
        batch.set(docRef, item, { merge: true });
      }
      await batch.commit();
      return data;
    } else {
      const isValid = validator(data);
      if (!isValid) {
        throw new Error(
          `Validation failed: ${JSON.stringify(validator.errors)}`,
        );
      }
      const docRef = data.id
        ? this.collection.doc(data.id)
        : this.collection.doc();
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

  async upsert(
    data: any,
    _conflictPathsOrOptions: string[] | any,
  ): Promise<any> {
    // Basic upsert logic. TypeORM's Upsert requires data and options.
    const items = Array.isArray(data) ? data : [data];
    const batch = this.db.batch();

    for (const item of items) {
      if (!item.id) {
        throw new Error(
          "Upsert requires an 'id' field in the data to be able to upsert in Firestore.",
        );
      }
      const docRef = this.collection.doc(item.id);
      batch.set(docRef, item, { merge: true });
    }

    await batch.commit();

    return {
      raw: [],
      generatedMaps: [],
      identifiers: items.map((item) => ({ id: item.id })),
    };
  }

  async insert(data: any | any[]): Promise<any> {
    const { validator } = await this.metadataService.getValidator(this.collectionName, this.workspaceId);

    const items = Array.isArray(data) ? data : [data];

    for (const item of items) {
      const isValid = validator(item);
      if (!isValid) {
        throw new Error(
          `Validation failed: ${JSON.stringify(validator.errors)}`,
        );
      }
    }

    const batch = this.db.batch();
    for (const item of items) {
      const docRef = item.id
        ? this.collection.doc(item.id)
        : this.collection.doc();
      if (!item.id) {
        item.id = docRef.id;
      }
      batch.set(docRef, item);
    }
    await batch.commit();

    return {
      raw: [],
      generatedMaps: [],
      identifiers: items.map((item) => ({ id: item.id })),
    };
  }
}
