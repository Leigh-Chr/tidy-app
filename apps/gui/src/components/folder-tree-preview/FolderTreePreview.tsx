/**
 * Folder Tree Preview Component
 *
 * Displays a visual preview of the folder structure that will be created
 * when using organize mode.
 */

import { useMemo } from "react";
import { Folder, File, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RenameProposal } from "@/lib/tauri";

export interface FolderTreePreviewProps {
  /** Proposals to build the tree from */
  proposals: RenameProposal[];
  /** Base directory */
  baseDirectory?: string;
  /** Maximum folders to display */
  maxFolders?: number;
  /** Maximum files per folder to display */
  maxFilesPerFolder?: number;
  /** Additional className */
  className?: string;
}

interface TreeNode {
  name: string;
  type: "folder" | "file";
  children: TreeNode[];
  count?: number;
  /** Unique ID for visibility tracking */
  id: string;
}

/**
 * Build a tree structure from proposals
 */
function buildTree(
  proposals: RenameProposal[],
  baseDirectory?: string,
  maxFilesPerFolder: number = 3
): TreeNode {
  const root: TreeNode = {
    id: "root",
    name: baseDirectory?.split(/[/\\]/).pop() ?? "root",
    type: "folder",
    children: [],
  };

  // Group proposals by destination folder
  const folderMap = new Map<string, RenameProposal[]>();

  for (const proposal of proposals) {
    if (proposal.isFolderMove && proposal.destinationFolder) {
      const folder = proposal.destinationFolder;
      if (!folderMap.has(folder)) {
        folderMap.set(folder, []);
      }
      folderMap.get(folder)!.push(proposal);
    }
  }

  // Build tree from folders
  for (const [folderPath, files] of folderMap) {
    const parts = folderPath.split("/").filter(Boolean);

    let current = root;
    let currentPath = "";
    for (const part of parts) {
      currentPath += "/" + part;
      let child = current.children.find((c) => c.name === part && c.type === "folder");
      if (!child) {
        child = { id: currentPath, name: part, type: "folder", children: [] };
        current.children.push(child);
      }
      current = child;
    }

    // Add files to the deepest folder
    const displayFiles = files.slice(0, maxFilesPerFolder);
    for (let i = 0; i < displayFiles.length; i++) {
      const file = displayFiles[i];
      current.children.push({
        id: `${currentPath}/file-${i}`,
        name: file.proposedName,
        type: "file",
        children: [],
      });
    }

    // Add count indicator if there are more files
    if (files.length > maxFilesPerFolder) {
      current.count = files.length;
    }
  }

  // Sort children (folders first, then alphabetically)
  const sortChildren = (node: TreeNode) => {
    node.children.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "folder" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    for (const child of node.children) {
      sortChildren(child);
    }
  };
  sortChildren(root);

  return root;
}

/**
 * Collect visible folder IDs up to maxFolders
 */
function getVisibleFolderIds(node: TreeNode, maxFolders: number): Set<string> {
  const visibleIds = new Set<string>();
  let folderCount = 0;

  function traverse(current: TreeNode, isRoot: boolean) {
    // Count non-root folders
    if (current.type === "folder" && !isRoot) {
      folderCount++;
      if (folderCount > maxFolders) {
        return;
      }
    }

    // This folder (and its files) are visible
    visibleIds.add(current.id);

    // Traverse children
    for (const child of current.children) {
      if (child.type === "folder") {
        traverse(child, false);
      } else {
        // Files are always visible if their parent folder is visible
        visibleIds.add(child.id);
      }
    }
  }

  traverse(node, true);
  return visibleIds;
}

/**
 * Render a tree node recursively
 */
function TreeNodeComponent({
  node,
  level = 0,
  visibleIds,
}: {
  node: TreeNode;
  level?: number;
  visibleIds: Set<string>;
}) {
  // Don't render if not visible
  if (!visibleIds.has(node.id)) {
    return null;
  }

  const visibleChildren = node.children.filter((c) => visibleIds.has(c.id));
  const hasChildren = visibleChildren.length > 0;
  const isFolder = node.type === "folder";
  const folderChildren = visibleChildren.filter((c) => c.type === "folder");
  const fileChildren = visibleChildren.filter((c) => c.type === "file");

  return (
    <div className={cn("select-none", level > 0 && "ml-4")}>
      <div className="flex items-center gap-1 py-0.5">
        {isFolder && hasChildren && (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        )}
        {isFolder && !hasChildren && (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        )}
        {isFolder ? (
          <Folder className="h-4 w-4 text-blue-500" />
        ) : (
          <File className="h-4 w-4 text-muted-foreground ml-4" />
        )}
        <span className={cn("text-sm", isFolder && "font-medium")}>
          {node.name}
        </span>
        {node.count && (
          <span className="text-xs text-muted-foreground ml-1">
            (+{node.count - 3} more)
          </span>
        )}
      </div>
      {hasChildren && (
        <div>
          {folderChildren.map((child) => (
            <TreeNodeComponent
              key={child.id}
              node={child}
              level={level + 1}
              visibleIds={visibleIds}
            />
          ))}
          {fileChildren.map((child) => (
            <TreeNodeComponent
              key={child.id}
              node={child}
              level={level + 1}
              visibleIds={visibleIds}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FolderTreePreview({
  proposals,
  baseDirectory,
  maxFolders = 8,
  maxFilesPerFolder = 3,
  className,
}: FolderTreePreviewProps) {
  // Only show proposals with folder moves
  const folderMoveProposals = useMemo(
    () => proposals.filter((p) => p.isFolderMove && p.destinationFolder),
    [proposals]
  );

  // Build tree
  const tree = useMemo(
    () => buildTree(folderMoveProposals, baseDirectory, maxFilesPerFolder),
    [folderMoveProposals, baseDirectory, maxFilesPerFolder]
  );

  // Pre-calculate which folders are visible
  const visibleIds = useMemo(
    () => getVisibleFolderIds(tree, maxFolders),
    [tree, maxFolders]
  );

  // Count unique folders
  const uniqueFolders = useMemo(() => {
    const folders = new Set<string>();
    for (const p of folderMoveProposals) {
      if (p.destinationFolder) {
        folders.add(p.destinationFolder);
      }
    }
    return folders.size;
  }, [folderMoveProposals]);

  // Count displayed folders (for showing "more" indicator)
  const displayedFolderCount = useMemo(() => {
    let count = 0;
    function countFolders(node: TreeNode, isRoot: boolean) {
      if (visibleIds.has(node.id) && node.type === "folder" && !isRoot) {
        count++;
      }
      for (const child of node.children) {
        countFolders(child, false);
      }
    }
    countFolders(tree, true);
    return count;
  }, [tree, visibleIds]);

  if (folderMoveProposals.length === 0) {
    return null;
  }

  const hasMoreFolders = uniqueFolders > displayedFolderCount;

  return (
    <div
      className={cn(
        "rounded-lg border bg-muted/30 p-3 text-sm",
        className
      )}
      data-testid="folder-tree-preview"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Folder Structure Preview
        </span>
        <span className="text-xs text-muted-foreground">
          {uniqueFolders} folder{uniqueFolders !== 1 ? "s" : ""}, {folderMoveProposals.length} file{folderMoveProposals.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="max-h-[200px] overflow-y-auto">
        <TreeNodeComponent
          node={tree}
          visibleIds={visibleIds}
        />
        {hasMoreFolders && (
          <div className="text-xs text-muted-foreground mt-2 ml-4">
            ... and {uniqueFolders - displayedFolderCount} more folder{uniqueFolders - displayedFolderCount !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}
