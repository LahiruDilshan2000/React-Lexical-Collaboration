/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import {AutoFocusPlugin} from '@lexical/react/LexicalAutoFocusPlugin';
import {ContentEditable} from '@lexical/react/LexicalContentEditable';
import {LexicalErrorBoundary} from '@lexical/react/LexicalErrorBoundary';
import {RichTextPlugin} from '@lexical/react/LexicalRichTextPlugin';

import ToolbarPlugin from './plugins/ToolbarPlugin';
import TreeViewPlugin from './plugins/TreeViewPlugin';
import ImagesPlugin from './plugins/ImagePlugin';
import VideoPluginComponent from './plugins/VideoPlugin.tsx';
import CollaborativeTextPlugin from './plugins/CollaborativeTextPlugin';
// Temporarily disable boundary/debug/conflict plugins to avoid interference
// import TextBoundaryFixPlugin from './plugins/TextBoundaryFixPlugin';
// import YjsDebugPlugin from './plugins/YjsDebugPlugin';
// import YjsConflictPreventionPlugin from './plugins/YjsConflictPreventionPlugin';
import EditingGatePlugin from './plugins/EditingGatePlugin';

function Placeholder() {
  return <div className="editor-placeholder">Enter some rich text...</div>;
}

export default function Editor() {
  return (
    <div className="editor-container">
      <ToolbarPlugin />
      <div className="editor-inner">
        <RichTextPlugin
          contentEditable={<ContentEditable className="editor-input" />}
          placeholder={<Placeholder />}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <ImagesPlugin />
        <VideoPluginComponent />
        <CollaborativeTextPlugin />
        <EditingGatePlugin />
        {/** Disabled: boundary and conflict plugins while we verify persistence at edges */}
        <AutoFocusPlugin />
        <TreeViewPlugin />
      </div>
    </div>
  );
}

