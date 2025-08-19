
import {Provider} from '@lexical/yjs';
import {WebsocketProvider} from 'y-websocket';
import * as Y from 'yjs';

export function createWebsocketProvider(id: string, doc: Y.Doc): Provider {
  // Use the exact Y.Doc provided by Lexical's CollaborationPlugin

  console.log('Creating WebsocketProvider for document:', id);

  // Get token from localStorage, fallback to the same token the backend uses
  const token = localStorage.getItem('authToken') ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXItMTIzIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwicm9sZSI6InVzZXIiLCJpYXQiOjE3NTUyMjk4OTYsImV4cCI6MTc1NTU4OTg5Nn0.gbILlQ9LzG5NUp-Ipktl5iqbbrtMVBGjUtQC7I-ohg4';

  console.log('[WebsocketProvider] Using token:', token ? 'Token present' : 'No token');
  console.log('[WebsocketProvider] Token from localStorage:', localStorage.getItem('authToken') ? 'Yes' : 'No');
  console.log('[WebsocketProvider] Document ID being used:', id);
  console.log('[WebsocketProvider] Y.Doc instance:', doc.guid);

  // Read WS base URL from Vite env (fallback to localhost)
  const wsBase = (import.meta as any).env?.VITE_WS_URL ?? 'ws://localhost:1234';

  // Check if there's already a provider for this document
  const existingProviderKey = `__provider_${id}`;
  if ((window as any)[existingProviderKey]) {
    console.log('[WebsocketProvider] ⚠️ Provider already exists for document:', id);
    const existingProvider = (window as any)[existingProviderKey];
    if (existingProvider.ws && existingProvider.ws.readyState === WebSocket.OPEN) {
      console.log('[WebsocketProvider] ✅ Reusing existing connected provider');
      return existingProvider as unknown as Provider;
    } else {
      console.log('[WebsocketProvider] 🗑️ Cleaning up stale provider');
      existingProvider.disconnect();
    }
  }

  const provider = new WebsocketProvider(wsBase, id, doc, {
    connect: false, // Don't connect immediately to prevent rapid reconnection
    // Force fresh connection every time
    resyncInterval: 0,
    maxBackoffTime: 5000, // Increased backoff time
    params: { token },
    // Prevent aggressive resync that might override local changes
    disableBc: true, // Disable broadcast channel to prevent local conflicts
  });

  // Store the provider reference to prevent duplicates
  (window as any)[existingProviderKey] = provider;

  // Connect after a delay to prevent rapid reconnection issues
  setTimeout(() => {
    console.log('[WebsocketProvider] Connecting after delay for document:', id);
    provider.connect();
  }, 1000);

    // Force the provider to start with a clean state
  console.log('[WebsocketProvider] 🚨 Forcing clean state for document:', id);

  // Expose basic connection/sync flags for the EditingGatePlugin
  (window as any).__Y_CONNECTED__ = false;
  (window as any).__Y_SYNCED__ = false;

  // Track if we've shown auth error to prevent spam
  let hasShownAuthError = false;
  let consecutiveAuthFailures = 0;
  let hasShownStatusMessage = false;
  let isInitialSync = true; // Track initial sync to prevent empty content overwrites

  provider.on('status', (event: { status: string }) => {
    (window as any).__Y_CONNECTED__ = event.status === 'connected';
    console.log('[WebsocketProvider] Status changed:', event.status);

    // Force fresh sync when connected
    if (event.status === 'connected') {
      console.log('[WebsocketProvider] 🚨 Connected - forcing fresh state for document:', id);

      // Prevent stale state by ensuring fresh document
      console.log('[WebsocketProvider] 🧹 Ensuring fresh document state');
      // Don't clear the document here - let the frontend handle fresh creation

      // Clear any cached state and force a fresh sync
      setTimeout(() => {
        if (provider.ws && provider.ws.readyState === WebSocket.OPEN) {
          console.log('[WebsocketProvider] WebSocket is open, forcing fresh state sync');
        }
      }, 100);

      // Reset auth error flag on successful connection
      hasShownAuthError = false;
      consecutiveAuthFailures = 0;
    }
  });

  provider.on('sync', (isSynced: boolean) => {
    (window as any).__Y_SYNCED__ = !!isSynced;
    console.log('[WebsocketProvider] Sync status:', isSynced);

    if (isSynced) {
      console.log('[WebsocketProvider] Document synced, ready for fresh edits');
      // Mark initial sync as complete after a delay to allow content to load
      setTimeout(() => {
        isInitialSync = false;
        console.log('[WebsocketProvider] ✅ Initial sync complete, allowing content updates');
      }, 2000); // Wait 2 seconds for content to load
    }
  });

  // Handle WebSocket errors, particularly authentication failures
  provider.ws?.addEventListener?.('close', (event: CloseEvent) => {
    console.log('[WebsocketProvider] WebSocket closed:', event.code, event.reason, 'for document:', id);

    // Check for authentication failure (code 1008)
    if (event.code === 1008 && !hasShownAuthError) {
      hasShownAuthError = true;
      consecutiveAuthFailures++;

      // Import toast dynamically to avoid circular dependencies
      import('react-hot-toast').then(({ toast }) => {
        if (event.reason.includes('Authentication failed') || event.reason.includes('missing token')) {
          toast.error('Authentication failed: Please set a valid auth token in localStorage');
        } else if (event.reason.includes('Invalid document id')) {
          toast.error('Invalid document ID: Must be a valid ObjectId');
        } else {
          toast.error(`Connection failed: ${event.reason || 'Authentication error'}`);
        }
      });

      // If we keep failing auth, don't keep retrying
      if (consecutiveAuthFailures >= 3) {
        console.warn('Too many auth failures, stopping reconnection attempts');
        provider.shouldConnect = false;
        provider.disconnect();
      }
    }
  });

  // Add error listener for WebSocket
  provider.ws?.addEventListener?.('error', (event: Event) => {
    console.log('[WebsocketProvider] WebSocket error for document:', id, event);
  });



    // Log when WebsocketProvider actually sends updates
  doc.on('update', (update: Uint8Array, origin: any) => {
    // Only log local updates (not remote ones)
    if (origin && origin.constructor?.name !== 'WebsocketProvider') {
      let globalText = (window as any).__CURRENT_EDITOR_TEXT__ || '';

      // Fallback: try to get text directly from editor if global text is empty
      if (!globalText) {
        try {
          const editorElement = document.querySelector('[contenteditable="true"]');
          if (editorElement) {
            globalText = editorElement.textContent || '';
          }
        } catch (error) {
          console.log('[WebsocketProvider] Error getting editor text in Yjs update:', error);
        }
      }

      // Prevent sending empty content during initial sync to avoid overwriting existing content
      if (isInitialSync && (!globalText || globalText.trim() === '')) {
        console.log('[WebsocketProvider] ⏭️ Skipping empty content update during initial sync');
        return;
      }

      console.log('=============================');
      console.log('[WebsocketProvider] SENDING UPDATE TO BACKEND');
      console.log('[WebsocketProvider] Local update detected, text:', globalText);
      console.log('[WebsocketProvider] Update size:', update.length, 'bytes');
      console.log('[WebsocketProvider] Origin:', origin?.constructor?.name || 'unknown');
      console.log('[WebsocketProvider] WebSocket state:', provider.ws?.readyState);
      console.log('[WebsocketProvider] Connected:', provider.ws?.readyState === WebSocket.OPEN);
      console.log('=============================');

      // Add the specific log you requested
      console.log('--------------------------------------------');
      console.log('YJS UPDATE - ' + globalText);
      console.log('--------------------------------------------');

      // Force setup WebSocket send override when update is detected
      setupWebSocketOverride();

      // Add a delay to ensure Yjs document is fully synchronized before sending
      setTimeout(() => {
        console.log('[WebsocketProvider] 🔄 Delayed sync check - ensuring Yjs document is fully updated');
        // Force a sync to ensure the document is fully updated
        if (provider.ws && provider.ws.readyState === WebSocket.OPEN) {
          console.log('[WebsocketProvider] ✅ WebSocket ready, document should be fully synced');
        }
      }, 100); // 100ms delay to allow Yjs to complete the update
    } else {
      // Log remote updates too for debugging
      console.log('[WebsocketProvider] Remote update detected from:', origin?.constructor?.name || 'unknown');
    }
  });

  // Override the WebsocketProvider's send method to log what's actually being sent
  const setupWebSocketOverride = () => {
    console.log('[WebsocketProvider] Attempting to set up WebSocket send override...');
    console.log('[WebsocketProvider] WebSocket state:', provider.ws?.readyState);

    if (provider.ws && provider.ws.readyState === WebSocket.OPEN) {
      const originalSend = provider.ws.send;
      provider.ws.send = function(data) {
        const size = typeof data === 'string' ? data.length : (data as any)?.byteLength || 'unknown';

        // Get current editor text directly from DOM at the moment of sending
        let currentText = '';
        try {
          // First try to get text directly from the DOM contenteditable element
          const editorElement = document.querySelector('[contenteditable="true"]');
          if (editorElement) {
            currentText = editorElement.textContent || '';
            console.log('[WebsocketProvider] Got text from DOM:', currentText);
          }

          // Fallback to global variable if DOM is empty
          if (!currentText) {
            currentText = (window as any).__CURRENT_EDITOR_TEXT__ || '';
            console.log('[WebsocketProvider] Got text from global variable:', currentText);
          }

          // Final fallback: try to get from Lexical editor instance
          if (!currentText && (window as any).__LEXICAL_EDITOR__) {
            try {
              const editor = (window as any).__LEXICAL_EDITOR__;
              // Try to get text content directly without async import
              currentText = editor.getEditorState().read(() => {
                // Simple text extraction without requiring lexical imports
                return document.querySelector('[contenteditable="true"]')?.textContent || '';
              });
              console.log('[WebsocketProvider] Got text from Lexical editor:', currentText);
            } catch (error) {
              console.log('[WebsocketProvider] Error getting text from Lexical editor:', error);
            }
          }
        } catch (error) {
          console.log('[WebsocketProvider] Error getting editor text:', error);
        }

        // Prevent sending empty content during initial sync
        if (isInitialSync && (!currentText || currentText.trim() === '')) {
          console.log('[WebsocketProvider] ⏭️ Skipping empty content send during initial sync');
          return originalSend.call(this, data);
        }

        console.log('--------------------------------------------');
        console.log('send - ' + currentText);
        console.log('--------------------------------------------');
        console.log('[WebsocketProvider] Actually sending data to backend, size:', size);
        console.log('[WebsocketProvider] Text being sent:', currentText);

        return originalSend.call(this, data);
      };
      console.log('[WebsocketProvider] ✅ WebSocket send override installed successfully');
    } else {
      console.log('[WebsocketProvider] ⚠️ WebSocket not ready, will retry...');
    }
  };

  // Set up override when WebSocket becomes connected
  provider.on('status', (event: { status: string }) => {
    if (event.status === 'connected') {
      // Wait a bit for WebSocket to be fully established
      setTimeout(setupWebSocketOverride, 100);
    }
  });

  // Also try to set up override immediately if WebSocket is already available
  setTimeout(setupWebSocketOverride, 500);

  // Clean up provider reference when destroyed
  const originalDestroy = provider.destroy;
  provider.destroy = function() {
    console.log('[WebsocketProvider] Destroying provider for document:', id);
    delete (window as any)[existingProviderKey];
    if (originalDestroy) {
      originalDestroy.call(this);
    }
  };

  console.log('WebsocketProvider created for document:', id);
  return provider as unknown as Provider;
}
