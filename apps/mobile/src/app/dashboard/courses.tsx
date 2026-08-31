import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import { DashboardScrollView as ScrollView } from '../../components/DashboardScrollView';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  type CourseSession,
  type Product,
  type SessionItem,
  addItemToSession,
  addVariableExpense,
  completeSession,
  createSession,
  createSessionItem,
  isMoroccanBarcode,
  lookupOffProduct,
  markSessionLogged,
  normalizeBarcode,
  removeSessionItem,
  renderBillText,
  resolveCourseCategory,
  resolveProduct,
  setItemQty,
  sessionUnits,
} from '@flousy/core';
import { useMobileStore } from '../../lib/store-context';
import { useMobileAuth } from '../../lib/auth-context';
import {
  saveCourseSession,
  saveProduct,
  subscribeActiveCourseSession,
  subscribeCourseSessions,
  subscribeProductCatalog,
  deleteCourseSession,
} from '../../lib/db';
import { DEMO_PRODUCTS_KEY, DEMO_SESSIONS_KEY, getJson, setJson } from '../../lib/storage';
import { MoneyPlaceChips } from '../../components/MoneyPlaceChips';

export default function CoursesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, demoMode } = useMobileAuth();
  const {
    month,
    updateMonth,
    currency,
    moneyPlaces,
    scanUnlocked,
    isPro,
  } = useMobileStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [active, setActive] = useState<CourseSession | null>(null);
  const [history, setHistory] = useState<CourseSession[]>([]);
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [bill, setBill] = useState<CourseSession | null>(null);
  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [pendingName, setPendingName] = useState('');
  const [pendingPrice, setPendingPrice] = useState('');
  const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const persistSession = useCallback(
    async (session: CourseSession) => {
      setActive(session.status === 'active' ? session : null);
      if (user && !demoMode) await saveCourseSession(user.uid, session);
      else {
        const all = getJson<CourseSession[]>(DEMO_SESSIONS_KEY, []);
        setJson(DEMO_SESSIONS_KEY, [session, ...all.filter((s) => s.id !== session.id)].slice(0, 100));
      }
    },
    [user, demoMode],
  );

  useEffect(() => {
    if (user && !demoMode) {
      const unsubA = subscribeActiveCourseSession(user.uid, setActive);
      const unsubH = subscribeCourseSessions(user.uid, setHistory);
      const unsubP = subscribeProductCatalog(user.uid, setCatalog);
      return () => {
        unsubA();
        unsubH();
        unsubP();
      };
    }
    setCatalog(getJson<Product[]>(DEMO_PRODUCTS_KEY, []));
    const sessions = getJson<CourseSession[]>(DEMO_SESSIONS_KEY, []);
    setActive(sessions.find((s) => s.status === 'active') || null);
    setHistory(sessions.filter((s) => s.status === 'completed'));
  }, [user, demoMode]);

  const start = async () => {
    const firstPlace = moneyPlaces[0]?.id || 'bank';
    const place = firstPlace === 'bank' || firstPlace === 'home' || firstPlace === 'wallet' ? firstPlace : 'bank';
    const session = createSession({ currency, place });
    await persistSession(session);
  };

  const handleCode = async (raw: string) => {
    if (!active || !scanUnlocked) return;
    const { barcode } = normalizeBarcode(raw);
    if (!barcode) {
      setNotice(t('courses.codeInvalid', 'That code is not a valid barcode.'));
      return;
    }
    const existing = active.items.find((line) => line.barcode === barcode);
    if (existing) {
      await persistSession(setItemQty(active, existing.key, existing.qty + 1));
      setNotice(`${existing.name} × ${existing.qty + 1}`);
      return;
    }
    const resolution = await resolveProduct({
      barcode,
      catalog,
      lookupRemote: (code) => lookupOffProduct(code, { proxyUrl: null }),
    });
    if (resolution.kind === 'found') {
      setPendingBarcode(barcode);
      setPendingName(resolution.product.name);
      setPendingPrice('');
      setNotice(
        resolution.source === 'catalog'
          ? t('courses.fromCatalog', 'From your catalog')
          : t('courses.fromOff', 'From Open Food Facts'),
      );
    } else {
      setPendingBarcode(barcode);
      setPendingName('');
      setPendingPrice('');
      setNotice(t('courses.notFound', 'Unknown product — enter a name and price.'));
    }
  };

  const addLine = async (item: SessionItem, product?: Product) => {
    if (!active) return;
    await persistSession(addItemToSession(active, item));
    if (product && user && !demoMode) await saveProduct(user.uid, product);
    if (product && demoMode) {
      const next = [product, ...catalog.filter((p) => p.barcode !== product.barcode)];
      setCatalog(next);
      setJson(DEMO_PRODUCTS_KEY, next);
    }
    setPendingBarcode(null);
    setPendingName('');
    setPendingPrice('');
    setManualName('');
    setManualPrice('');
  };

  const confirmPending = async () => {
    const price = Number(pendingPrice.replace(',', '.'));
    if (!pendingName.trim() || !Number.isFinite(price) || price < 0) {
      setNotice(t('courses.priceRequired', 'Enter a name and price.'));
      return;
    }
    const item = createSessionItem({
      barcode: pendingBarcode || undefined,
      name: pendingName.trim(),
      unitPrice: price,
    });
    const now = new Date().toISOString();
    const product: Product | undefined = pendingBarcode
      ? {
          barcode: pendingBarcode,
          name: pendingName.trim(),
          lastPrice: price,
          priceUpdatedAt: now,
          source: 'session',
          origin: isMoroccanBarcode(pendingBarcode) ? 'MA' : undefined,
          createdAt: now,
          updatedAt: now,
        }
      : undefined;
    await addLine(item, product);
  };

  const addManual = async () => {
    const price = Number(manualPrice.replace(',', '.'));
    if (!manualName.trim() || !Number.isFinite(price)) return;
    await addLine(createSessionItem({ name: manualName.trim(), unitPrice: price }));
  };

  const finish = async () => {
    if (!active || active.items.length === 0) return;
    const completed = completeSession(active);
    await persistSession(completed);
    setHistory((prev) => [completed, ...prev]);
    setBill(completed);
  };

  const discard = async () => {
    if (!active) return;
    if (user && !demoMode) await deleteCourseSession(user.uid, active.id);
    setActive(null);
  };

  const logToBudget = async () => {
    if (!bill || !month || bill.loggedExpenseId) return;
    const expenseId = `course-${bill.id}`;
    const expense = {
      id: expenseId,
      name: `${t('courses.title', 'Course')} · ${bill.date}`,
      amount: bill.total,
      type: resolveCourseCategory(month.activeCategories || []),
      date: bill.date,
      place: bill.place,
      note: `${bill.items.length} ${t('courses.items', 'items')}`,
      person: 'Self',
    };
    await updateMonth(addVariableExpense(month, expense));
    const logged = markSessionLogged(bill, expenseId);
    await persistSession(logged);
    setBill(logged);
  };

  if (!month) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-neutral-900">
        <ActivityIndicator color="#2ea44f" />
      </View>
    );
  }

  if (bill) {
    const text = renderBillText(bill);
    return (
      <ScrollView className="flex-1 bg-neutral-100 dark:bg-neutral-900" contentContainerStyle={{ padding: 16 }}>
        <Pressable onPress={() => setBill(null)} className="mb-3">
          <Text className="text-primary font-bold">← Back</Text>
        </Pressable>
        <View className="bg-white dark:bg-neutral-800 p-4 rounded-2xl">
          <Text className="font-mono text-xs text-neutral-800 dark:text-neutral-200">{text}</Text>
        </View>
        <Pressable
          onPress={() => Share.share({ message: text })}
          className="bg-neutral-900 dark:bg-white py-3 rounded-xl items-center mt-4"
        >
          <Text className="text-white dark:text-neutral-900 font-bold">{t('courses.share', 'Share bill')}</Text>
        </Pressable>
        {!bill.loggedExpenseId ? (
          <Pressable onPress={logToBudget} className="bg-primary py-3 rounded-xl items-center mt-3">
            <Text className="text-white font-bold">{t('courses.logToBudget', 'Log bill to budget')}</Text>
          </Pressable>
        ) : (
          <Text className="text-center text-primary font-semibold mt-3">
            {t('courses.logged', 'Logged to this month’s budget')}
          </Text>
        )}
      </ScrollView>
    );
  }

  if (!active) {
    return (
      <ScrollView className="flex-1 bg-neutral-100 dark:bg-neutral-900" contentContainerStyle={{ padding: 16 }}>
        <Pressable onPress={() => router.push('/dashboard')} className="mb-3">
          <Text className="text-primary font-bold">← Overview</Text>
        </Pressable>
        <View className="bg-white dark:bg-neutral-800 p-6 rounded-2xl items-center">
          <Text className="text-xl font-bold text-neutral-900 dark:text-white">
            {t('courses.emptyTitle', 'Start a course')}
          </Text>
          <Text className="text-sm text-neutral-500 text-center mt-2">
            {t('courses.emptyHint', 'Scan groceries as you shop and SmartJib builds the bill.')}
          </Text>
          <Pressable onPress={start} className="bg-primary px-6 py-3 rounded-xl mt-5">
            <Text className="text-white font-bold">{t('courses.start', 'Start Course')}</Text>
          </Pressable>
        </View>
        <Text className="font-bold text-neutral-900 dark:text-white mt-6 mb-2">
          {t('courses.recentTitle', 'Recent courses')}
        </Text>
        {history.length === 0 ? (
          <Text className="text-neutral-500">{t('courses.noRecent', 'No completed courses yet.')}</Text>
        ) : (
          history.slice(0, 10).map((session) => (
            <Pressable
              key={session.id}
              onPress={() => setBill(session)}
              className="bg-white dark:bg-neutral-800 p-4 rounded-2xl mb-2"
            >
              <Text className="font-semibold text-neutral-900 dark:text-white">
                {session.date} · {session.items.length} {t('courses.items', 'items')}
              </Text>
              <Text className="text-xs text-neutral-500">
                {session.total} {session.currency}
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    );
  }

  return (
    <View className="flex-1 bg-neutral-100 dark:bg-neutral-900">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        <Text className="text-xl font-bold text-neutral-900 dark:text-white">{t('courses.title', 'Course')}</Text>
        <Text className="text-xs text-neutral-500 mb-3">
          {active.date} · {sessionUnits(active)} {t('courses.items', 'items')}
        </Text>
        <MoneyPlaceChips
          month={month}
          selected={active.place}
          currency={currency}
          places={moneyPlaces}
          onSelect={(place) => persistSession({ ...active, place })}
        />

        {notice && <Text className="text-sm text-primary mt-3">{notice}</Text>}

        {scanUnlocked ? (
          <View className="mt-4">
            {!permission?.granted ? (
              <Pressable onPress={requestPermission} className="bg-primary py-3 rounded-xl items-center">
                <Text className="text-white font-bold">Enable camera</Text>
              </Pressable>
            ) : scanning ? (
              <View className="h-56 overflow-hidden rounded-2xl">
                <CameraView
                  style={{ flex: 1 }}
                  barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a'] }}
                  onBarcodeScanned={({ data }) => {
                    setScanning(false);
                    handleCode(data);
                  }}
                />
              </View>
            ) : (
              <Pressable onPress={() => setScanning(true)} className="bg-primary py-3 rounded-xl items-center">
                <Text className="text-white font-bold">{t('courses.scan', 'Scan barcode')}</Text>
              </Pressable>
            )}
            <TextInput
              placeholder={t('courses.manualCode', 'Or type a barcode')}
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
              onSubmitEditing={(e) => handleCode(e.nativeEvent.text)}
              className="bg-white dark:bg-neutral-800 px-4 py-3 rounded-xl mt-3 text-neutral-900 dark:text-white"
            />
          </View>
        ) : (
          <View className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-2xl mt-4">
            <Text className="font-bold text-amber-800">
              {t('courses.scanPro', 'Barcode scanning is a Pro feature')}
            </Text>
            <Text className="text-xs text-amber-700 mt-1">
              You can still add items by name. Upgrade to Pro (or join a household) to scan.
            </Text>
          </View>
        )}

        {pendingBarcode !== null || pendingName ? (
          <View className="bg-primary/10 p-4 rounded-2xl mt-4">
            <TextInput
              value={pendingName}
              onChangeText={setPendingName}
              placeholder={t('courses.manualName', 'Product name')}
              placeholderTextColor="#9ca3af"
              className="bg-white dark:bg-neutral-800 px-4 py-3 rounded-xl text-neutral-900 dark:text-white"
            />
            <TextInput
              value={pendingPrice}
              onChangeText={setPendingPrice}
              placeholder={t('courses.price', 'Price')}
              placeholderTextColor="#9ca3af"
              keyboardType="decimal-pad"
              className="bg-white dark:bg-neutral-800 px-4 py-3 rounded-xl mt-2 text-neutral-900 dark:text-white"
            />
            {pendingBarcode && isMoroccanBarcode(pendingBarcode) && (
              <Text className="text-xs text-primary mt-2">{t('courses.maBadge', 'Made in Morocco')}</Text>
            )}
            <Pressable onPress={confirmPending} className="bg-primary py-3 rounded-xl items-center mt-3">
              <Text className="text-white font-bold">{t('courses.add', 'Add')}</Text>
            </Pressable>
          </View>
        ) : (
          <View className="bg-white dark:bg-neutral-800 p-4 rounded-2xl mt-4">
            <Text className="font-bold text-neutral-900 dark:text-white mb-2">
              {t('courses.noBarcode', 'No barcode?')}
            </Text>
            <TextInput
              value={manualName}
              onChangeText={setManualName}
              placeholder={t('courses.manualName', 'Product name')}
              placeholderTextColor="#9ca3af"
              className="bg-neutral-100 dark:bg-neutral-900 px-4 py-3 rounded-xl text-neutral-900 dark:text-white"
            />
            <TextInput
              value={manualPrice}
              onChangeText={setManualPrice}
              placeholder={t('courses.price', 'Price')}
              placeholderTextColor="#9ca3af"
              keyboardType="decimal-pad"
              className="bg-neutral-100 dark:bg-neutral-900 px-4 py-3 rounded-xl mt-2 text-neutral-900 dark:text-white"
            />
            <Pressable onPress={addManual} className="bg-primary py-3 rounded-xl items-center mt-3">
              <Text className="text-white font-bold">{t('courses.manualAdd', 'Add item')}</Text>
            </Pressable>
          </View>
        )}

        {active.items.length === 0 ? (
          <Text className="text-center text-neutral-500 mt-6">{t('courses.noItems', 'No items yet.')}</Text>
        ) : (
          active.items.map((line) => (
            <View
              key={line.key}
              className="flex-row items-center bg-white dark:bg-neutral-800 p-3 rounded-2xl mt-2"
            >
              <View className="flex-1">
                <Text className="font-semibold text-neutral-900 dark:text-white">{line.name}</Text>
                <Text className="text-xs text-neutral-500">
                  {line.qty} × {line.unitPrice} {active.currency}
                </Text>
              </View>
              <Pressable onPress={() => persistSession(setItemQty(active, line.key, line.qty + 1))} className="px-2">
                <Text className="text-primary font-bold">+</Text>
              </Pressable>
              <Text className="font-bold w-16 text-right">{line.lineTotal}</Text>
              <Pressable onPress={() => persistSession(removeSessionItem(active, line.key))} className="px-2">
                <Text className="text-red-500">✕</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>

      <View className="absolute bottom-4 left-4 right-4 bg-white dark:bg-neutral-800 p-3 rounded-2xl flex-row items-center border border-neutral-200 dark:border-neutral-700">
        <View className="flex-1">
          <Text className="text-xs text-neutral-500">{t('courses.total', 'Total')}</Text>
          <Text className="text-lg font-bold text-primary">
            {active.total} {active.currency}
          </Text>
        </View>
        <Pressable onPress={discard} className="px-3">
          <Text className="text-red-500 font-semibold">{t('courses.discard', 'Discard')}</Text>
        </Pressable>
        <Pressable
          onPress={finish}
          disabled={active.items.length === 0}
          className="bg-primary px-5 py-2.5 rounded-xl"
        >
          <Text className="text-white font-bold">{t('courses.finish', 'Finish')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
