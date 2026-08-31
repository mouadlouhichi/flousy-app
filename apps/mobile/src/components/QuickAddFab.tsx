import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Plus, X, Wallet, Receipt, PiggyBank, ScanLine } from 'lucide-react-native';

const TEAL = '#026462';

const ACTIONS = [
  { id: 'expense', label: 'Add Expense', Icon: Wallet },
  { id: 'charge', label: 'Add Fixed Charge', Icon: Receipt },
  { id: 'savings', label: 'Create Saving Goal', Icon: PiggyBank },
  { id: 'courses', label: 'Start course', Icon: ScanLine },
] as const;

export function QuickAddFab({ onAction }: { onAction: (id: (typeof ACTIONS)[number]['id']) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', right: 16, bottom: 96, alignItems: 'flex-end' }}
    >
      {open
        ? ACTIONS.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => {
                setOpen(false);
                onAction(a.id);
              }}
              className="mb-2 flex-row items-center"
            >
              <View className="mr-2 rounded-full border border-neutral-200 bg-white px-3 py-2.5">
                <Text className="text-sm font-semibold text-neutral-800">{a.label}</Text>
              </View>
              <View
                className="h-11 w-11 items-center justify-center rounded-full"
                style={{ backgroundColor: TEAL }}
              >
                <a.Icon size={18} color="#fff" />
              </View>
            </Pressable>
          ))
        : null}
      <Pressable
        onPress={() => setOpen((v) => !v)}
        className="h-14 w-14 items-center justify-center rounded-2xl"
        style={{
          backgroundColor: TEAL,
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        }}
      >
        {open ? <X size={26} color="#fff" /> : <Plus size={28} color="#fff" />}
      </Pressable>
    </View>
  );
}
