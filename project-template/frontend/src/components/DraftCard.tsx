import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FolderOpen,
  List,
  CheckSquare,
  Loader2,
} from 'lucide-react';
import { DraftData, DraftSection, DraftItem } from '../types/conversation';

interface DraftCardProps {
  data: DraftData;
  onUpdateSection?: (sectionId: string, updates: Partial<DraftSection>) => void;
  onUpdateItem?: (sectionId: string, itemId: string, updates: Partial<DraftItem>) => void;
}

// Sub-item component
const SubItemRow: React.FC<{
  item: DraftItem;
  onUpdate?: (updates: Partial<DraftItem>) => void;
  isEditable?: boolean;
}> = ({ item, onUpdate, isEditable }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);

  const handleSave = () => {
    if (onUpdate && editName.trim() !== item.name) {
      onUpdate({ name: editName.trim() });
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setEditName(item.name);
      setIsEditing(false);
    }
  };

  return (
    <div className="flex items-center gap-2 py-1 pl-8 text-xs text-zinc-400 group">
      <CheckSquare size={12} className="opacity-50" />
      {isEditing ? (
        <input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          autoFocus
          className="flex-1 text-xs px-1 py-0.5 rounded border bg-zinc-800 border-cyan-500 text-zinc-100 outline-none"
        />
      ) : (
        <>
          <span className="flex-1">{item.name}</span>
          {isEditable && onUpdate && (
            <button
              onClick={() => setIsEditing(true)}
              className="opacity-0 group-hover:opacity-50 hover:!opacity-100 text-xs text-zinc-500"
            >
              edit
            </button>
          )}
        </>
      )}
    </div>
  );
};

