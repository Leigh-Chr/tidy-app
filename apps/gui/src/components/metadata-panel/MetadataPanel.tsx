/**
 * Metadata Panel Component
 *
 * Displays detailed metadata for a file organized by category:
 * - File System metadata (always available)
 * - EXIF metadata (for images with full capability)
 * - PDF properties (for documents with basic capability)
 *
 * Story 6.5 - Task 7: Enhance Metadata Display
 */

import { Badge } from "@/components/ui/badge";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FileInfo, MetadataCapability } from "@/lib/tauri";
import {
  FileText,
  HardDrive,
  ImageIcon,
  Camera,
  FileSearch,
} from "lucide-react";

/** Props for the MetadataPanel component */
export interface MetadataPanelProps {
  /** File to display metadata for */
  file: FileInfo;
  /** Additional CSS classes */
  className?: string;
}

/** Capability display configuration */
const CAPABILITY_DISPLAY: Record<
  MetadataCapability,
  { label: string; color: string }
> = {
  none: { label: "None", color: "bg-gray-100 text-gray-700" },
  basic: { label: "Basic", color: "bg-blue-100 text-blue-700" },
  extended: { label: "Extended", color: "bg-green-100 text-green-700" },
  full: { label: "Full", color: "bg-purple-100 text-purple-700" },
};

/** Format date for display */
function formatDate(isoString: string): string {
  if (!isoString) return "Not available";
  try {
    const date = new Date(isoString);
    return date.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "Not available";
  }
}

/** Metadata row component */
function MetadataRow({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId?: string;
}) {
  return (
    <div className="flex py-1">
      <dt
        className="w-28 text-muted-foreground flex-shrink-0"
        role="term"
        aria-label={label}
      >
        {label}
      </dt>
      <dd
        className="flex-1 font-mono text-sm truncate"
        data-testid={testId}
        title={value}
      >
        {value || "Not available"}
      </dd>
    </div>
  );
}

/** Section header component */
function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: React.ElementType;
  title: string;
}) {
  return (
    <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2 mt-4 first:mt-0">
      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      {title}
    </h4>
  );
}

/**
 * MetadataPanel component for displaying file metadata
 *
 * Features:
 * - File system metadata (name, size, dates, category)
 * - Metadata capability indicator
 * - Placeholder sections for EXIF and PDF metadata
 * - Graceful handling of missing data
 */
export function MetadataPanel({ file, className }: MetadataPanelProps) {
  const capabilityConfig = CAPABILITY_DISPLAY[file.metadataCapability];
  const isImage = file.category === "image";
  const isPdf = file.extension.toLowerCase() === "pdf";
  const hasImageMetadata = isImage && file.metadataCapability === "full";
  const hasPdfMetadata =
    isPdf && file.metadataSupported && file.metadataCapability !== "none";

  return (
    <div
      className={cn("text-sm", className)}
      data-testid="metadata-panel"
    >
      <dl className="space-y-1">
        {/* File System Metadata - Always available */}
        <SectionHeader icon={HardDrive} title="File System" />
        <MetadataRow label="Filename" value={file.fullName} />
        <MetadataRow label="Path" value={file.path} />
        <MetadataRow label="Size" value={formatBytes(file.size)} />
        <MetadataRow label="Extension" value={file.extension} />
        <MetadataRow label="Category" value={file.category} />
        <MetadataRow
          label="Created"
          value={formatDate(file.createdAt)}
          testId="metadata-created"
        />
        <MetadataRow
          label="Modified"
          value={formatDate(file.modifiedAt)}
          testId="metadata-modified"
        />

        {/* Metadata Capability */}
        <SectionHeader icon={FileSearch} title="Metadata Capability" />
        <div className="flex py-1">
          <dt className="w-28 text-muted-foreground flex-shrink-0">Level</dt>
          <dd>
            <Badge
              variant="secondary"
              className={cn("font-normal", capabilityConfig.color)}
              data-testid="metadata-capability-badge"
            >
              {capabilityConfig.label}
            </Badge>
          </dd>
        </div>
        {!file.metadataSupported && (
          <p className="text-xs text-muted-foreground mt-1">
            Extended metadata extraction is not available for this file type.
          </p>
        )}

        {/* EXIF Metadata - For images with full capability */}
        {hasImageMetadata && (
          <div data-testid="exif-metadata-section">
            <SectionHeader icon={Camera} title="EXIF Data" />
            <p className="text-xs text-muted-foreground py-1">
              EXIF metadata extraction will be available in a future update.
            </p>
            {/* Placeholder for future EXIF fields:
            <MetadataRow label="Camera" value="" />
            <MetadataRow label="Date Taken" value="" />
            <MetadataRow label="Dimensions" value="" />
            <MetadataRow label="Aperture" value="" />
            <MetadataRow label="Shutter Speed" value="" />
            <MetadataRow label="ISO" value="" />
            */}
          </div>
        )}

        {/* PDF Metadata - For PDFs with basic+ capability */}
        {hasPdfMetadata && (
          <div data-testid="pdf-metadata-section">
            <SectionHeader icon={FileText} title="PDF Properties" />
            <p className="text-xs text-muted-foreground py-1">
              PDF metadata extraction will be available in a future update.
            </p>
            {/* Placeholder for future PDF fields:
            <MetadataRow label="Title" value="" />
            <MetadataRow label="Author" value="" />
            <MetadataRow label="Subject" value="" />
            <MetadataRow label="Creator" value="" />
            <MetadataRow label="Pages" value="" />
            */}
          </div>
        )}

        {/* Image indicator for non-full capability */}
        {isImage && !hasImageMetadata && file.metadataSupported && (
          <div data-testid="exif-metadata-section">
            <SectionHeader icon={ImageIcon} title="Image Info" />
            <p className="text-xs text-muted-foreground py-1">
              Limited image metadata available for this format.
            </p>
          </div>
        )}
      </dl>
    </div>
  );
}
