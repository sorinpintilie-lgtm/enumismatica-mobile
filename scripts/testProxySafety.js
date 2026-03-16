/**
 * Standalone Node.js test script to verify that the safe extraction helpers
 * handle native Proxy-like objects (simulating expo-iap JSI host objects)
 * without throwing "Exception in HostFunction: Native state unsupported on Proxy".
 *
 * Run: node scripts/testProxySafety.js
 */

// ---- Copy of the pure-logic helpers from shared/paymentService.ts ----

function safeReadString(target, key) {
  try {
    if (!target || typeof target !== 'object') return undefined;
    const value = target[key];
    return typeof value === 'string' ? value : undefined;
  } catch {
    return undefined;
  }
}

function safeExtractPurchase(purchase) {
  return {
    id: safeReadString(purchase, 'id') || '',
    productId: safeReadString(purchase, 'productId') || '',
    transactionId: safeReadString(purchase, 'transactionId') || null,
    originalTransactionIdentifierIOS: safeReadString(purchase, 'originalTransactionIdentifierIOS') || null,
    purchaseToken: safeReadString(purchase, 'purchaseToken') || '',
    transactionReceipt: safeReadString(purchase, 'transactionReceipt') || '',
    verificationResultIOS: safeReadString(purchase, 'verificationResultIOS') || '',
  };
}

function safeExtractProduct(product) {
  return {
    id: safeReadString(product, 'id') || '',
    productId: safeReadString(product, 'productId') || '',
    title: safeReadString(product, 'title') || '',
    description: safeReadString(product, 'description') || '',
    price: safeReadString(product, 'price') || '',
    localizedPrice: safeReadString(product, 'localizedPrice') || '',
    displayPrice: safeReadString(product, 'displayPrice') || '',
  };
}

function safeToString(value) {
  try {
    return typeof value === 'string' ? value : String(value);
  } catch {
    return '[unreadable-native-error]';
  }
}

function sanitizeError(error) {
  if (!error) return { type: 'unknown' };
  const message = safeReadString(error, 'message') || safeToString(error);
  const code = safeReadString(error, 'code');
  const domain = safeReadString(error, 'domain');
  let userInfo;
  try {
    if (error && typeof error === 'object') {
      const rawUserInfo = error.userInfo;
      if (rawUserInfo && typeof rawUserInfo === 'object') {
        const safeEntries = Object.entries(rawUserInfo)
          .map(([key, value]) => {
            const valueType = typeof value;
            if (value == null || valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
              return [key, value];
            }
            return [key, `[${valueType}]`];
          });
        userInfo = JSON.stringify(Object.fromEntries(safeEntries)).slice(0, 1200);
      }
    }
  } catch {
    userInfo = undefined;
  }
  return { message, code, domain, userInfo };
}

// ---- Proxy simulators ----

function createThrowingProxy() {
  return new Proxy({}, {
    get(_target, prop) {
      throw new Error(
        `Exception in HostFunction: Native state unsupported on Proxy (accessed .${String(prop)})`
      );
    },
    has() {
      throw new Error('Exception in HostFunction: Native state unsupported on Proxy (has)');
    },
  });
}

function createPartialThrowingProxy(safeValues, throwingKeys) {
  return new Proxy(safeValues, {
    get(target, prop) {
      if (throwingKeys.includes(String(prop))) {
        throw new Error(
          `Exception in HostFunction: Native state unsupported on Proxy (accessed .${String(prop)})`
        );
      }
      return target[String(prop)];
    },
  });
}

// ---- Test runner ----

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.log(`  ❌ FAIL: ${label}`);
  }
}

