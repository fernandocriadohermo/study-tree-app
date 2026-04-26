import { useState } from 'react';
import './App.css';
import { DocumentsSidebar } from './features/documents/components/DocumentsSidebar';
import { useDocumentsHome } from './features/documents/hooks/useDocumentsHome';
import { RootTreePanel } from './features/tree/components/RootTreePanel';

export default function App() {
  const [isDetailsMaximized, setIsDetailsMaximized] = useState(false);

  const {
    documents,
    openedSnapshot,
    activeDocumentId,
    status,
    errorMessage,
    isCreating,
    isOpeningDocumentId,
    isDeletingDocumentId,
    isSavingContent,
    saveErrorMessage,
    isCreatingChild,
    isSelectingNodeId,
    isTogglingCollapseNodeId,
    isUpdatingLearningStatusNodeId,
    isRenamingNodeId,
    isDeletingNodeId,
    isSavingViewport,
    saveViewport,
    loadDocuments,
    createDocument,
    openDocument,
    deleteDocument,
    autosaveSelectedNodeContent,
    createChildNode,
    selectNode,
    setNodeCollapsed,
    setNodeLearningStatus,
    renameNode,
    deleteLeafNode,
  } = useDocumentsHome();

  return (
    <div className={`app-shell${isDetailsMaximized ? ' app-shell--details-maximized' : ''}`}>
      {!isDetailsMaximized ? (
        <DocumentsSidebar
          documents={documents}
          activeDocumentId={activeDocumentId}
          status={status}
          errorMessage={errorMessage}
          isCreating={isCreating}
          isOpeningDocumentId={isOpeningDocumentId}
          isDeletingDocumentId={isDeletingDocumentId}
          onRetry={loadDocuments}
          onCreateDocument={createDocument}
          onOpenDocument={openDocument}
          onDeleteDocument={deleteDocument}
        />
      ) : null}

      <main className="workspace">
        <RootTreePanel
          snapshot={openedSnapshot}
          isSavingContent={isSavingContent}
          saveErrorMessage={saveErrorMessage}
          isCreatingChild={isCreatingChild}
          isSelectingNodeId={isSelectingNodeId}
          isTogglingCollapseNodeId={isTogglingCollapseNodeId}
          isUpdatingLearningStatusNodeId={isUpdatingLearningStatusNodeId}
          isRenamingNodeId={isRenamingNodeId}
          isDeletingNodeId={isDeletingNodeId}
          onAutosaveContent={autosaveSelectedNodeContent}
          onCreateChildNode={createChildNode}
          onSelectNode={selectNode}
          onSetNodeCollapsed={setNodeCollapsed}
          onSetNodeLearningStatus={setNodeLearningStatus}
          onRenameNode={renameNode}
          onDeleteLeafNode={deleteLeafNode}
          isSavingViewport={isSavingViewport}
          onSaveViewport={saveViewport}
          onDetailsMaximizedChange={setIsDetailsMaximized}
        />
      </main>
    </div>
  );
}