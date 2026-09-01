import React, { useState } from 'react';
import { Alert, Pressable, Text, View, ActivityIndicator } from 'react-native';
import { Download, Upload, Trash2, ChevronRight } from 'lucide-react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { exportMonthToCsv } from '@flousy/core';
import { ProfileSubpage } from '../../components/ProfileSubpage';
import { ImportCsvModal } from '../../components/ImportCsvModal';
import { useMobileStore } from '../../lib/store-context';

const TEAL = '#00685f';

export default function DataScreen() {
  const { month, savingsGoals, currentMonthKey, currency, updateMonth } = useMobileStore();
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!month) {
      Alert.alert('No data', 'No budget data available for export.');
      return;
    }
    setExporting(true);
    try {
      const csvString = exportMonthToCsv(month, savingsGoals, currentMonthKey, currency);
      const fileUri = `${FileSystem.documentDirectory}flousy-${currentMonthKey}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csvString, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: `Export SmartJib Budget (${currentMonthKey})` });
      } else {
        Alert.alert('Exported', `CSV file saved to ${fileUri}`);
      }
    } catch (err: any) {
      Alert.alert('Export error', err?.message || 'Failed to export CSV.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <ProfileSubpage title="Your data">
      <Pressable onPress={handleExport} className="mb-3 flex-row items-center justify-between rounded-2xl border border-neutral-200 bg-white p-4">
        <View className="flex-row items-center">
          <View className="mr-3 h-9 w-9 items-center justify-center rounded-lg bg-neutral-100">
            {exporting ? <ActivityIndicator color={TEAL} /> : <Download size={20} color={TEAL} />}
          </View>
          <Text className="text-sm font-medium text-neutral-900">Export this month as CSV</Text>
        </View>
        <ChevronRight size={20} color="#9CA3AF" />
      </Pressable>
      <Pressable onPress={() => setImportOpen(true)} className="mb-3 flex-row items-center justify-between rounded-2xl border border-neutral-200 bg-white p-4">
        <View className="flex-row items-center">
          <View className="mr-3 h-9 w-9 items-center justify-center rounded-lg bg-neutral-100">
            <Upload size={20} color={TEAL} />
          </View>
          <Text className="text-sm font-medium text-neutral-900">Import CSV</Text>
        </View>
        <ChevronRight size={20} color="#9CA3AF" />
      </Pressable>
      <Pressable
        onPress={() =>
          Alert.alert(
            'Delete all data',
            'This permanently deletes every month of budget data, expenses, and savings goals. Your account will be kept.',
            [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete all data', style: 'destructive' }],
          )
        }
        className="flex-row items-center justify-between rounded-2xl border border-red-200 bg-red-50 p-4"
      >
        <View className="flex-row items-center">
          <View className="mr-3 h-9 w-9 items-center justify-center rounded-lg bg-red-100">
            <Trash2 size={20} color="#DC2626" />
          </View>
          <Text className="text-sm font-medium text-red-600">Delete all data</Text>
        </View>
        <ChevronRight size={20} color="#F87171" />
      </Pressable>

      {month ? (
        <ImportCsvModal
          visible={importOpen}
          onClose={() => setImportOpen(false)}
          month={month}
          onImportVariable={async (expenses) => {
            await updateMonth({ ...month, variableExpenses: [...expenses, ...(month.variableExpenses || [])] });
          }}
          onImportFixed={async (bills) => {
            await updateMonth({ ...month, fixedExpenses: [...bills, ...(month.fixedExpenses || [])] });
          }}
        />
      ) : null}
    </ProfileSubpage>
  );
}
