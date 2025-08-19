import * as Y from 'yjs';
import { MongoClient, Db, Collection, ObjectId } from "mongodb";
import { IWSSharedDoc } from './websocket/interfaces.js';

interface DocumentState {
  _id: ObjectId; // Document name as _id (string, not ObjectId)
  stateVector: Buffer | any; // Allow any type to handle MongoDB Binary
  updatedAt: Date;
}

export class CustomMongoPersistence {
  private client: MongoClient;
  private db: Db;
  private collection: Collection<DocumentState>;
  private isConnected = false;

  constructor(mongoUrl: string, collectionName: string) {
    this.client = new MongoClient(mongoUrl);
    this.db = this.client.db();
    this.collection = this.db.collection<DocumentState>(collectionName);

    console.log(`🗄️ MongoDB URL: ${mongoUrl}`);
    console.log(`📊 Database: ${this.db.databaseName}`);
    console.log(`📁 Collection: ${collectionName}`);
  }

  async connect() {
    if (!this.isConnected) {
      await this.client.connect();
      this.isConnected = true;
      console.log('✅ Connected to MongoDB');
    }
  }

  async disconnect() {
    if (this.isConnected) {
      await this.client.close();
      this.isConnected = false;
      console.log('✅ Disconnected from MongoDB');
    }
  }

  async getYDoc(docName: string): Promise<Y.Doc> {
    await this.connect();

    try {
      console.log(`🔍 Looking for document: ${docName}`);
      const docState = await this.collection.findOne({ _id: new ObjectId(docName) });

      if (docState) {
        console.log(`📄 Found document: ${docName}`);
        console.log(`📊 State vector type: ${typeof docState.stateVector}`);
        console.log(`📊 State vector constructor: ${docState.stateVector?.constructor?.name}`);

        // Check if state vector is corrupted
        if (docState.stateVector && typeof docState.stateVector.length === 'function') {
          // Check if it's MongoDB's Binary type (which is normal, not corrupted)
          if (docState.stateVector.constructor && docState.stateVector.constructor.name === 'Binary') {
            console.log(`📊 State vector is MongoDB Binary type (normal)`);
          } else {
            console.log(`⚠️ State vector is corrupted, attempting to fix...`);
            await this.fixCorruptedDocument(docName);
            console.log(`📄 Creating new document after fixing corruption: ${docName}`);
            return new Y.Doc();
          }
        }

        // Check if stateVector is a Buffer and convert it properly
        let stateVector: Uint8Array | null = null;
        if (docState.stateVector) {
          if (Buffer.isBuffer(docState.stateVector)) {
            stateVector = new Uint8Array(docState.stateVector);
            console.log(`📊 State vector length: ${stateVector.length} bytes`);
          } else if (docState.stateVector && typeof docState.stateVector === 'object' &&
                     docState.stateVector.constructor &&
                     docState.stateVector.constructor.name === 'Binary' &&
                     docState.stateVector.buffer) {
            // Handle MongoDB's Binary type
            const binaryBuffer = docState.stateVector.buffer;
            stateVector = new Uint8Array(binaryBuffer);
            console.log(`📊 State vector length: ${stateVector.length} bytes (from Binary)`);
          } else if (docState.stateVector && typeof docState.stateVector === 'object' && 'length' in docState.stateVector) {
            // Handle Uint8Array or similar
            stateVector = docState.stateVector as Uint8Array;
            console.log(`📊 State vector length: ${stateVector.length} bytes`);
          } else {
            console.log(`⚠️ State vector is not a Buffer, Binary, or Uint8Array: ${typeof docState.stateVector}`);
          }
        }

        console.log(`📅 Updated at: ${docState.updatedAt}`);

        if (stateVector && stateVector.length > 0) {
          const doc = new Y.Doc();

          try {
            // Apply the stored state
            Y.applyUpdate(doc, stateVector);
            console.log(`📄 Successfully loaded document: ${docName}`);
            return doc;
          } catch (applyError) {
            console.error(`❌ Error applying state vector to document: ${applyError}`);
            console.log(`📄 Creating new document due to apply error: ${docName}`);
            return new Y.Doc();
          }
        } else {
          console.log(`📄 State vector is empty or invalid, creating new document: ${docName}`);
          return new Y.Doc();
        }
      } else {
        console.log(`📄 Document not found: ${docName}`);
        return new Y.Doc();
      }
    } catch (error) {
      console.error(`❌ Error loading document ${docName}:`, error);
      return new Y.Doc();
    }
  }

