import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
} from 'react-native';
import { SUPPORTED_CURRENCIES } from '@flousy/core';

interface CurrencyModalProps {
  visible: boolean;
  onClose: () => void;
  selectedCurrency: string;
  onSelect: (code: string) => Promise<void>;
}

export function CurrencyModal({
  visible,
  onClose,
  selectedCurrency,
  onSelect,
}: CurrencyModalProps) {
  const [loadingCode, setLoadingCode] = useState<string | null>(null);

  const handleChoose = async (code: string) => {
    setLoadingCode(code);
    try {
      await onSelect(code);
      onClose();
    } finally {
      setLoadingCode(null);
    }
  };

  const codes = Object.keys(SUPPORTED_CURRENCIES);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-white dark:bg-neutral-900 rounded-t-3xl p-6 max-h-[80%]">
          <View className="flex-row justify-between items-center border-b border-neutral-200 dark:border-neutral-800 pb-4 mb-4">
            <Text className="text-xl font-bold text-neutral-900 dark:text-white">
              Select Currency
            </Text>
            <Pressable onPress={onClose}>
              <Text className="text-neutral-500 font-bold text-base">Close</Text>
            </Pressable>
          </View>

          <Text className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
            SmartJib formats your amounts using locale-aware Intl formatters for 12 currencies.
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} className="space-y-2">
            {codes.map((code) => {
              const curr = SUPPORTED_CURRENCIES[code];
              const active = code === selectedCurrency;
              const isSaving = loadingCode === code;

              return (
                <Pressable
                  key={code}
                  onPress={() => handleChoose(code)}
                  disabled={Boolean(loadingCode)}
                  className={`p-4 rounded-2xl border flex-row justify-between items-center ${
                    active
                      ? 'bg-primary/10 border-primary'
                      : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
                  }`}
                >
                  <View>
                    <View className="flex-row items-center space-x-2">
                      <Text className="text-base font-bold text-neutral-900 dark:text-white">
                        {code}
                      </Text>
                      <View className="bg-neutral-200 dark:bg-neutral-700 px-2 py-0.5 rounded-md">
                        <Text className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                          {curr.symbol}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {curr.name}
                    </Text>
                  </View>

                  {active ? (
                    <View className="bg-primary px-3 py-1 rounded-full">
                      <Text className="text-xs text-white font-bold">
                        {isSaving ? '...' : 'Active'}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
