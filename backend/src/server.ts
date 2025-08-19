import 'dotenv/config';
import http from 'http';
import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import { setPersistence, setupWSConnection } from './websocket/utils.js';
import { IWSSharedDoc } from './websocket/interfaces.js';
import { CustomMongoPersistence } from './custom-persistence.js';

// Text extraction utility class
class TextExtractor {
    public extractTextFromYDoc(ydoc: Y.Doc): string {
        try {
            // Log all available shared types for debugging
            console.log(`🔍 Available shared types in Y.Doc:`);
            for (const [name, shared] of ydoc.share) {
                console.log(`  - ${name}: ${shared.constructor.name}`);
                
                // Log more details about the shared type
                if (shared.constructor.name === 'AbstractType') {
                    console.log(`    📄 AbstractType ${name} properties:`, Object.keys(shared));
                    if (shared._map) {
                        console.log(`    📄 AbstractType ${name} _map size:`, shared._map.size);
                    }
                    if (shared._item) {
                        console.log(`    📄 AbstractType ${name} has _item`);
                    }
                    if (shared._start) {
                        console.log(`    📄 AbstractType ${name} has _start`);
                    }
                }
            }

            // Try to get text from the 'content' shared type first
            const content = ydoc.getText('content');
            if (content && content.length > 0) {
                console.log(`📄 Found content in 'content' shared type: ${content.toString()}`);
                return content.toString();
            }

            // Try common Lexical shared type names
            const lexicalContent = ydoc.getText('lexical');
            if (lexicalContent && lexicalContent.length > 0) {
                console.log(`📄 Found content in 'lexical' shared type: ${lexicalContent.toString()}`);
                return lexicalContent.toString();
            }

            // Try to get content from root - use ydoc.get() not ydoc.getText() to access existing AbstractType
            const rootAbstract = ydoc.get('root');
            if (rootAbstract) {
                console.log(`📄 Found root shared type: ${rootAbstract.constructor.name}`);
                
                if (rootAbstract.constructor.name === 'AbstractType') {
                    console.log(`📄 Found root as AbstractType, attempting to extract content`);
                    try {
                        // Skip toString() as it returns [object Object] - go directly to structure exploration
                        console.log(`📄 Exploring AbstractType structure for actual content`);
                        
                        // Try to get the first child of the root AbstractType
                        if (rootAbstract._map && rootAbstract._map.size > 0) {
                            console.log(`📄 Root has ${rootAbstract._map.size} children`);
                            for (const [key, value] of rootAbstract._map) {
                                console.log(`📄 Child key: ${key}, type: ${value.constructor.name}`);
                                
                                // If it's a Y.Text, get its content
                                if (value instanceof Y.Text) {
                                    const text = value.toString();
                                    if (text && text.trim().length > 0) {
                                        console.log(`📄 Found content in child Y.Text: ${text}`);
                                        return text;
                                    }
                                }
                                
                                // If it's an Item (contains actual content), extract from it
                                if (value.constructor.name === 'Item') {
                                    console.log(`📄 Child is Item, attempting to extract content`);
                                    const item = value as any;
                                    
                                    // Try to get content from the Item's content property
                                    if (item.content && item.content.constructor && item.content.constructor.name === 'ContentString') {
                                        const content = item.content.str;
                                        if (content && content.trim().length > 0) {
                                            console.log(`📄 Found content in Item.content.str: ${content}`);
                                            return content;
                                        }
                                    }
                                    
                                    // Try to get content from the Item's content property directly
                                    if (item.content && typeof item.content === 'string') {
                                        if (item.content.trim().length > 0) {
                                            console.log(`📄 Found content in Item.content: ${item.content}`);
                                            return item.content;
                                        }
                                    }
                                    
                                    // Try to get content from the Item's toString method
                                    const itemText = item.toString();
                                    if (itemText && itemText.trim().length > 0 && itemText !== '[object Object]') {
                                        console.log(`📄 Found content in Item.toString(): ${itemText}`);
                                        return itemText;
                                    }
                                    
                                    console.log(`📄 Item has no extractable content`);
                                }
                                
                                // If it's another AbstractType, explore it recursively
                                if (value.constructor.name === 'AbstractType') {
                                    console.log(`📄 Child is AbstractType, exploring recursively`);
                                    const childAbstract = value as any; // Type assertion to access _map
                                    if (childAbstract._map && childAbstract._map.size > 0) {
                                        for (const [childKey, childValue] of childAbstract._map) {
                                            console.log(`📄 Grandchild key: ${childKey}, type: ${childValue.constructor.name}`);
                                            if (childValue instanceof Y.Text) {
                                                const childText = childValue.toString();
                                                if (childText && childText.trim().length > 0) {
                                                    console.log(`📄 Found content in grandchild Y.Text: ${childText}`);
                                                    return childText;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        
                        // Try to access the _item property (used by some Yjs structures)
                        if (rootAbstract._item) {
                            console.log(`📄 Root has _item property`);
                            if (rootAbstract._item instanceof Y.Text) {
                                const itemText = rootAbstract._item.toString();
                                if (itemText && itemText.trim().length > 0) {
                                    console.log(`📄 Found content in _item Y.Text: ${itemText}`);
                                    return itemText;
                                }
                            }
                        }
                        
                        // Try to access the _start property (used by some Yjs structures)
                        if (rootAbstract._start) {
                            console.log(`📄 Root has _start property`);
                            if (rootAbstract._start instanceof Y.Text) {
                                const startText = rootAbstract._start.toString();
                                if (startText && startText.trim().length > 0) {
                                    console.log(`📄 Found content in _start Y.Text: ${startText}`);
                                    return startText;
                                }
                            }
                        }
                        
                        console.log(`📄 No text content found in AbstractType structure`);
                        
                    } catch (error) {
                        console.log(`📄 Error extracting from root AbstractType:`, error);
                    }
                } else {
                    // It's a YText, try to get content
                    const rootText = rootAbstract.toString();
                    if (rootText && rootText.trim().length > 0) {
                        console.log(`📄 Found content in root YText: ${rootText}`);
                        return rootText;
                    }
                }
            }

            // Try 'editor' shared type
            const editorContent = ydoc.getText('editor');
            if (editorContent && editorContent.length > 0) {
                console.log(`📄 Found content in 'editor' shared type: ${editorContent.toString()}`);
                return editorContent.toString();
            }

            // Fallback: try to extract text from all shared types
            let extractedText = '';
            for (const [name, shared] of ydoc.share) {
                console.log(`🔍 Checking shared type: ${name} (${shared.constructor.name})`);
                
                if (shared instanceof Y.Text) {
                    const text = shared.toString();
                    console.log(`📄 Found Y.Text in ${name}: "${text}"`);
                    extractedText += text;
                } else if (shared instanceof Y.XmlText) {
                    const text = shared.toString();
                    console.log(`📄 Found Y.XmlText in ${name}: "${text}"`);
                    extractedText += text;
                } else if (shared instanceof Y.XmlElement || shared instanceof Y.XmlFragment) {
                    // Recursively extract text from XML elements
                    const collect = (node: any): string => {
                        if (node instanceof Y.XmlText) return node.toString();
                        if (node instanceof Y.XmlElement || node instanceof Y.XmlFragment) {
                            const children = node.toArray();
                            let acc = '';
                            for (const child of children) acc += collect(child);
                            return acc;
                        }
                        return '';
                    };
                    const text = collect(shared);
                    console.log(`📄 Found Y.XmlElement/Y.XmlFragment in ${name}: "${text}"`);
                    extractedText += text;
                } else {
                    console.log(`📄 Shared type ${name} is not a text type: ${shared.constructor.name}`);
                    
                    // Try to handle AbstractType (used by Lexical)
                    if (shared.constructor && shared.constructor.name === 'AbstractType') {
                        try {
                            // Skip toString() on AbstractType as it returns [object Object]
                            console.log(`📄 Exploring AbstractType ${name} structure`);
                            
                            // Try _map property
                            if (shared._map && shared._map.size > 0) {
                                console.log(`📄 AbstractType ${name} has ${shared._map.size} children`);
                                for (const [key, value] of shared._map) {
                                    console.log(`📄 Child ${key}: ${value.constructor.name}`);
                                    
                                    // If it's a Y.Text, get its content
                                    if (value instanceof Y.Text) {
                                        const text = value.toString();
                                        if (text && text.trim().length > 0) {
                                            console.log(`📄 Found content in child Y.Text: ${text}`);
                                            extractedText += text;
                                        }
                                    }
                                    
                                    // If it's an Item (contains actual content), extract from it
                                    if (value.constructor.name === 'Item') {
                                        console.log(`📄 Child is Item, attempting to extract content`);
                                        const item = value as any;
                                        
                                        // Try to get content from the Item's content property
                                        if (item.content && item.content.constructor && item.content.constructor.name === 'ContentString') {
                                            const content = item.content.str;
                                            if (content && content.trim().length > 0) {
                                                console.log(`📄 Found content in Item.content.str: ${content}`);
                                                extractedText += content;
                                            }
                                        }
                                        
                                        // Try to get content from the Item's content property directly
                                        if (item.content && typeof item.content === 'string') {
                                            if (item.content.trim().length > 0) {
                                                console.log(`📄 Found content in Item.content: ${item.content}`);
                                                extractedText += item.content;
                                            }
                                        }
                                        
                                        // Try to get content from the Item's toString method
                                        const itemText = item.toString();
                                        if (itemText && itemText.trim().length > 0 && itemText !== '[object Object]') {
                                            console.log(`📄 Found content in Item.toString(): ${itemText}`);
                                            extractedText += itemText;
                                        }
                                    
                                    }
                                }
                                
                                // Try _item property
                                if (shared._item) {
                                    const itemText = shared._item.toString();
                                    if (itemText && itemText.trim().length > 0) {
                                        console.log(`📄 Found content in _item: "${itemText}"`);
                                        extractedText += itemText;
                                    }
                                }
                                
                                // Try _start property
                                if (shared._start) {
                                    const startText = shared._start.toString();
                                    if (startText && startText.trim().length > 0) {
                                        console.log(`📄 Found content in _start: "${startText}"`);
                                        extractedText += startText;
                                    }
                                }
                            }
                        } catch (error) {
                            console.log(`📄 Error extracting from AbstractType ${name}:`, error);
                        }
                    }
                }
            }

            console.log(`📄 Final extracted text: "${extractedText}"`);
            return extractedText || '';
        } catch (err) {
            console.error(`[Persistence] Error extracting text from Y.Doc:`, err);
            return '';
        }
    }

    public logTextBeforeSave(ydoc: Y.Doc, docName: string): void {
        const beforeSaveText = this.extractTextFromYDoc(ydoc);
        console.log('-------------------------------');
        console.log('before save-> ' + beforeSaveText);
        console.log('--------------------------------');
    }
}

const textExtractor = new TextExtractor();

const server = http.createServer((request, response) => {
	response.writeHead(200, { 'Content-Type': 'text/plain' });
	response.end('Sharenest Collaborative Editor Backend is running!');
});

// y-websocket
const wss = new WebSocketServer({ server });
wss.on('connection', setupWSConnection);

/*
 * Custom MongoDB persistence setup
 */
const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB || 'sharenest';
const collectionName = process.env.MONGODB_COLLECTION || 'content';

// Construct the full MongoDB URL with database name
const fullMongoUrl = `${mongoUrl}/${dbName}`;

console.log(`Connecting to MongoDB: ${fullMongoUrl}`);
console.log(`Using collection: ${collectionName}`);

const mdb = new CustomMongoPersistence(fullMongoUrl, collectionName);

// List all existing documents on startup
mdb.listAllDocuments().catch(console.error);

setPersistence({
	bindState: async (docName: string, ydoc: IWSSharedDoc) => {
		console.log(`Binding state for document: ${docName}`);
		
		// Get the persisted document from MongoDB
		const persistedYdoc = await mdb.getYDoc(docName);
		
		// Check if the persisted document has content
		const persistedText = textExtractor.extractTextFromYDoc(persistedYdoc);
		console.log(`📄 Persisted document text length: ${persistedText.length}`);
		console.log(`📄 Persisted document text: "${persistedText}"`);
		
		// Check current Y.Doc content before applying persisted state
		const currentText = textExtractor.extractTextFromYDoc(ydoc);
		console.log(`📄 Current Y.Doc text length: ${currentText.length}`);
		console.log(`📄 Current Y.Doc text: "${currentText}"`);
		
		// Set up update listener BEFORE applying persisted state to prevent conflicts
		let isInitialLoad = true;
		let hasAppliedPersistedState = false;
		
		ydoc.on('update', async (update: Uint8Array) => {
			// Skip saving during initial load to prevent overwriting existing content
			if (isInitialLoad) {
				console.log(`⏭️ Skipping save during initial load for document: ${docName}`);
				return;
			}
			
			// Log text before saving each update
			textExtractor.logTextBeforeSave(ydoc, docName);
			await mdb.storeUpdate(docName, update);
		});
		
		// Apply the persisted state to the current Y.Doc
		if (persistedText.length > 0) {
			console.log(`📄 Applying persisted state with content length: ${persistedText.length}`);
			Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(persistedYdoc));
			hasAppliedPersistedState = true;
		} else {
			console.log(`📄 No persisted content to apply`);
		}
		
		// Check content after applying persisted state
		const afterText = textExtractor.extractTextFromYDoc(ydoc);
		console.log(`📄 After applying persisted state - text length: ${afterText.length}`);
		console.log(`📄 After applying persisted state - text: "${afterText}"`);
		
		// Wait a bit longer before allowing saves to ensure the document is fully loaded
		setTimeout(() => {
			isInitialLoad = false;
			console.log(`✅ Initial load complete, allowing saves for document: ${docName}`);
		}, 2000); // Increased to 2 seconds
	},
	writeState: async (docName: string, ydoc: IWSSharedDoc) => {
		// Check if the document has content before writing
		const text = textExtractor.extractTextFromYDoc(ydoc);
		console.log(`📝 writeState called for document: ${docName}, text length: ${text.length}`);
		
		// Don't write empty state during initial load
		if (text.length === 0) {
			console.log(`⏭️ Skipping writeState for empty document: ${docName}`);
			return;
		}
		
		await mdb.writeState(docName, ydoc);
	},
});

const port = process.env.PORT || 1234;
const host = process.env.HOST || 'localhost';

server.listen(port, () => {
	console.log(`🚀 Sharenest Backend Server running on http://${host}:${port}`);
	console.log(`📝 WebSocket endpoint: ws://${host}:${port}`);
	console.log(`🗄️  MongoDB: ${fullMongoUrl}`);
	console.log(`📊 Collection: ${collectionName}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
	console.log('\n🛑 Shutting down server...');
	await mdb.destroy();
	server.close(() => {
		console.log('✅ Server closed');
		process.exit(0);
	});
});

process.on('SIGTERM', async () => {
	console.log('\n🛑 Shutting down server...');
	await mdb.destroy();
	server.close(() => {
		console.log('✅ Server closed');
		process.exit(0);
	});
});