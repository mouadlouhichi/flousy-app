import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlusCircle, X, Banknote, Receipt, PiggyBank, ScanLine } from 'lucide-react-native';
import { emitQuickAction, type QuickActionId } from '../lib/quick-actions';
import { fabBottom } from '../lib/chrome';

const TEAL = '#00685f';

const ACTIONS: { id: QuickActionId; label: string; Icon: typeof Banknote }[] = [
  { id: 'expense', label: 'Add Expense', Icon: Banknote },
  { id: 'charge', label: 'Add Charge', Icon: Receipt },
  { id: 'savings', label: 'New Savings Goal', Icon: PiggyBank },
  { id: 'courses', label: 'Start Course', Icon: ScanLine },
];

/**
 * Web `QuickActions`:
 * `fixed bottom-22 right-5 z-40 h-14 w-14 bg-primary rounded-2xl`
 * `shadow-[0_8px_24px_rgba(0,104,95,0.35)]`
 * `AppIcon add` = CirclePlus / PlusCircle at `text-[30px]`
 * open: close (X) + rotate-45
 */
export function QuickAddFab() {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const bottom = fabBottom(insets.bottom);

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', right: 20, bottom, alignItems: 'flex-end', zIndex: 50 }}>
      {open}
        ? ACTIONS.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => {
                setOpen(false);
                emitQuickAction(a.id);
              }}
              className="mb-2 flex-row items-center"
            >
              <View
                className="mr-2 rounded-full border border-neutral-200 bg-white/95 px-3 py-2"
                style={{
                  shadowColor: '#000',
                  shadowOpacity: 0.18,
                  shadowRadius: 15,
                  shadowOffset: { width: 0, height: 10 },
                  elevation: 8,
                }}
              >
                <Text className="text-xs font-semibold text-neutral-800">{a.label}</Text>
              </View>
              <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: TEAL }}>
                <a.Icon size={18} color="#fff" />
              </View>
            </Pressable>
          ))
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
          <X size={30} color="#fff" strokeWidth={2} style={{ transform: [{ rotate: '45deg' }] }} />
        ) : (
          <PlusCircle size={30} color="#fff" strokeWidth={2} />
        )}
      </Pressable>
    </View>
  );
}
