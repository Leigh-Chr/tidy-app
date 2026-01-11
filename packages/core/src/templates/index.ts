export {
  parseTemplate,
  extractPlaceholders,
  isKnownPlaceholder,
  getKnownPlaceholders,
  getUnknownPlaceholders,
  type ParseError,
} from './parser.js';

export {
  resolveDatePlaceholder,
  isDatePlaceholder,
  getDatePlaceholders,
  type DatePlaceholder,
  resolveMetadataPlaceholder,
  isMetadataPlaceholder,
  getMetadataPlaceholders,
  type MetadataPlaceholder,
  resolveFilePlaceholder,
  isFilePlaceholder,
  getFilePlaceholders,
  type FilePlaceholder,
} from './resolvers/index.js';

export { sanitizeFilename, isValidFilename, formatBytes, parseBytes } from './utils/index.js';

// Template Manager (Story 3.5)
export {
  createInitialStore,
  createTemplate,
  getTemplate,
  getTemplateByName,
  updateTemplate,
  deleteTemplate,
  listTemplates,
  setDefaultTemplate,
  clearDefaultTemplate,
  getDefaultForFileType,
  setGlobalDefault,
  resolveTemplateForFile,
  validateStore,
  repairStore,
  type TemplateManagerError,
  type StoreValidationIssue,
} from './manager.js';

// Template Validator (Story 3.6)
export {
  validateTemplate,
  isValidTemplate,
  getTemplateErrors,
  getTemplateWarnings,
  getTemplateInfo,
  formatValidationResult,
} from './validator.js';

// Template Preview (Story 3.7)
export {
  previewFile,
  previewFiles,
  formatPreviewResult,
  formatBatchPreview,
  type PreviewError,
} from './preview.js';