function assertNoThrow(fn, label) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${label}`);
  } catch (e) {
    failed++;
    console.log(`  ❌ FAIL (threw): ${label} — ${e.message}`);
  }
}

// ---- Tests ----

console.log('\n=== safeExtractPurchase ===');

assertNoThrow(() => {
  const result = safeExtractPurchase({
    id: 'ro.enumismatica.credits.20',
    productId: 'ro.enumismatica.credits.20',
    transactionId: 'tx_123',
    purchaseToken: 'token_abc',
  });
  assert(result.id === 'ro.enumismatica.credits.20', 'extracts id from plain object');
  assert(result.transactionId === 'tx_123', 'extracts transactionId from plain object');
  assert(result.purchaseToken === 'token_abc', 'extracts purchaseToken from plain object');
}, 'plain object extraction does not throw');

assertNoThrow(() => {
  const proxy = createThrowingProxy();
  const result = safeExtractPurchase(proxy);
  assert(result.id === '', 'fully-throwing proxy: id is empty string');
  assert(result.productId === '', 'fully-throwing proxy: productId is empty string');
  assert(result.transactionId === null, 'fully-throwing proxy: transactionId is null');
  assert(result.purchaseToken === '', 'fully-throwing proxy: purchaseToken is empty string');
}, 'fully-throwing Proxy does NOT crash');

assertNoThrow(() => {
  const proxy = createPartialThrowingProxy(
    { id: 'ro.enumismatica.credits.50', productId: 'ro.enumismatica.credits.50' },
    ['transactionReceipt', 'verificationResultIOS']
  );
  const result = safeExtractPurchase(proxy);
  assert(result.id === 'ro.enumismatica.credits.50', 'partial proxy: reads safe id');
  assert(result.transactionReceipt === '', 'partial proxy: throwing field returns empty');
  assert(result.verificationResultIOS === '', 'partial proxy: throwing field returns empty');
}, 'partial-throwing Proxy does NOT crash');

assertNoThrow(() => {
  assert(safeExtractPurchase(null).id === '', 'null input: id is empty');
  assert(safeExtractPurchase(undefined).id === '', 'undefined input: id is empty');
}, 'null/undefined input does NOT crash');

console.log('\n=== safeExtractProduct ===');

assertNoThrow(() => {
  const result = safeExtractProduct({
    id: 'ro.enumismatica.credits.100',
    localizedPrice: '$4.99',
    title: 'Credits 100',
  });
  assert(result.id === 'ro.enumismatica.credits.100', 'extracts id from plain product');
  assert(result.localizedPrice === '$4.99', 'extracts localizedPrice from plain product');
  assert(result.title === 'Credits 100', 'extracts title from plain product');
}, 'plain product extraction does not throw');

assertNoThrow(() => {
  const proxy = createThrowingProxy();
  const result = safeExtractProduct(proxy);
  assert(result.id === '', 'fully-throwing proxy product: id is empty');
  assert(result.localizedPrice === '', 'fully-throwing proxy product: localizedPrice is empty');
}, 'fully-throwing Proxy product does NOT crash');

console.log('\n=== sanitizeError ===');

assertNoThrow(() => {
  const err = new Error('Something went wrong');
  err.code = 'E_USER_CANCELLED';
  const result = sanitizeError(err);
  assert(result.message === 'Something went wrong', 'normal error: message extracted');
  assert(result.code === 'E_USER_CANCELLED', 'normal error: code extracted');
}, 'normal Error object');

assertNoThrow(() => {
  const proxy = createThrowingProxy();
  const result = sanitizeError(proxy);
  assert(result.message !== undefined, 'throwing proxy error: message is defined (fallback)');
  assert(result.code === undefined, 'throwing proxy error: code is undefined');
}, 'fully-throwing Proxy error does NOT crash');

assertNoThrow(() => {
  const err = createPartialThrowingProxy(
    { message: 'fail', code: 'ERR' },
    ['userInfo']
  );
  const result = sanitizeError(err);
  assert(result.message === 'fail', 'partial proxy error: message extracted');
  assert(result.code === 'ERR', 'partial proxy error: code extracted');
  assert(result.userInfo === undefined, 'partial proxy error: throwing userInfo is undefined');
}, 'error with throwing userInfo does NOT crash');

assertNoThrow(() => {
  const result = sanitizeError(null);
  assert(result.type === 'unknown', 'null error returns { type: unknown }');
}, 'null error');

console.log('\n=== safeReadString ===');

assert(safeReadString({ foo: 'bar' }, 'foo') === 'bar', 'reads string property');
assert(safeReadString({ foo: 42 }, 'foo') === undefined, 'returns undefined for non-string');

assertNoThrow(() => {
  const proxy = createThrowingProxy();
  assert(safeReadString(proxy, 'anything') === undefined, 'throwing proxy returns undefined');
}, 'throwing Proxy does NOT crash safeReadString');

// ---- Summary ----

console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(40)}\n`);

process.exit(failed > 0 ? 1 : 0);
