'use client';

import { useState } from 'react';
import {
  Megaphone,
  FileText,
  Video,
  MapPin,
  Share2,
  Palette,
  Lightbulb,
  Layers,
  PenTool,
  Target,
  Tag,
  X,
  Plus,
} from 'lucide-react';

// Service icon mapping
const SERVICE_ICONS: Record<string, typeof Megaphone> = {
  'campaign': Megaphone,
  'campaign strategy': Megaphone,
  'content': FileText,
  'content development': FileText,
  'video': Video,
  'video production': Video,
  'out-of-home': MapPin,
  'out-of-home creative': MapPin,
  'ooh': MapPin,
  'social': Share2,
  'social content': Share2,
  'branding': Palette,
  'brand strategy': Lightbulb,
  'brand identity': Palette,
  'brand support': Layers,
  'visual identity': PenTool,
  'brand guidelines': FileText,
  'messaging': FileText,
  'creative production': Layers,
  'strategy': Target,
};

function getServiceIcon(service: string) {
  const lowerService = service.toLowerCase();
  return SERVICE_ICONS[lowerService] || Layers;
}

interface ServiceBadgeProps {
  service: string;
  onRemove?: () => void;
  editable?: boolean;
}

export function ServiceBadge({ service, onRemove, editable = false }: ServiceBadgeProps) {
  const Icon = getServiceIcon(service);

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/15 text-blue-300 text-xs font-medium rounded-full">
      <Icon className="w-3 h-3" />
      {service}
      {editable && onRemove && (
        <button
          onClick={onRemove}
          className="ml-0.5 hover:text-blue-100 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}

interface TagBadgeProps {
  tag: string;
  onRemove?: () => void;
  editable?: boolean;
}

export function TagBadge({ tag, onRemove, editable = false }: TagBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-700/50 text-slate-400 text-xs rounded-full">
      <Tag className="w-2.5 h-2.5" />
      {tag}
      {editable && onRemove && (
        <button
          onClick={onRemove}
          className="ml-0.5 hover:text-slate-200 transition-colors"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </span>
  );
}

interface CaseStudyMetaProps {
  services: string[];
  tags: string[];
  isEditMode: boolean;
  onAddService?: (service: string) => void;
  onRemoveService?: (service: string) => void;
  onAddTag?: (tag: string) => void;
  onRemoveTag?: (tag: string) => void;
}

export function CaseStudyMeta({
  services,
  tags,
  isEditMode,
  onAddService,
  onRemoveService,
  onAddTag,
  onRemoveTag,
}: CaseStudyMetaProps) {
  const [newService, setNewService] = useState('');
  const [newTag, setNewTag] = useState('');

  const handleAddService = () => {
    if (newService.trim() && onAddService) {
      onAddService(newService.trim());
      setNewService('');
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && onAddTag) {
      onAddTag(newTag.trim());
      setNewTag('');
    }
  };

  return (
    <div className="space-y-4">
      {/* Services */}
      <div>
        <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
          Services
        </h3>
        <div className="flex flex-wrap gap-2">
          {services.map((service) => (
            <ServiceBadge
              key={service}
              service={service}
              editable={isEditMode}
              onRemove={() => onRemoveService?.(service)}
            />
          ))}
          {services.length === 0 && !isEditMode && (
            <span className="text-xs text-slate-500 italic">No services added</span>
          )}
        </div>

        {isEditMode && (
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              value={newService}
              onChange={(e) => setNewService(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddService()}
              placeholder="Add service..."
              className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
            <button
              onClick={handleAddService}
              disabled={!newService.trim()}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>
        )}
      </div>

      {/* Tags */}
      <div>
        <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
          Tags
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <TagBadge
              key={tag}
              tag={tag}
              editable={isEditMode}
              onRemove={() => onRemoveTag?.(tag)}
            />
          ))}
          {tags.length === 0 && !isEditMode && (
            <span className="text-xs text-slate-500 italic">No tags added</span>
          )}
        </div>

        {isEditMode && (
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
              placeholder="Add tag..."
              className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
            <button
              onClick={handleAddTag}
              disabled={!newTag.trim()}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
