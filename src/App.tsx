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
    isCopyingDocumentId,
    isSavingContent,
    saveErrorMessage,
    isCreatingChild,
    isSelectingNodeId,
    isTogglingCollapseNodeId,
    isUpdatingLearningStatusNodeId,
    isRenamingNodeId,
    isDeletingNodeId,
    isCreatingDocumentFromNodeId,
    createDocumentFromNodeErrorMessage,
    isSavingViewport,
    saveViewport,
    loadDocuments,
    createDocument,
    openDocument,
    deleteDocument,
    copyDocument,
    autosaveSelectedNodeContent,
    createChildNode,
    selectNode,
    setNodeCollapsed,
    setNodeLearningStatus,
    renameNode,
    deleteLeafNode,
    createDocumentFromNode,
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
          isCopyingDocumentId={isCopyingDocumentId}
          onCopyDocument={copyDocument}
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
          isCreatingDocumentFromNodeId={isCreatingDocumentFromNodeId}
          createDocumentFromNodeErrorMessage={createDocumentFromNodeErrorMessage}
          onAutosaveContent={autosaveSelectedNodeContent}
          onCreateChildNode={createChildNode}
          onSelectNode={selectNode}
          onSetNodeCollapsed={setNodeCollapsed}
          onSetNodeLearningStatus={setNodeLearningStatus}
          onRenameNode={renameNode}
          onDeleteLeafNode={deleteLeafNode}
          onCreateDocumentFromNode={createDocumentFromNode}
          isSavingViewport={isSavingViewport}
          onSaveViewport={saveViewport}
          onDetailsMaximizedChange={setIsDetailsMaximized}
        />
      </main>
    </div>
  );
}