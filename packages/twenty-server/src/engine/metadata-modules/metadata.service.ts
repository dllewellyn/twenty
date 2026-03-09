import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import Ajv, { AnySchema, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { FIREBASE_ADMIN_APP } from '../core-modules/firebase/firebase.constants';

export interface MetadataValidator {
  validator: ValidateFunction;
  partialValidator: ValidateFunction;
}

@Injectable()
export class MetadataService implements OnModuleInit, OnModuleDestroy {
  private readonly db: admin.firestore.Firestore;
  private unsubscribe: (() => void) | null = null;
  private ajv: Ajv;

  // Cache structure: workspaceId -> objectName -> MetadataValidator
  private validatorsCache: Map<string, Map<string, MetadataValidator>> = new Map();

  constructor(
    @Inject(FIREBASE_ADMIN_APP) private readonly firebaseApp?: admin.app.App,
  ) {
    this.db = this.firebaseApp
      ? this.firebaseApp.firestore()
      : admin.firestore();

    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv);
  }

  async onModuleInit() {
    this.initListeners();
  }

  onModuleDestroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  private initListeners() {
    const collection = this.db.collection('_metadata');

    this.unsubscribe = collection.onSnapshot(
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const doc = change.doc;
          const data = doc.data();
          const workspaceId = data.workspaceId;
          // Use namePlural as the default collection/object name, fallback to nameSingular
          const objectName = data.namePlural || data.nameSingular;

          if (change.type === 'added' || change.type === 'modified') {
            this.updateCache(workspaceId, objectName, data.jsonSchema);
          } else if (change.type === 'removed') {
            this.removeFromCache(workspaceId, objectName);
          }
        });
      },
      (error) => {
        console.error('Error listening to _metadata changes', error);
      },
    );
  }

  public updateCache(workspaceId: string, objectName: string, jsonSchema: AnySchema) {
    if (!workspaceId || !objectName || !jsonSchema) return;

    let workspaceCache = this.validatorsCache.get(workspaceId);
    if (!workspaceCache) {
      workspaceCache = new Map();
      this.validatorsCache.set(workspaceId, workspaceCache);
    }

    try {
      const schemaObj = jsonSchema as any;
      if (schemaObj.$id && this.ajv.getSchema(schemaObj.$id)) {
        this.ajv.removeSchema(schemaObj.$id);
      }
      const validator = this.ajv.compile(jsonSchema);

      const partialSchema = { ...jsonSchema } as Record<string, unknown> & {
        required?: string[];
      };
      if (partialSchema.required) {
        delete partialSchema.required;
      }
      if (partialSchema.$id) {
        partialSchema.$id = `${partialSchema.$id}-partial`;
        if (this.ajv.getSchema(partialSchema.$id)) {
          this.ajv.removeSchema(partialSchema.$id);
        }
      }
      const partialValidator = this.ajv.compile(partialSchema);

      workspaceCache.set(objectName, {
        validator,
        partialValidator,
      });
    } catch (e) {
      console.error(`Error compiling schema for ${objectName} in workspace ${workspaceId}:`, e);
    }
  }

  private removeFromCache(workspaceId: string, objectName: string) {
    const workspaceCache = this.validatorsCache.get(workspaceId);
    if (workspaceCache) {
      workspaceCache.delete(objectName);
    }
  }

  public async getValidator(objectName: string, workspaceId: string): Promise<MetadataValidator> {
    // Check workspace specific cache
    const workspaceCache = this.validatorsCache.get(workspaceId);
    if (workspaceCache && workspaceCache.has(objectName)) {
      return workspaceCache.get(objectName)!;
    }

    // Check system cache
    const systemCache = this.validatorsCache.get('system');
    if (systemCache && systemCache.has(objectName)) {
      return systemCache.get(objectName)!;
    }

    // If not in cache, fetch it from Firestore directly
    let querySnapshot;
    try {
      querySnapshot = await this.db.collection('_metadata')
        .where('workspaceId', 'in', [workspaceId, 'system'])
        .get();
    } catch (e) {
      console.error('Error fetching metadata schemas from Firestore:', e);
      throw new Error(`Validator not found for object ${objectName} in workspace ${workspaceId}`);
    }

    // Populate cache for missing
    for (const doc of querySnapshot.docs) {
      const data = doc.data();
      const wsId = data.workspaceId;
      const key = data.namePlural || data.nameSingular;
      if (wsId && key && data.jsonSchema) {
        this.updateCache(wsId, key, data.jsonSchema);
      }
    }

    // Re-check caches
    const updatedWorkspaceCache = this.validatorsCache.get(workspaceId);
    if (updatedWorkspaceCache && updatedWorkspaceCache.has(objectName)) {
      return updatedWorkspaceCache.get(objectName)!;
    }

    const updatedSystemCache = this.validatorsCache.get('system');
    if (updatedSystemCache && updatedSystemCache.has(objectName)) {
      return updatedSystemCache.get(objectName)!;
    }

    throw new Error(`Validator not found for object ${objectName} in workspace ${workspaceId}`);
  }
}
