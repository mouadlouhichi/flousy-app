import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, PlusCircle, Wallet, Receipt, PiggyBank, ScanLine } from 'lucide-react-native';
import { emitQuickAction, type QuickActionId } from '../lib/quick-actions';
import { fabBottom } from '../lib/chrome';

const TEAL = '#00685f';

const ACTIONS: { id: QuickActionId; label: string; Icon: typeof Wallet }[] = [
  { id: 'expense', label: 'Add Expense', Icon: Wallet },
  { id: 'charge', label: 'Add Fixed Charge', Icon: Receipt },
  { id: 'savings', label: 'Create Saving Goal', Icon: PiggyBank },
  { id: 'courses', label: 'Start course', Icon: ScanLine },
];

/**
 * Web open menu: one rounded-full chip per action
 * `flex items-center gap-2 rounded-full bg-surface/95 px-3 py-2
 *  shadow-[0_10px_30px_rgba(0,0,0,0.18)] border border-outline-variant`
 * with the 40px primary icon inside the chip (not a separate circle).
 */
export function QuickAddFab() {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const bottom = fabBottom(insets.bottom);

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', right: 20, bottom, alignItems: 'flex-end', zIndex: 50 }}>
      {open
        ? ACTIONS.map((action) => {
            const Icon = action.Icon;
            return (
              <Pressable
                key={action.id}
                onPress={() => {
                  setOpen(false);
                  emitQuickAction(action.id);
                }}
                className="mb-2 flex-row items-center rounded-full border border-neutral-200 bg-white/95 py-2 pl-3 pr-2"
                style={{
                  shadowColor: '#000',
                  shadowOpacity: 0.18,
                  shadowRadius: 15,
                  shadowOffset: { width: 0, height: 10 },
                  elevation: 10,
                }}
              >
                <Text className="mr-2 text-xs font-semibold text-neutral-800">{action.label}</Text>
                <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: TEAL }}>
                  <Icon size={18} color="#fff" />
                </View>
              </Pressable>
            );
          })
        : null}
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityLabel={open ? 'Close quick actions' : 'Open quick actions'}
        className="h-14 w-14 items-center justify-center rounded-2xl"
        style={{
          backgroundColor: TEAL,
          shadowColor: '#00685f',
          shadowOpacity: 0.35,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 8 },
          elevation: 12,
        }}
      >
        {open ? (
          <Plus size={24} color="#fff" strokeWidth={2.5} />
        ) : (
          <PlusCircle size={24} color="#fff" strokeWidth={2} />
        )}
      </Pressable>
    </View>
  );
}
