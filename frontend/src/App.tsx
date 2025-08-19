/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import type {Provider} from '@lexical/yjs';

import {CollaborationPlugin} from '@lexical/react/LexicalCollaborationPlugin';
import {LexicalComposer} from '@lexical/react/LexicalComposer';
import {Fragment, useCallback, useEffect, useRef, useState} from 'react';
import * as Y from 'yjs';
import { Toaster, toast } from 'react-hot-toast';

import Editor from './Editor';
import ExampleTheme from './ExampleTheme';
import {getRandomUserProfile, UserProfile} from './getRandomUserProfile';
import {createWebsocketProvider} from './providers';
import { ImageNode } from './nodes/ImageNode';
import { VideoNode } from './nodes/VideoNode';

interface ActiveUserProfile extends UserProfile {
  userId: number;
}

const createEditorConfig = (documentId: string) => ({
  // NOTE: This is critical for collaboration plugin to set editor state to null. It
  // would indicate that the editor should not try to set any default state
  // (not even empty one), and let collaboration plugin do it instead
  editorState: null,
  namespace: `React.js Collab Demo - ${documentId}`,
  nodes: [ImageNode, VideoNode],
  // Handling of errors during update
  onError(error: Error) {
    console.error('Lexical editor error:', error);
    // Don't throw errors in collaborative mode as they can break the session
  },
  // The editor theme
  theme: ExampleTheme,
  // Add collaborative-specific settings
  editable: true,
  // Improve selection handling for collaborative editing
  selection: {
    // Allow selection at text boundaries
    allowBoundarySelection: true,
    // Improve cursor positioning
    allowEmptySelection: true,
  },
  // Store editor instance globally for access in WebSocket override
  onEditorReady: (editor: any) => {
    (window as any).__LEXICAL_EDITOR__ = editor;
    console.log('[App] Lexical editor instance stored globally');
  },
});