// Item component
const ItemRow: React.FC<{
  item: DraftItem;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate?: (updates: Partial<DraftItem>) => void;
  isEditable?: boolean;
}> = ({ item, isExpanded, onToggle, onUpdate, isEditable }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const hasChildren = item.children && item.children.length > 0;

  const handleSave = () => {
    if (onUpdate && editName.trim() !== item.name) {
      onUpdate({ name: editName.trim() });
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setEditName(item.name);
      setIsEditing(false);
    }
  };

  return (
    <div className="mb-1">
      <div
        className="flex items-center gap-2 py-2 px-2 rounded cursor-pointer group hover:bg-zinc-800"
        onClick={() => !isEditing && onToggle()}
      >
        {hasChildren ? (
          isExpanded ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronRight size={14} />
          )
        ) : (
          <div className="w-3.5" />
        )}

        {isEditing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            className="flex-1 text-sm px-1 py-0.5 rounded border bg-zinc-800 border-cyan-500 text-zinc-100 outline-none"
          />
        ) : (
          <>
            <span className="flex-1 text-sm text-zinc-200">{item.name}</span>
            {isEditable && onUpdate && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
                className="opacity-0 group-hover:opacity-50 hover:!opacity-100 text-xs text-zinc-500"
              >
                edit
              </button>
            )}
          </>
        )}

        {hasChildren && !isEditing && (
          <span className="text-xs text-zinc-500">
            {item.children!.length} sub-item{item.children!.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {isExpanded &&
        item.children?.map((child) => (
          <SubItemRow
            key={child.id}
            item={child}
            isEditable={isEditable}
            onUpdate={
              onUpdate
                ? (updates) => {
                    const newChildren = item.children!.map((c) =>
                      c.id === child.id ? { ...c, ...updates } : c
                    );
                    onUpdate({ children: newChildren });
                  }
                : undefined
            }
          />
        ))}
    </div>
  );
};

// Section component
const SectionCard: React.FC<{
  section: DraftSection;
  isExpanded: boolean;
  onToggle: () => void;
  expandedItems: Set<string>;
  onToggleItem: (itemId: string) => void;
  onUpdateSection?: (updates: Partial<DraftSection>) => void;
  onUpdateItem?: (itemId: string, updates: Partial<DraftItem>) => void;
  isEditable?: boolean;
  isNew?: boolean;
}> = ({
  section,
  isExpanded,
  onToggle,
  expandedItems,
  onToggleItem,
  onUpdateSection,
  onUpdateItem,
  isEditable,
  isNew,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(section.name);

  const handleSave = () => {
    if (onUpdateSection && editName.trim() !== section.name) {
      onUpdateSection({ name: editName.trim() });
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setEditName(section.name);
      setIsEditing(false);
    }
  };

  return (
    <div
      className={`border border-zinc-700 rounded-lg overflow-hidden mb-3 transition-all ${
        isNew ? 'animate-pulse ring-1 ring-cyan-500/30' : ''
      }`}
    >
      <div
        className="flex items-center gap-2 p-3 cursor-pointer group bg-zinc-800/50 hover:bg-zinc-800"
        onClick={() => !isEditing && onToggle()}
      >
        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <List size={16} className="text-cyan-500" />

        {isEditing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            className="flex-1 font-medium text-sm px-1 py-0.5 rounded border bg-zinc-800 border-cyan-500 text-zinc-100 outline-none"
          />
        ) : (
          <>
            <span className="flex-1 font-medium text-sm text-zinc-100">{section.name}</span>
            {isEditable && onUpdateSection && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
                className="opacity-0 group-hover:opacity-50 hover:!opacity-100 text-xs text-zinc-500"
              >
                edit
              </button>
            )}
          </>
        )}

        <span className="text-xs text-zinc-500">
          {section.items.length} item{section.items.length !== 1 ? 's' : ''}
        </span>
      </div>

      {isExpanded && (
        <div className="p-2 pt-0">
          {section.items.length === 0 ? (
            <div className="text-xs text-zinc-500 text-center py-3 italic">
              No items in this section
            </div>
          ) : (
            section.items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                isExpanded={expandedItems.has(item.id)}
                onToggle={() => onToggleItem(item.id)}
                onUpdate={onUpdateItem ? (updates) => onUpdateItem(item.id, updates) : undefined}
                isEditable={isEditable}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

// Main DraftCard component
export const DraftCard: React.FC<DraftCardProps> = ({
  data,
  onUpdateSection,
  onUpdateItem,
}) => {
  const isEditable = !data.isSubmitted;
  const isBuilding = data.isBuilding === true;

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(data.sections.map((s) => s.id))
  );
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Track new sections for animation
  const seenSectionIds = useRef<Set<string>>(new Set());
  const [newSectionIds, setNewSectionIds] = useState<Set<string>>(new Set());

  // Auto-expand new sections
  useEffect(() => {
    const currentIds = new Set(data.sections.map((s) => s.id));
    const newIds = new Set<string>();

    currentIds.forEach((id) => {
      if (!seenSectionIds.current.has(id)) {
        newIds.add(id);
        seenSectionIds.current.add(id);
      }
    });

    if (newIds.size > 0) {
      setNewSectionIds((prev) => new Set([...prev, ...newIds]));
      setExpandedSections((prev) => new Set([...prev, ...newIds]));

      // Clear animation
      setTimeout(() => {
        setNewSectionIds((prev) => {
          const next = new Set(prev);
          newIds.forEach((id) => next.delete(id));
          return next;
        });
      }, 500);
    }
  }, [data.sections]);

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleItem = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="border border-zinc-700 rounded-lg overflow-hidden">
        <div className="bg-zinc-800/50 px-4 py-3 border-b border-zinc-700">
          <div className="flex items-center gap-2">
            <FolderOpen size={18} className="text-purple-500" />
            <h3 className="font-semibold text-zinc-100">{data.name}</h3>
          </div>
        </div>

        {data.description && (
          <div className="p-4">
            <p className="text-sm text-zinc-400">{data.description}</p>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="border border-zinc-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-zinc-100">{data.summary.totalSections}</div>
          <div className="text-xs uppercase tracking-wider text-zinc-500">Sections</div>
        </div>
        <div className="border border-zinc-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-zinc-100">{data.summary.totalItems}</div>
          <div className="text-xs uppercase tracking-wider text-zinc-500">Items</div>
        </div>
        <div className="border border-zinc-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-cyan-500">{data.summary.totalSubItems}</div>
          <div className="text-xs uppercase tracking-wider text-zinc-500">Sub-items</div>
        </div>
      </div>

      {/* Sections */}
      <div>
        <div className="flex items-center gap-2 mb-2 text-zinc-500 text-xs uppercase tracking-wider">
          <List size={12} />
          <span>Sections</span>
        </div>

        {data.sections.length === 0 ? (
          <div className="border border-zinc-700 rounded-lg p-4 text-center text-zinc-500 text-sm italic">
            {isBuilding ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin text-cyan-500" />
                <span>Building structure...</span>
              </div>
            ) : (
              'No sections defined yet'
            )}
          </div>
        ) : (
          data.sections.map((section) => (
            <SectionCard
              key={section.id}
              section={section}
              isExpanded={isBuilding || expandedSections.has(section.id)}
              onToggle={() => toggleSection(section.id)}
              expandedItems={expandedItems}
              onToggleItem={toggleItem}
              onUpdateSection={
                onUpdateSection ? (updates) => onUpdateSection(section.id, updates) : undefined
              }
              onUpdateItem={
                onUpdateItem ? (itemId, updates) => onUpdateItem(section.id, itemId, updates) : undefined
              }
              isEditable={isEditable}
              isNew={newSectionIds.has(section.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};