  async storeUpdate(docName: string, update: Uint8Array): Promise<void> {
    await this.connect();

    try {
      console.log(`💾 Storing update for document: ${docName}`);
      console.log(`📊 Update size: ${update.length} bytes`);

      // Create a temporary doc to apply the update
      const tempDoc = new Y.Doc();

      // Get existing state if it exists
      const existingState = await this.collection.findOne({ _id:  new ObjectId(docName) });
      if (existingState && existingState.stateVector) {
        console.log(`📄 Found existing state, applying...`);

        // Convert existing state vector to Uint8Array
        let existingStateVector: Uint8Array | null = null;
        if (Buffer.isBuffer(existingState.stateVector)) {
          existingStateVector = new Uint8Array(existingState.stateVector);
        } else if (existingState.stateVector && typeof existingState.stateVector === 'object' &&
                   existingState.stateVector.constructor &&
                   existingState.stateVector.constructor.name === 'Binary' &&
                   existingState.stateVector.buffer) {
          // Handle MongoDB's Binary type
          const binaryBuffer = existingState.stateVector.buffer;
          existingStateVector = new Uint8Array(binaryBuffer);
        } else if (existingState.stateVector && typeof existingState.stateVector === 'object' && 'length' in existingState.stateVector) {
          // Handle Uint8Array or similar
          existingStateVector = existingState.stateVector as Uint8Array;
        }

        if (existingStateVector && existingStateVector.length > 0) {
          Y.applyUpdate(tempDoc, existingStateVector);
        } else {
          console.log(`📄 Existing state vector is empty or invalid`);
        }
      } else {
        console.log(`📄 No existing state found`);
      }

      // Apply the new update
      Y.applyUpdate(tempDoc, update);

      // Encode the new state
      const newStateVector = Y.encodeStateAsUpdate(tempDoc);
      console.log(`📊 New state vector size: ${newStateVector.length} bytes`);

      // Upsert the document state - _id is set by the query filter
      const result = await this.collection.updateOne(
        { _id:  new ObjectId(docName) },
        {
          $set: {
            stateVector: Buffer.from(newStateVector),
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );

      console.log(`💾 Stored update for document: ${docName}`);
      console.log(`📊 Upsert result: ${result.upsertedCount} inserted, ${result.modifiedCount} modified`);
    } catch (error) {
      console.error(`❌ Error storing update for ${docName}:`, error);
    }
  }

  async writeState(docName: string, ydoc: IWSSharedDoc): Promise<void> {
    await this.connect();

    try {
      const stateVector = Y.encodeStateAsUpdate(ydoc);

      // Only save if the state vector has content
      if (stateVector.length > 0) {
        await this.collection.updateOne(
          { _id:  new ObjectId(docName) },
          {
            $set: {
              stateVector: Buffer.from(stateVector),
              updatedAt: new Date()
            }
          },
          { upsert: true }
        );

        console.log(`💾 Wrote final state for document: ${docName}`);
      } else {
        console.log(`📝 Document ${docName} is empty, skipping save`);
      }
    } catch (error) {
      console.error(`❌ Error writing state for ${docName}:`, error);
    }
  }

  async destroy(): Promise<void> {
    await this.disconnect();
  }

  async listAllDocuments(): Promise<void> {
    await this.connect();

    try {
      const documents = await this.collection.find({}).toArray();
      console.log(`📋 Found ${documents.length} documents in collection:`);
      documents.forEach(doc => {
        console.log(`  - _id: ${doc._id}`);
        console.log(`    stateVector length: ${doc.stateVector ? doc.stateVector.length : 'undefined'}`);
        console.log(`    updatedAt: ${doc.updatedAt}`);

        // Check if state vector is corrupted
        if (doc.stateVector && typeof doc.stateVector.length === 'function') {
          // Check if it's MongoDB's Binary type (which is normal, not corrupted)
          if (doc.stateVector.constructor && doc.stateVector.constructor.name === 'Binary') {
            console.log(`    📊 State vector is MongoDB Binary type (normal)`);
          } else {
            console.log(`    ⚠️ WARNING: State vector appears to be corrupted!`);
          }
        }
      });
    } catch (error) {
      console.error('❌ Error listing documents:', error);
    }
  }

  async fixCorruptedDocument(docName: string): Promise<void> {
    await this.connect();

    try {
      console.log(`🔧 Attempting to fix corrupted document: ${docName}`);
      const docState = await this.collection.findOne({ _id: new ObjectId(docName) });

      if (docState && docState.stateVector && typeof docState.stateVector.length === 'function') {
        // Check if it's MongoDB's Binary type (which is normal, not corrupted)
        if (docState.stateVector.constructor && docState.stateVector.constructor.name === 'Binary') {
          console.log(`📊 Document ${docName} has normal MongoDB Binary state vector, not corrupted`);
          return;
        }

        console.log(`🗑️ Removing corrupted state vector for document: ${docName}`);

        // Remove the corrupted state vector
        await this.collection.updateOne(
          { _id: new ObjectId(docName) },
          {
            $unset: { stateVector: "" },
            $set: { updatedAt: new Date() }
          }
        );

        console.log(`✅ Fixed corrupted document: ${docName}`);
      } else {
        console.log(`📄 Document ${docName} is not corrupted or not found`);
      }
    } catch (error) {
      console.error(`❌ Error fixing corrupted document ${docName}:`, error);
    }
  }
}