export default function App() {
  const [userProfile] = useState(() => getRandomUserProfile());
  const [documentId, setDocumentId] = useState('');
  const [currentDocumentId, setCurrentDocumentId] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [yjsProvider, setYjsProvider] = useState<null | Provider>(null);
  const [connected, setConnected] = useState(false);
  const [activeUsers, setActiveUsers] = useState<ActiveUserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('authToken') || '');
  const [showAuthTokenInput, setShowAuthTokenInput] = useState(!localStorage.getItem('authToken'));
  
  // Track current provider to prevent multiple creation
  const currentProviderRef = useRef<Provider | null>(null);

  // Fallback timeout to hide loader if sync takes too long
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.log('Fallback: Hiding loader after timeout');
        setIsLoading(false);
        toast.error('Document loading timed out. Please try again.');
      }
    }, 10000); // Increased to 10 seconds for better UX

    return () => clearTimeout(timeout);
  }, [isLoading]);

  const handleAwarenessUpdate = useCallback(() => {
    const awareness = yjsProvider!.awareness!;
    setActiveUsers(
      Array.from(awareness.getStates().entries()).map(
        ([userId, {color, name}]) => ({
          color,
          name,
          userId,
        }),
      ),
    );
  }, [yjsProvider]);

  const handleConnectionToggle = () => {
    if (yjsProvider == null) {
      return;
    }

    // Check for auth token before connecting
    if (!connected && !authToken) {
      toast.error('Please set an authentication token first');
      setShowAuthTokenInput(true);
      return;
    }

    // Prevent rapid toggling
    if (isLoading) {
      toast.error('Please wait for current operation to complete');
      return;
    }

    if (connected) {
      yjsProvider.disconnect();
      toast.success('Disconnected from collaboration server');
    } else {
      setIsLoading(true);
      yjsProvider.connect();
    }
  };

  const handleSaveAuthToken = () => {
    if (!authToken.trim()) {
      toast.error('Please enter a valid authentication token');
      return;
    }
    localStorage.setItem('authToken', authToken.trim());
    setShowAuthTokenInput(false);
    toast.success('Authentication token saved successfully');
  };

  const handleClearAuthToken = () => {
    localStorage.removeItem('authToken');
    setAuthToken('');
    setShowAuthTokenInput(true);
    if (yjsProvider && connected) {
      yjsProvider.disconnect();
    }
    toast.success('Authentication token cleared');
  };

  const handleLoadDocument = () => {
    if (!documentId.trim()) {
      toast.error('Please enter a document ID');
      return;
    }

    const newDocId = documentId.trim();
    console.log('Loading document:', newDocId);

    // Don't reload if it's the same document
    if (newDocId === currentDocumentId) {
      toast.success('Document is already loaded');
      return;
    }

    // Disconnect current provider if exists
    if (yjsProvider) {
      console.log('Disconnecting current provider');
      yjsProvider.disconnect();
      setYjsProvider(null);
    }

    // Clear the provider reference
    currentProviderRef.current = null;

    // Reset all states and force a complete re-render
    setCurrentDocumentId(''); // Clear first to force unmount
    setIsLoading(true);
    setConnected(false);
    setActiveUsers([]);

    // Force a longer delay to ensure complete cleanup and prevent state conflicts
    setTimeout(() => {
      console.log('Setting new document ID after cleanup:', newDocId);
      setCurrentDocumentId(newDocId); // Set new ID to force remount
    }, 1000); // Reduced delay but still enough for cleanup
  };

  useEffect(() => {
    if (yjsProvider == null) {
      return;
    }

    yjsProvider.awareness.on('update', handleAwarenessUpdate);

    return () => {
      yjsProvider.awareness.off('update', handleAwarenessUpdate);
      // Clean up provider on unmount
      if (yjsProvider) {
        yjsProvider.disconnect();
      }
      // Clear the provider reference
      currentProviderRef.current = null;
    };
  }, [yjsProvider, handleAwarenessUpdate]);

  const providerFactory = useCallback(
    (id: string, yjsDocMap: Map<string, Y.Doc>) => {
      // Always use the current document ID, not the passed id
      const docId = currentDocumentId || id;
      console.log('Creating provider for document ID:', docId);

      // Check if we already have a provider for this document
      if (currentProviderRef.current && docId === currentDocumentId) {
        console.log('[App] ✅ Reusing existing provider for document:', docId);
        return currentProviderRef.current;
      }

      // 🚨 ALWAYS create a FRESH Y.Doc to prevent stale state issues
      console.log('[App] 🚨 FORCING FRESH Y.Doc creation for document:', docId);
      
      // Remove any existing doc with this ID to force recreation
      if (yjsDocMap.has(docId)) {
        console.log('[App] 🗑️ Removing existing Y.Doc for:', docId);
        const oldDoc = yjsDocMap.get(docId);
        if (oldDoc) {
          oldDoc.destroy(); // Properly destroy the old document
        }
        yjsDocMap.delete(docId);
      }
      
      // Clear ALL existing Y.Doc instances to prevent any cached state
      console.log('[App] 🧹 Clearing ALL existing Y.Doc instances');
      for (const key of Array.from(yjsDocMap.keys())) {
        console.log('[App] 🗑️ Removing Y.Doc:', key);
        const otherDoc = yjsDocMap.get(key);
        if (otherDoc) {
          otherDoc.destroy();
        }
        yjsDocMap.delete(key);
      }
      
      // Create a completely fresh Y.Doc instance
      const doc = new Y.Doc();
      yjsDocMap.set(docId, doc);
      console.log('[App] ✅ Created completely fresh Y.Doc for:', docId);
      
      // Force clear any global state that might interfere
      (window as any).__CURRENT_EDITOR_TEXT__ = '';
      (window as any).__DISABLE_YJS_SYNC__ = false;
      
      // Force the document to start with a clean state
      console.log('[App] 🧹 Ensuring Y.Doc starts with clean state');
      const provider = createWebsocketProvider(docId, doc);

      // Track if we've already shown connection/sync messages to prevent spam
      let hasShownConnectionMessage = false;
      let hasShownSyncMessage = false;

      provider.on('status', (event) => {
        setConnected(event.status === 'connected');
        console.log('Provider status for', docId, ':', event.status);

        if (event.status === 'connected' && !hasShownConnectionMessage) {
          hasShownConnectionMessage = true;
          toast.success('Connected to collaboration server');
          setIsLoading(false);
        } else if (event.status === 'disconnected') {
          // Only show disconnection toast if we were previously connected
          // to avoid spam when authentication fails
          if (connected) {
            toast.error('Disconnected from collaboration server');
          }
          setIsLoading(false);
          // Reset flags when disconnected
          hasShownConnectionMessage = false;
          hasShownSyncMessage = false;
        }
      });

      // Listen for document sync events - only show message once per session
      provider.on('sync', (isSynced: boolean) => {
        console.log('Document sync status for', docId, ':', isSynced);
        if (isSynced && !hasShownSyncMessage) {
          hasShownSyncMessage = true;
          setIsLoading(false);
          toast.success('Document synchronized successfully');
        }
      });

      // Listen for awareness updates
      provider.awareness.on('update', () => {
        console.log('Awareness update for', docId);
      });

      // Listen for document updates
      provider.on('update', () => {
        console.log('Document update for', docId);
      });

      // Client-side text extraction helpers to verify local text actually changes
      const computeFingerprint = (text: string): number => {
        let h = 0x811c9dc5 | 0;
        for (let i = 0; i < text.length; i++) {
          h ^= text.charCodeAt(i) & 0xff;
          h = Math.imul(h, 0x01000193);
        }
        return h >>> 0;
      };

      const extractPlainText = (yd: Y.Doc): string => {
        try {
          const content = yd.getText('content');
          if (content && content.length > 0) return content.toString();
          const XmlText: any = (Y as any).XmlText;
          const XmlElement: any = (Y as any).XmlElement;
          const XmlFragment: any = (Y as any).XmlFragment;
          const collect = (node: any): string => {
            if (XmlText && node instanceof XmlText) return node.toString();
            if ((XmlElement && node instanceof XmlElement) || (XmlFragment && node instanceof XmlFragment)) {
              const children = typeof node.toArray === 'function' ? node.toArray() : [];
              let acc = '';
              for (const child of children) acc += collect(child);
              return acc;
            }
            return '';
          };
          let acc = '';
          for (const [, shared] of yd.share) acc += collect(shared);
          if (acc && acc !== '[object Object]') return acc;
          let combined = '';
          const entries: Array<[string, any]> = [];
          for (const entry of yd.share) entries.push(entry);
          entries.sort((a, b) => a[0].localeCompare(b[0]));
          for (const [, shared] of entries) if (shared instanceof Y.Text) combined += shared.toString();
          return combined;
        } catch {
          return '';
        }
      };

      let lastTextBeforeTxn = '';
      doc.on('beforeTransaction', () => {
        try {
          lastTextBeforeTxn = extractPlainText(doc!);
        } catch {
          lastTextBeforeTxn = '';
        }
      });

      doc.on('afterTransaction', (txn: any) => {
        try {
          const newText = extractPlainText(doc!);
          const prevFp = computeFingerprint(lastTextBeforeTxn);
          const newFp = computeFingerprint(newText);
          const same = lastTextBeforeTxn === newText;
          console.log('[ClientY] Txn', {
            docId,
            local: !!txn?.local,
            origin: txn?.origin?.constructor?.name || typeof txn?.origin || 'unknown',
            textChanged: !same,
            prevLen: lastTextBeforeTxn.length,
            newLen: newText.length,
            prevFp: prevFp.toString(16),
            newFp: newFp.toString(16)
          });
        } catch (e) {
          console.log('[ClientY] Txn (text compare failed):', (e as Error).message);
        }
      });

      // Track Y.js document changes
      doc.on('update', (update: any, origin: any) => {
        console.log('[YjsDebugPlugin] Y.js document update:', {
          updateSize: update.length,
          origin: origin?.constructor?.name || 'unknown',
          docId,
          timestamp: new Date().toISOString()
        });

        // Prevent WebsocketProvider from overriding local changes
        if (origin?.constructor?.name === 'WebsocketProvider') {
          console.log('[YjsDebugPlugin] ⚠️ WebsocketProvider update detected - checking for conflicts...');
        }
      });

      // Listen for document reload events to prevent state resets
      provider.on('reload', () => {
        console.log('Document reloaded for', docId);
        // Don't reset loading state here as sync event will handle it
      });

      // Store the provider reference and expose it for status/awareness UI
      currentProviderRef.current = provider;
      setTimeout(() => {
        setYjsProvider(provider);
      }, 0);

      return provider;
    },
    [currentDocumentId, connected],
  );

  return (
    <div ref={containerRef}>
      <Toaster position="top-right" />

      {/* Authentication Section */}
      {showAuthTokenInput && (
        <div style={{
          padding: '20px',
          backgroundColor: '#fff3cd',
          borderLeft: '4px solid #ffc107',
          marginBottom: '20px'
        }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#856404' }}>Authentication Required</h4>
          <p style={{ margin: '0 0 15px 0', color: '#856404', fontSize: '14px' }}>
            You need to set an authentication token to connect to the collaboration server.
          </p>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: '300px' }}>
              <label style={{ fontSize: '14px', marginBottom: '5px', color: '#856404' }}>
                Authentication Token:
              </label>
              <input
                type="password"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                placeholder="Enter your authentication token"
                style={{
                  padding: '8px 12px',
                  border: '1px solid #ffc107',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveAuthToken();
                  }
                }}
              />
            </div>
            <button
              onClick={handleSaveAuthToken}
              style={{
                padding: '8px 16px',
                backgroundColor: '#ffc107',
                color: '#212529',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Save Token
            </button>
            {authToken && (
              <button
                onClick={() => setShowAuthTokenInput(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Document ID Input Section */}
      <div style={{
        padding: '20px',
        backgroundColor: '#f8f9fa',
        borderBottom: '1px solid #dee2e6',
        marginBottom: '20px'
      }}>
        <h3 style={{ margin: '0 0 15px 0', color: '#495057' }}>Collaborative Document</h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: '200px' }}>
            <label style={{ fontSize: '14px', marginBottom: '5px', color: '#495057' }}>
              Document ID:
            </label>
            <input
              type="text"
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
              placeholder="Enter document ID to load"
              style={{
                padding: '8px 12px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px'
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleLoadDocument();
                }
              }}
            />
          </div>
          <button
            onClick={handleLoadDocument}
            disabled={!documentId.trim()}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: documentId.trim() ? 'pointer' : 'not-allowed',
              opacity: documentId.trim() ? 1 : 0.6
            }}
          >
            Load Document
          </button>
        </div>
        {currentDocumentId && (
          <div style={{ marginTop: '10px', fontSize: '14px', color: '#6c757d' }}>
            <strong>Current Document:</strong> {currentDocumentId}
          </div>
        )}
      </div>

      {/* Connection Status */}
      <div style={{ padding: '0 20px', marginBottom: '20px' }}>
        <div style={{ margin: '10px 0' }}>
          <p><b>Provider:</b> WebSocket Proxy (localhost:1000)</p>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={handleConnectionToggle}
              disabled={!currentDocumentId}
              style={{
                padding: '6px 12px',
                backgroundColor: connected ? '#dc3545' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: currentDocumentId ? 'pointer' : 'not-allowed',
                opacity: currentDocumentId ? 1 : 0.6
              }}
            >
              {connected ? 'Disconnect' : 'Connect'}
            </button>

            {!showAuthTokenInput && authToken && (
              <button
                onClick={() => setShowAuthTokenInput(true)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Change Auth Token
              </button>
            )}

            {!showAuthTokenInput && authToken && (
              <button
                onClick={handleClearAuthToken}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Clear Token
              </button>
            )}

            <div style={{ fontSize: '12px', color: authToken ? '#28a745' : '#dc3545' }}>
              Auth: {authToken ? '✓ Token Set' : '✗ No Token'}
            </div>
          </div>
        </div>
        <p>
          <b>Active users:</b>{' '}
          {activeUsers.map(({name, color, userId}, idx) => (
            <Fragment key={userId}>
              <span style={{color}}>{name}</span>
              {idx === activeUsers.length - 1 ? '' : ', '}
            </Fragment>
          ))}
        </p>
      </div>

      {isLoading && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px',
          fontSize: '16px',
          color: '#666'
        }}>
          <div style={{
            display: 'inline-block',
            width: '20px',
            height: '20px',
            border: '3px solid #f3f3f3',
            borderTop: '3px solid #3498db',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginRight: '10px'
          }}></div>
          {currentDocumentId ? 'Loading document content...' : 'Connecting to server...'}
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {currentDocumentId ? (
        <LexicalComposer key={currentDocumentId} initialConfig={createEditorConfig(currentDocumentId)}>
          {/* With CollaborationPlugin - we MUST NOT use @lexical/react/LexicalHistoryPlugin */}
          <CollaborationPlugin
            id={currentDocumentId}
            providerFactory={providerFactory}
            // Unless you have a way to avoid race condition between 2+ users trying to do bootstrap simultaneously
            // you should never try to bootstrap on client. It's better to perform bootstrap within Yjs server.
            shouldBootstrap={false}
            username={userProfile.name}
            cursorColor={userProfile.color}
            cursorsContainerRef={containerRef}
          />
          <Editor />
        </LexicalComposer>
      ) : (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '100px 20px',
          fontSize: '18px',
          color: '#6c757d',
          textAlign: 'center'
        }}>
          <div>
            <h3>Welcome to Collaborative Editor</h3>
            <p>Enter a document ID above to load an existing document and start collaborating.</p>
          </div>
        </div>
      )}
    </div>
  );
}
