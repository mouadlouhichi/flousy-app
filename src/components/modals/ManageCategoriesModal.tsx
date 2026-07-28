import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { CustomInput } from '../ui/CustomInput';
import { customCategorySchema } from '../../lib/validation';

interface ManageCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: string[];
  categoryColors: Record<string, string>;
  categoryIcons: Record<string, string>;
  onAddCategory: (name: string, color: string, icon: string) => void;
  onRemoveCategory: (name: string) => void;
}

const RANDOM_COLORS = [
  '#00685f', '#b05e3d', '#3b82f6', '#8b5cf6',
  '#ec4899', '#f97316', '#10b981', '#eab308',
  '#ef4444', '#06b6d4', '#6366f1', '#84cc16',
  '#f43f5e', '#a855f7', '#14b8a6', '#d946ef',
];

const PRESET_ICONS = [
  'restaurant', 'directions_car', 'home', 'sports_esports',
  'favorite', 'bolt', 'local_dining', 'shopping_bag',
  'movie', 'fitness_center', 'flight', 'pets',
  'school', 'work', 'build', 'card_giftcard',
];

function getRandomColor(existingColors: Record<string, string>): string {
  const usedColors = new Set(Object.values(existingColors));
  const available = RANDOM_COLORS.filter((c) => !usedColors.has(c));
  const pool = available.length > 0 ? available : RANDOM_COLORS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function ManageCategoriesModal({
  isOpen,
  onClose,
  categories,
  categoryColors,
  categoryIcons,
  onAddCategory,
  onRemoveCategory,
}: ManageCategoriesModalProps) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('shopping_bag');
  const [error, setError] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const randomColor = getRandomColor(categoryColors);
    const valRes = customCategorySchema.safeParse({ name, color: randomColor, icon });

    if (!valRes.success) {
      const firstErr = valRes.error.issues?.[0]?.message || (valRes.error as any).errors?.[0]?.message || 'Invalid category data';
      setError(firstErr);
      return;
    }

    if (categories.includes(name.trim())) {
      setError('A category with this name already exists');
      return;
    }

    onAddCategory(name.trim(), randomColor, icon);
    setName('');
    setError('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Custom Categories">
      <div className="flex flex-col gap-5">
        {/* ── Active Categories ── */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
            Active Categories ({categories.length})
          </span>
          <div className="flex flex-wrap gap-2 p-3 bg-surface-container rounded-2xl border border-outline-variant min-h-[60px]">
            {categories.map((cat) => (
              <div
                key={cat}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-outline-variant font-label-md text-label-md text-on-surface"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: categoryColors[cat] || '#00685f' }}
                />
                <span className="text-[13px] font-medium">{cat}</span>
                <button
                  type="button"
                  onClick={() => onRemoveCategory(cat)}
                  className="p-0.5 text-on-surface-variant hover:text-error rounded-full ml-0.5 transition-colors"
                  aria-label={`Remove category ${cat}`}
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Add New Category ── */}
        <form onSubmit={handleAdd} className="p-4 bg-surface-container/60 rounded-2xl border border-dashed border-outline-variant flex flex-col gap-3">
          <span className="text-[11px] font-extrabold tracking-wider text-primary uppercase">
            Add New Category
          </span>

          <CustomInput
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
            placeholder="Category Name e.g. Gym, Pets, Travel"
            error={error}
          />

          {/* Icon Picker */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
              Icon
            </span>
            <div className="grid grid-cols-8 gap-1 max-h-[100px] overflow-y-auto">
              {PRESET_ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  className={`p-2 rounded-lg flex items-center justify-center transition-colors ${
                    icon === ic
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container text-on-surface-variant hover:bg-surface-variant'
                  }`}
                  aria-label={`Icon ${ic}`}
                >
                  <span className="material-symbols-outlined text-[20px]">{ic}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-primary text-on-primary font-bold text-[14px] py-2.5 rounded-xl hover:bg-primary/90 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Add Category</span>
          </button>
        </form>
      </div>
    </Modal>
  );
}
