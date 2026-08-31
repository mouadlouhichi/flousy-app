import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, X, Wallet, Receipt, PiggyBank, ScanLine } from 'lucide-react-native';
import { emitQuickAction, type QuickActionId } from '../lib/quick-actions';
import { fabBottom } from '../lib/chrome';

const TEAL = '#026462';

const ACTIONS: { id: QuickActionId; label: string; Icon: typeof Wallet }[] = [
  { id: 'expense', label: 'Add Expense', Icon: Wallet },
  { id: 'charge', label: 'Add Fixed Charge', Icon: Receipt },
  { id: 'savings', label: 'Create Saving Goal', Icon: PiggyBank },
  { id: 'courses', label: 'Start course', Icon: ScanLine },
];

/** Web: `fixed bottom-22 right-5 h-14 w-14 rounded-2xl` + `AppIcon add` at 30px. */
export function QuickAddFab() {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const bottom = fabBottom(insets.bottom);

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', right: 20, bottom, alignItems: 'flex-end', zIndex: 50 }}>
      {open
        ? ACTIONS.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => {
                setOpen(false);
                emitQuickAction(a.id);
              }}
              className="mb-2 flex-row items-center"
            >
              <View className="mr-2 rounded-full border border-neutral-200 bg-white/95 px-3 py-2">
                <Text className="text-sm font-semibold text-neutral-800">{a.label}</Text>
              </View>
              <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: TEAL }}>
                <a.Icon size={18} color="#fff" />
              </View>
            </Pressable>
          ))
        : null}
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityLabel="Open quick actions"
        className="h-14 w-14 items-center justify-center rounded-2xl"
        style={{
          backgroundColor: TEAL,
          shadowColor: '#00685f',
          shadowOpacity: 0.35,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 8 },
          elevation: 10,
        }}
      >
        {open ? (
          <X size={22} color="#fff" strokeWidth={2.25} />
        ) : (
          <Plus size={30} color="#fff" strokeWidth={2.25} />
        )}
      </Pressable>
    </View>
  );
}
