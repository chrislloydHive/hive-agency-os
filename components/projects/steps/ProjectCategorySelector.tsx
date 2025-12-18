'use client';

// components/projects/steps/ProjectCategorySelector.tsx
// Step 1: Select project category

import * as LucideIcons from 'lucide-react';
import {
  getActiveCategories,
  PROJECT_CATEGORY_INFO,
  type ProjectCategory,
} from '@/lib/projects/projectTypeRegistry';

interface ProjectCategorySelectorProps {
  selectedCategory: ProjectCategory | null;
  onSelectCategory: (category: ProjectCategory) => void;
}

export function ProjectCategorySelector({
  selectedCategory,
  onSelectCategory,
}: ProjectCategorySelectorProps) {
  const categories = getActiveCategories();

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-medium text-white mb-1">
          What type of project are you starting?
        </h3>
        <p className="text-sm text-slate-400">
          Select a category to see available project types
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {categories.map((category) => {
          const info = PROJECT_CATEGORY_INFO[category];
          const IconComponent = LucideIcons[info.icon as keyof typeof LucideIcons] as React.ComponentType<{ className?: string }>;
          const isSelected = selectedCategory === category;

          return (
            <button
              key={category}
              onClick={() => onSelectCategory(category)}
              className={`
                relative p-4 rounded-xl border-2 text-left transition-all
                ${isSelected
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-slate-700 hover:border-slate-600 bg-slate-800/50 hover:bg-slate-800'
                }
              `}
            >
              {/* Selected indicator */}
              {isSelected && (
                <div className="absolute top-3 right-3">
                  <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
                    <LucideIcons.Check className="w-3 h-3 text-white" />
                  </div>
                </div>
              )}

              {/* Icon */}
              <div
                className={`
                  w-10 h-10 rounded-lg flex items-center justify-center mb-3
                  ${isSelected ? 'bg-purple-500/20' : 'bg-slate-700/50'}
                `}
              >
                {IconComponent && (
                  <IconComponent
                    className={`w-5 h-5 ${isSelected ? 'text-purple-400' : 'text-slate-400'}`}
                  />
                )}
              </div>

              {/* Text */}
              <h4 className={`font-semibold mb-1 ${isSelected ? 'text-purple-300' : 'text-white'}`}>
                {info.label}
              </h4>
              <p className="text-xs text-slate-400 line-clamp-2">
                {info.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ProjectCategorySelector;
