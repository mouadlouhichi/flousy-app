import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Sheet } from './Sheet';
import {
  type VariableExpense,
  type FixedExpense,
  type MoneyPlace,
  type MonthBudget,
} from '@flousy/core';

interface ImportCsvModalProps {
  visible: boolean;
  onClose: () => void;
  month: MonthBudget;
  onImportVariable: (expenses: VariableExpense[]) => Promise<void>;
  onImportFixed: (bills: FixedExpense[]) => Promise<void>;
}

export function ImportCsvModal({
  visible,
  onClose,
  month,
  onImportVariable,
  onImportFixed,
}: ImportCsvModalProps) {
  const [csvText, setCsvText] = useState('');
  const [targetType, setTargetType] = useState<'variable' | 'fixed'>('variable');
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    if (!csvText.trim()) {
      Alert.alert('Empty CSV', 'Please paste CSV content with a header row and data rows.');
      return;
    }

    setLoading(true);
    try {
      const lines = csvText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      if (lines.length < 2) {
        Alert.alert('Invalid CSV', 'CSV must contain a header row and at least one data row.');
        return;
      }

      const parseLine = (line: string): string[] => {
        const result: string[] = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(cur.trim().replace(/^"|"$/g, ''));
            cur = '';
          } else {
            cur += char;
          }
        }
        result.push(cur.trim().replace(/^"|"$/g, ''));
        return result;
      };

      const header = parseLine(lines[0]).map((h) => h.toLowerCase());

      if (targetType === 'variable') {
        const newExpenses: VariableExpense[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = parseLine(lines[i]);
          if (cols.length < 2) continue;

          let name = 'Imported Expense';
          let amount = 0;
          let date = new Date().toISOString().slice(0, 10);
          let category = month.activeCategories?.[0] || 'Other';
          let place: MoneyPlace = 'bank';
          let note = '';
          let person = '';

          cols.forEach((col, idx) => {
            const colName = header[idx] || '';
            if (colName.includes('name') || colName.includes('desc') || colName.includes('item')) {
              name = col || name;
            } else if (
              colName.includes('amount') ||
              colName.includes('price') ||
              colName.includes('val')
            ) {
              const parsedAmt = parseFloat(col.replace(/[^0-9.-]/g, ''));
              if (!isNaN(parsedAmt)) amount = Math.abs(parsedAmt);
            } else if (colName.includes('date')) {
              if (col.length >= 8) date = col;
            } else if (colName.includes('cat') || colName.includes('type')) {
              category = col || category;
            } else if (colName.includes('place') || colName.includes('account')) {
              const lower = col.toLowerCase();
              if (lower.includes('home') || lower.includes('cash')) place = 'home';
              else if (lower.includes('wallet')) place = 'wallet';
              else place = 'bank';
            } else if (colName.includes('person') || colName.includes('member')) {
              person = col;
            } else if (colName.includes('note')) {
              note = col;
            }
          });

          if (amount > 0) {
            newExpenses.push({
              id: `csv-var-${Date.now()}-${i}`,
              name,
              amount,
              type: category,
              date,
              place,
              person: person || undefined,
              note: note || undefined,
            });
          }
        }

        await onImportVariable(newExpenses);
        Alert.alert('Import Complete', `Imported ${newExpenses.length} variable expenses.`);
      } else {
        const newBills: FixedExpense[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = parseLine(lines[i]);
          if (cols.length < 2) continue;

          let name = 'Imported Bill';
          let amount = 0;
          let date = new Date().toISOString().slice(0, 10);
          let place: MoneyPlace = 'bank';

          cols.forEach((col, idx) => {
            const colName = header[idx] || '';
            if (colName.includes('name') || colName.includes('desc') || colName.includes('item')) {
              name = col || name;
            } else if (colName.includes('amount') || colName.includes('val')) {
              const parsedAmt = parseFloat(col.replace(/[^0-9.-]/g, ''));
              if (!isNaN(parsedAmt)) amount = Math.abs(parsedAmt);
            } else if (colName.includes('date')) {
              if (col.length >= 8) date = col;
            } else if (colName.includes('place') || colName.includes('account')) {
              const lower = col.toLowerCase();
              if (lower.includes('home')) place = 'home';
              else if (lower.includes('wallet')) place = 'wallet';
              else place = 'bank';
            }
          });

          if (amount > 0) {
            newBills.push({
              id: `csv-fix-${Date.now()}-${i}`,
              name,
              amount,
              type: 'fixed',
              date,
              place,
              base: amount,
              recurring: true,
            });
          }
        }

        await onImportFixed(newBills);
        Alert.alert('Import Complete', `Imported ${newBills.length} fixed bills.`);
      }

      setCsvText('');
      onClose();
    } catch (err: any) {
      Alert.alert('Import Error', err?.message || 'Failed to parse CSV.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
        <View className="bg-white dark:bg-neutral-900 rounded-t-3xl p-6 max-h-[85%]">
          <View className="flex-row justify-between items-center border-b border-neutral-200 dark:border-neutral-800 pb-4 mb-4">
            <Text className="text-xl font-bold text-neutral-900 dark:text-white">
              Import CSV Data
            </Text>
            <Pressable onPress={onClose}>
              <Text className="text-neutral-500 font-bold text-base">Close</Text>
            </Pressable>
          </View>

          <Text className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
            Paste CSV text below to import transactions. Recognized columns: Name, Amount, Date,
            Category, Place, Person, Note.
          </Text>

          <View className="flex-row space-x-2 mb-4">
            <Pressable
              onPress={() => setTargetType('variable')}
              className={`flex-1 py-2.5 rounded-xl border items-center ${
                targetType === 'variable'
                  ? 'bg-primary border-primary'
                  : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
              }`}
            >
              <Text
                className={`font-semibold text-xs ${
                  targetType === 'variable' ? 'text-white' : 'text-neutral-800 dark:text-neutral-200'
                }`}
              >
                Variable Expenses
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setTargetType('fixed')}
              className={`flex-1 py-2.5 rounded-xl border items-center ${
                targetType === 'fixed'
                  ? 'bg-primary border-primary'
                  : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
              }`}
            >
              <Text
                className={`font-semibold text-xs ${
                  targetType === 'fixed' ? 'text-white' : 'text-neutral-800 dark:text-neutral-200'
                }`}
              >
                Fixed Bills
              </Text>
            </Pressable>
          </View>

          <View className="mb-4">
            <TextInput
              className="w-full h-40 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 font-mono text-xs"
              placeholder="Name,Amount,Date,Category,Place
Grocery,450,2026-07-28,Food,bank
Coffee,25,2026-07-28,Entertainment,wallet"
              placeholderTextColor="#9ca3af"
              multiline
              textAlignVertical="top"
              value={csvText}
              onChangeText={setCsvText}
            />
          </View>

          <View className="pt-2 border-t border-neutral-200 dark:border-neutral-800">
            <Pressable
              onPress={handleImport}
              disabled={loading}
              className="w-full bg-primary py-3.5 rounded-xl items-center justify-center shadow-sm"
            >
              <Text className="text-white font-bold text-base">
                {loading ? 'Importing...' : `Import as ${targetType}`}
              </Text>
            </Pressable>
          </View>
        </View>
    </Sheet>
  );
}
