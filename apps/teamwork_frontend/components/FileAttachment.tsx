import React from 'react';
import { FileText, FileCode, File, Image, X } from 'lucide-react';
import { FileAttachment as FileAttachmentType } from '../types/conversation';

interface FileAttachmentProps {
  file: FileAttachmentType;
  theme?: 'light' | 'dark';
  onRemove?: (id: string) => void;
  showSize?: boolean;
}

const getFileIcon = (type: string) => {
  if (type.startsWith('image/')) return Image;
  if (type.includes('text') || type.includes('markdown')) return FileText;
  if (type.includes('json') || type.includes('javascript') || type.includes('typescript')) return FileCode;
  return File;
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileColor = (type: string, isLight: boolean): string => {
  if (type.startsWith('image/')) return isLight ? 'text-purple-600' : 'text-purple-400';
  if (type.includes('pdf')) return isLight ? 'text-red-600' : 'text-red-400';
  if (type.includes('text') || type.includes('markdown')) return isLight ? 'text-blue-600' : 'text-blue-400';
  if (type.includes('json') || type.includes('javascript') || type.includes('typescript')) return isLight ? 'text-amber-600' : 'text-amber-400';
  return isLight ? 'text-zinc-600' : 'text-zinc-400';
};

export const FileAttachmentChip: React.FC<FileAttachmentProps> = ({
  file,
  theme = 'dark',
  onRemove,
  showSize = true,
}) => {
  const isLight = theme === 'light';
  const FileIcon = getFileIcon(file.type);
  const iconColor = getFileColor(file.type, isLight);
  
  const chipBg = isLight ? 'bg-zinc-100' : 'bg-zinc-800';
  const chipBorder = isLight ? 'border-zinc-300' : 'border-zinc-700';
  const textPrimary = isLight ? 'text-zinc-700' : 'text-zinc-200';
  const textSecondary = isLight ? 'text-zinc-500' : 'text-zinc-500';
  
  return (
    <div className={`
      inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border
      ${chipBg} ${chipBorder}
      transition-all duration-150 hover:shadow-sm
    `}>
      <FileIcon size={14} className={iconColor} />
      
      <div className="flex flex-col min-w-0">
        <span className={`text-xs font-medium ${textPrimary} truncate max-w-[120px]`}>
          {file.name}
        </span>
        {showSize && (
          <span className={`text-[10px] ${textSecondary}`}>
            {formatFileSize(file.size)}
          </span>
        )}
      </div>
      
      {onRemove && (
        <button
          onClick={() => onRemove(file.id)}
          className={`
            p-0.5 rounded-full transition-colors
            ${isLight ? 'hover:bg-zinc-200' : 'hover:bg-zinc-700'}
            ${textSecondary} hover:text-red-500
          `}
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
};

interface FileAttachmentsBarProps {
  files: FileAttachmentType[];
  theme?: 'light' | 'dark';
  onRemove?: (id: string) => void;
}

export const FileAttachmentsBar: React.FC<FileAttachmentsBarProps> = ({
  files,
  theme = 'dark',
  onRemove,
}) => {
  const isLight = theme === 'light';
  
  if (files.length === 0) return null;
  
  return (
    <div className={`
      flex flex-wrap gap-2 p-2 rounded-lg mb-2
      ${isLight ? 'bg-zinc-50 border border-zinc-200' : 'bg-zinc-900/50 border border-zinc-800'}
    `}>
      {files.map(file => (
        <FileAttachmentChip
          key={file.id}
          file={file}
          theme={theme}
          onRemove={onRemove}
          showSize={true}
        />
      ))}
    </div>
  );
};
