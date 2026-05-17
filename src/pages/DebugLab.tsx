import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
}

interface PurchaseItem {
  product_id: number;
  product_name: string;
}

interface Order {
  date: string;
  items: PurchaseItem[];
}

const DEMO_EMAILS = new Set(['demo@example.com', 'ananya.iyer.demo@verdant.in']);

function isDemoUser(email?: string): boolean {
  if (!email) return false;
  return DEMO_EMAILS.has(email.toLowerCase());
}

const DebugLab = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [history, setHistory] = useState<Order[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [daysElapsed, setDaysElapsed] = useState(14);
  const [isRunning, setIsRunning] = useState(false);
  const [resultLog, setResultLog] = useState<string>('No debug action run yet.');

  const canAccess = useMemo(() => isDemoUser(user?.email), [user?.email]);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/login?redirect=debug-lab');
      return;
    }

    if (!isLoading && user && !canAccess) {
      navigate('/');
      return;
    }

    if (!user || !canAccess) return;

    fetch('/api/products')
      .then((res) => res.json())
      .then((data) => setProducts(Array.isArray(data) ? data : []));

    fetch(`/api/user/${user.id}/history`)
      .then((res) => res.json())
      .then((data) => setHistory(Array.isArray(data) ? data : []));
  }, [user, isLoading, canAccess, navigate]);

  const purchasedProducts = useMemo(() => {
    const latestByProduct = new Map<number, { id: number; name: string; date: string }>();

    for (const order of history) {
      for (const item of order.items) {
        const existing = latestByProduct.get(item.product_id);
        if (!existing || new Date(order.date) > new Date(existing.date)) {
          latestByProduct.set(item.product_id, {
            id: item.product_id,
            name: item.product_name,
            date: order.date,
          });
        }
      }
    }

    return [...latestByProduct.values()].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [history]);

  useEffect(() => {
    if (!selectedProductId && purchasedProducts.length > 0) {
      setSelectedProductId(purchasedProducts[0].id);
      return;
    }

    if (!selectedProductId && products.length > 0) {
      setSelectedProductId(products[0].id);
    }
  }, [selectedProductId, purchasedProducts, products]);

  const runRequest = async (url: string, payload: Record<string, unknown>, label: string) => {
    if (!user || !selectedProductId) return;

    setIsRunning(true);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      setResultLog(`${label}\nStatus: ${response.status}\n\n${JSON.stringify(data, null, 2)}`);
    } catch (error) {
      setResultLog(`${label}\nRequest failed: ${(error as Error).message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleSimulateDays = async () => {
    if (!user || !selectedProductId) return;
    await runRequest(
      '/api/debug/recommendation/simulate-days',
      {
        demo_user_id: user.id,
        customer_id: user.id,
        product_id: selectedProductId,
        days_elapsed: daysElapsed,
      },
      `Simulate purchase age to ${daysElapsed} days`,
    );
  };

  const handleTriggerChannel = async (channel: 'sms' | 'email' | 'call') => {
    if (!user || !selectedProductId) return;
    await runRequest(
      '/api/notifications/product',
      {
        customer_id: user.id,
        product_id: selectedProductId,
        channels: [channel],
        message: `Debug ${channel.toUpperCase()} alert: product purchased ${daysElapsed} days ago, refill test trigger from Debug Lab.`,
      },
      `Trigger ${channel.toUpperCase()} notification`,
    );
  };

  const handleMasterTrigger = async () => {
    if (!user || !selectedProductId) return;
    await runRequest(
      '/api/debug/notifications/master',
      {
        demo_user_id: user.id,
        customer_id: user.id,
        product_id: selectedProductId,
        days_elapsed: daysElapsed,
      },
      `MASTER trigger: simulate + SNS event + SMS/Email/Call`,
    );
  };

  if (isLoading || !user) {
    return <div className="container mx-auto px-4 py-16 text-center">Loading...</div>;
  }

  if (!canAccess) {
    return <div className="container mx-auto px-4 py-16 text-center">Debug Lab is available only for demo account.</div>;
  }

  return (
    <div className="container mx-auto px-4 py-10 space-y-8">
      <div>
        <h1 className="text-4xl font-serif font-bold text-brand-950">Debug Lab (Demo Only)</h1>
        <p className="text-earth-600 mt-2">
          Simulate elapsed purchase days and trigger recommendation notifications for testing.
        </p>
      </div>

      <Card className="border-none shadow-soft rounded-3xl">
        <CardHeader>
          <CardTitle>Scenario Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-earth-700">Target Product</label>
            <select
              className="w-full mt-1 h-11 rounded-xl border border-earth-300 px-3 bg-white"
              value={selectedProductId ?? ''}
              onChange={(e) => setSelectedProductId(Number(e.target.value))}
            >
              {purchasedProducts.length > 0 && (
                <optgroup label="Purchased Products">
                  {purchasedProducts.map((p) => (
                    <option key={`purchased-${p.id}`} value={p.id}>
                      {p.name} (last bought {new Date(p.date).toLocaleDateString()})
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="All Products">
                {products.map((p) => (
                  <option key={`all-${p.id}`} value={p.id}>
                    {p.name} • {p.category}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div>
            <label className="text-sm text-earth-700">Days Since Purchase</label>
            <Input
              type="number"
              min={0}
              max={365}
              value={daysElapsed}
              onChange={(e) => setDaysElapsed(Number(e.target.value))}
              className="mt-1"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button disabled={isRunning || !selectedProductId} onClick={handleSimulateDays}>
              Mark as {daysElapsed} Days Completed
            </Button>
            <Button
              variant="outline"
              disabled={isRunning || !selectedProductId}
              onClick={() => handleTriggerChannel('sms')}
            >
              Trigger SMS
            </Button>
            <Button
              variant="outline"
              disabled={isRunning || !selectedProductId}
              onClick={() => handleTriggerChannel('email')}
            >
              Trigger Email
            </Button>
            <Button
              variant="outline"
              disabled={isRunning || !selectedProductId}
              onClick={() => handleTriggerChannel('call')}
            >
              Trigger Call
            </Button>
            <Button
              className="bg-brand-700 hover:bg-brand-800"
              disabled={isRunning || !selectedProductId}
              onClick={handleMasterTrigger}
            >
              Master Trigger (Event + All Alerts)
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-soft rounded-3xl">
        <CardHeader>
          <CardTitle>Debug Output</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-earth-950 text-earth-50 text-xs rounded-2xl p-4 overflow-x-auto max-h-[460px]">
            {resultLog}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
};

export default DebugLab;
