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
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 8,
                  paddingVertical: 8,
                  paddingLeft: 12,
                  paddingRight: 8,
                  borderRadius: 999,
                  backgroundColor: '#F5FAF8',
                  borderWidth: 1,
                  borderColor: '#BCC9C6',
                  overflow: 'hidden',
                  shadowColor: '#000',
                  shadowOpacity: 0.18,
                  shadowRadius: 15,
                  shadowOffset: { width: 0, height: 10 },
                  elevation: 10,
                }}
              >
                <Text className="mr-2 text-xs font-semibold text-neutral-800">{action.label}</Text>
                <View
                  style={{
                    height: 40,
                    width: 40,
                    borderRadius: 20,
                    backgroundColor: TEAL,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
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
