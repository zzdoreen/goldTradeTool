import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Trash2, 
  Calendar, 
  Scale, 
  DollarSign, 
  ChevronRight,
  History,
  LayoutDashboard,
  AlertCircle,
  Pencil,
  CheckSquare,
  Square,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Sell {
  id: number;
  trade_id: number;
  sell_price: number;
  quantity: number;
  sell_date: string;
  fee: number;
  notes: string | null;
  batch_id?: string; // Added for grouping batch sells
}

interface Trade {
  id: number;
  buy_price: number;
  quantity: number;
  buy_date: string;
  notes: string | null;
  sells: Sell[];
}

export default function App() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [sellingTradeId, setSellingTradeId] = useState<number | null>(null);
  const [selectedTradeIds, setSelectedTradeIds] = useState<number[]>([]);
  const [isBatchSelling, setIsBatchSelling] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [editingSell, setEditingSell] = useState<{ sell: Sell, tradeId: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isChartVisible, setIsChartVisible] = useState(true);
  
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const askConfirmation = (title: string, message: string, onConfirm: () => void) => {
    setConfirmConfig({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const [formData, setFormData] = useState({
    buy_price: '',
    quantity: '',
    buy_date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    notes: ''
  });
  
  const [sellFormData, setSellFormData] = useState({
    sell_price: '',
    quantity: '',
    sell_date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    fee: '0',
    notes: ''
  });

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('gold_trades_v2');
    if (saved) {
      try {
        setTrades(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved trades', e);
      }
    }
    setLoading(false);
  }, []);

  // Sync to localStorage
  useEffect(() => {
    if (!loading) {
      localStorage.setItem('gold_trades_v2', JSON.stringify(trades));
    }
  }, [trades, loading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newTradeData = {
      buy_price: parseFloat(formData.buy_price),
      quantity: parseFloat(formData.quantity),
      buy_date: formData.buy_date,
      notes: formData.notes || null
    };

    if (editingTrade) {
      setTrades(prev => prev.map(t => t.id === editingTrade.id ? { ...t, ...newTradeData } : t));
      setEditingTrade(null);
    } else {
      const newTrade: Trade = {
        id: Date.now(),
        ...newTradeData,
        sells: []
      };
      setTrades(prev => [newTrade, ...prev]);
    }

    setIsAdding(false);
    setFormData({
      buy_price: '',
      quantity: '',
      buy_date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      notes: ''
    });
  };

  const handleSellSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isBatchSelling) {
      const sellPrice = parseFloat(sellFormData.sell_price);
      const sellDate = sellFormData.sell_date;
      const totalFee = parseFloat(sellFormData.fee);
      const notes = sellFormData.notes || null;
      const batchId = `batch-${Date.now()}`;

      const feePerTrade = totalFee / selectedTradeIds.length;

      setTrades(prev => prev.map(t => {
        if (selectedTradeIds.includes(t.id)) {
          const soldWeight = t.sells.reduce((acc, s) => acc + s.quantity, 0);
          const remaining = t.quantity - soldWeight;
          if (remaining <= 0) return t;

          const newSell: Sell = {
            id: Date.now() + Math.random(),
            trade_id: t.id,
            sell_price: sellPrice,
            quantity: remaining,
            sell_date: sellDate,
            fee: feePerTrade,
            notes: notes,
            batch_id: batchId
          };
          return { ...t, sells: [newSell, ...t.sells] };
        }
        return t;
      }));

      setIsBatchSelling(false);
      setSelectedTradeIds([]);
    } else {
      const tradeId = sellingTradeId || (editingSell?.tradeId);
      if (!tradeId) return;

      const sellData = {
        sell_price: parseFloat(sellFormData.sell_price),
        quantity: parseFloat(sellFormData.quantity),
        sell_date: sellFormData.sell_date,
        fee: parseFloat(sellFormData.fee),
        notes: sellFormData.notes || null
      };

      const trade = trades.find(t => t.id === tradeId);
      if (!trade) return;

      // Check quantity
      const otherSells = trade.sells.filter(s => s.id !== editingSell?.sell.id);
      const totalSoldOther = otherSells.reduce((acc, s) => acc + s.quantity, 0);
      if (sellData.quantity > (trade.quantity - totalSoldOther) + 0.00001) {
        alert('卖出数量超过剩余持仓');
        return;
      }

      if (editingSell) {
        setTrades(prev => prev.map(t => t.id === tradeId ? {
          ...t,
          sells: t.sells.map(s => s.id === editingSell.sell.id ? { ...s, ...sellData } : s)
        } : t));
        setEditingSell(null);
      } else {
        const newSell: Sell = {
          id: Date.now(),
          trade_id: tradeId,
          ...sellData
        };
        setTrades(prev => prev.map(t => t.id === tradeId ? { ...t, sells: [newSell, ...t.sells] } : t));
      }

      setSellingTradeId(null);
    }

    setSellFormData({
      sell_price: '',
      quantity: '',
      sell_date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      fee: '0',
      notes: ''
    });
  };

  const toggleSelection = (id: number) => {
    setSelectedTradeIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleDelete = (id: number) => {
    setTrades(prev => prev.filter(t => t.id !== id));
    setSelectedTradeIds(prev => prev.filter(i => i !== id));
  };

  const handleDeleteSell = (tradeId: number, sellId: number) => {
    setTrades(prev => prev.map(t => t.id === tradeId ? {
      ...t,
      sells: t.sells.filter(s => s.id !== sellId)
    } : t));
  };

  const handleDeleteBatchSell = (tradeId: number, sellIds: number[]) => {
    setTrades(prev => prev.map(t => t.id === tradeId ? {
      ...t,
      sells: t.sells.filter(s => !sellIds.includes(s.id))
    } : t));
  };

  const startEditTrade = (trade: Trade) => {
    setEditingTrade(trade);
    setFormData({
      buy_price: trade.buy_price.toString(),
      quantity: trade.quantity.toString(),
      buy_date: trade.buy_date,
      notes: trade.notes || ''
    });
    setIsAdding(true);
  };

  const startEditSell = (tradeId: number, sell: Sell) => {
    setEditingSell({ sell, tradeId });
    setSellFormData({
      sell_price: sell.sell_price.toString(),
      quantity: sell.quantity.toString(),
      sell_date: sell.sell_date,
      fee: sell.fee.toString(),
      notes: sell.notes || ''
    });
  };

  const stats = useMemo(() => {
    let totalProfit = 0;
    let activeWeight = 0;

    trades.forEach(t => {
      const soldWeight = t.sells.reduce((acc, s) => acc + s.quantity, 0);
      activeWeight += (t.quantity - soldWeight);
      
      t.sells.forEach(s => {
        const profit = (s.sell_price - t.buy_price) * s.quantity - s.fee;
        totalProfit += profit;
      });
    });
    
    return {
      totalProfit,
      activeWeight
    };
  }, [trades]);

  const displayItems = useMemo(() => {
    const batches: Record<string, { id: string, trades: Trade[], batchDate: string, sellPrice: number, totalProfit: number, totalFee: number, totalQuantity: number, buyPrice: number }> = {};
    const standaloneTrades: Trade[] = [];

    trades.forEach(trade => {
      // Find if this trade was sold in a batch
      const batchSell = trade.sells.find(s => s.batch_id);
      
      if (batchSell && batchSell.batch_id) {
        const bId = batchSell.batch_id;
        if (!batches[bId]) {
          batches[bId] = {
            id: bId,
            trades: [],
            batchDate: batchSell.sell_date,
            sellPrice: batchSell.sell_price,
            totalProfit: 0,
            totalFee: 0,
            totalQuantity: 0,
            buyPrice: 0 // Weighted average buy price
          };
        }
        batches[bId].trades.push(trade);
        batches[bId].totalQuantity += trade.quantity;
      } else {
        standaloneTrades.push(trade);
      }
    });

    // Calculate totals for batches
    Object.values(batches).forEach(batch => {
      let totalBuyCost = 0;
      batch.trades.forEach(t => {
        totalBuyCost += t.buy_price * t.quantity;
        t.sells.forEach(s => {
          if (s.batch_id === batch.id) {
            batch.totalProfit += (s.sell_price - t.buy_price) * s.quantity - s.fee;
            batch.totalFee += s.fee;
          }
        });
      });
      batch.buyPrice = totalBuyCost / batch.totalQuantity;
    });

    const items = [
      ...standaloneTrades.map(t => ({ 
        type: 'trade' as const, 
        id: `trade-${t.id}`,
        data: t, 
        timestamp: new Date(t.buy_date).getTime(),
        isFullySold: (t.quantity - t.sells.reduce((acc, s) => acc + s.quantity, 0)) < 0.0001
      })),
      ...Object.values(batches).map(b => ({ 
        type: 'batch' as const, 
        id: `batch-${b.id}`,
        data: b, 
        timestamp: new Date(b.batchDate).getTime(),
        isFullySold: true
      }))
    ];

    return items.sort((a, b) => {
      if (a.isFullySold !== b.isFullySold) return a.isFullySold ? 1 : -1;
      return b.timestamp - a.timestamp;
    });
  }, [trades]);

  const handleDeleteBatch = (batchId: string) => {
    setTrades(prev => prev.filter(t => !t.sells.some(s => s.batch_id === batchId)));
  };

  const chartData = useMemo(() => {
    const allSells = trades.flatMap(t => t.sells.map(s => ({
      date: format(new Date(s.sell_date), 'MM/dd HH:mm'),
      timestamp: new Date(s.sell_date).getTime(),
      profit: (s.sell_price - t.buy_price) * s.quantity - s.fee
    })));

    return allSells
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(s => ({
        '日期': s.date,
        '收益': parseFloat(s.profit.toFixed(2))
      }));
  }, [trades]);

  const selectedTotalWeight = useMemo(() => {
    return trades
      .filter(t => selectedTradeIds.includes(t.id))
      .reduce((acc, t) => {
        const sold = t.sells.reduce((sAcc, s) => sAcc + s.quantity, 0);
        return acc + (t.quantity - sold);
      }, 0);
  }, [trades, selectedTradeIds]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-gray-100 font-sans selection:bg-yellow-500/30">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#0A0A0A]/80 backdrop-blur-md border-b border-[#262626]">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center shadow-lg shadow-yellow-500/20">
              <Scale className="text-black w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">黄金交易助手</h1>
          </div>
          <div className="flex items-center gap-3">
            {selectedTradeIds.length > 0 && (
              <button 
                onClick={() => {
                  setIsBatchSelling(true);
                  setSellFormData(prev => ({ ...prev, quantity: selectedTotalWeight.toFixed(3) }));
                }}
                className="flex items-center gap-2 bg-yellow-500 text-black px-4 py-2 rounded-full text-sm font-bold hover:bg-yellow-400 transition-all active:scale-95 shadow-lg shadow-yellow-500/20"
              >
                <Layers size={18} />
                合并卖出 ({selectedTradeIds.length})
              </button>
            )}
            <button 
              onClick={() => {
                setEditingTrade(null);
                setFormData({
                  buy_price: '',
                  quantity: '',
                  buy_date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
                  notes: ''
                });
                setIsAdding(true);
              }}
              className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-full text-sm font-bold hover:bg-gray-200 transition-all active:scale-95"
            >
              <Plus size={18} />
              新增买入
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Stats Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StatCard 
            label="累计净收益" 
            value={`¥${stats.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
            icon={<TrendingUp className={cn("w-5 h-5", stats.totalProfit >= 0 ? "text-rose-500" : "text-emerald-500")} />}
            trend={stats.totalProfit >= 0 ? "positive" : "negative"}
          />
          <StatCard 
            label="当前持仓" 
            value={`${stats.activeWeight.toFixed(3)}g`}
            icon={<Scale className="w-5 h-5 text-yellow-500" />}
          />
        </section>

        {/* Chart Section */}
        {chartData.length > 0 && (
          <section className="bg-[#141414] rounded-2xl border border-[#262626] shadow-sm overflow-hidden">
            <button 
              onClick={() => setIsChartVisible(!isChartVisible)}
              className="w-full p-6 flex items-center justify-between hover:bg-[#1A1A1A] transition-colors"
            >
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                <LayoutDashboard size={16} />
                收益走势 (单笔卖出)
              </h2>
              <ChevronRight size={20} className={cn("text-gray-500 transition-transform", isChartVisible && "rotate-90")} />
            </button>
            <AnimatePresence>
              {isChartVisible && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-6 pb-6"
                >
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#F43F5E" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                        <XAxis 
                          dataKey="日期" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: '#525252' }}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 12, fill: '#525252' }}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1A1A1A', borderRadius: '12px', border: '1px solid #333', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)' }}
                          itemStyle={{ color: '#F43F5E' }}
                          labelStyle={{ fontWeight: 'bold', marginBottom: '4px', color: '#FFF' }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="收益" 
                          stroke="#F43F5E" 
                          strokeWidth={2}
                          fillOpacity={1} 
                          fill="url(#colorProfit)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        )}

        {/* Transactions List */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">交易明细</h2>
            <div className="flex items-center gap-4">
              {selectedTradeIds.length > 0 && (
                <button 
                  onClick={() => setSelectedTradeIds([])}
                  className="text-xs text-rose-500 font-bold uppercase hover:underline"
                >
                  取消选择 ({selectedTradeIds.length})
                </button>
              )}
              <span className="text-xs text-gray-400 font-mono uppercase tracking-widest">
                {trades.length} BUY ORDERS
              </span>
            </div>
          </div>

          <div className="grid gap-6">
            <AnimatePresence>
              {displayItems.map((item) => (
                item.type === 'trade' ? (
                  <TradeItem 
                    key={item.id} 
                    trade={item.data} 
                    isSelected={selectedTradeIds.includes(item.data.id)}
                    onSelect={() => toggleSelection(item.data.id)}
                    onDelete={() => handleDelete(item.data.id)}
                    onEdit={() => startEditTrade(item.data)}
                    onDeleteSell={(sellId) => handleDeleteSell(item.data.id, sellId)}
                    onDeleteBatchSell={(sellIds) => handleDeleteBatchSell(item.data.id, sellIds)}
                    onEditSell={(sell) => startEditSell(item.data.id, sell)}
                    onSell={() => {
                      setSellingTradeId(item.data.id);
                      const remaining = item.data.quantity - item.data.sells.reduce((acc, s) => acc + s.quantity, 0);
                      setSellFormData(prev => ({ ...prev, quantity: remaining.toString() }));
                    }}
                    askConfirmation={askConfirmation}
                  />
                ) : (
                  <BatchItem 
                    key={item.id}
                    batch={item.data}
                    onDelete={() => handleDeleteBatch(item.data.id)}
                    askConfirmation={askConfirmation}
                  />
                )
              ))}
            </AnimatePresence>
            
            {!loading && trades.length === 0 && (
              <div className="text-center py-20 bg-[#141414] rounded-2xl border border-dashed border-[#262626]">
                <div className="flex flex-col items-center gap-3 text-gray-500">
                  <AlertCircle size={40} strokeWidth={1.5} />
                  <p className="font-bold">暂无买入记录</p>
                  <button 
                    onClick={() => setIsAdding(true)}
                    className="text-yellow-500 text-sm font-bold hover:text-yellow-400 transition-colors"
                  >
                    立即添加第一笔买入
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Add/Edit Buy Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-[#141414] rounded-3xl shadow-2xl overflow-hidden border border-[#262626]"
            >
              <div className="p-6 border-b border-[#262626] flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">{editingTrade ? '编辑买入记录' : '新增买入记录'}</h3>
                <button onClick={() => setIsAdding(false)} className="text-gray-500 hover:text-white">
                  <Plus className="rotate-45" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase">买入克重 (克)</label>
                    <input 
                      required
                      type="number" 
                      step="0.001"
                      value={formData.quantity}
                      onChange={e => setFormData({...formData, quantity: e.target.value})}
                      className="w-full bg-[#1A1A1A] border border-[#262626] text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-yellow-500 outline-none transition-all"
                      placeholder="0.000"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase">买入单价 (元/克)</label>
                    <input 
                      required
                      type="number" 
                      step="0.01"
                      value={formData.buy_price}
                      onChange={e => setFormData({...formData, buy_price: e.target.value})}
                      className="w-full bg-[#1A1A1A] border border-[#262626] text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-yellow-500 outline-none transition-all"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase">买入时间</label>
                  <input 
                    required
                    type="datetime-local" 
                    value={formData.buy_date}
                    onChange={e => setFormData({...formData, buy_date: e.target.value})}
                    className="w-full bg-[#1A1A1A] border border-[#262626] text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-yellow-500 outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase">备注</label>
                  <textarea 
                    value={formData.notes}
                    onChange={e => setFormData({...formData, notes: e.target.value})}
                    className="w-full bg-[#1A1A1A] border border-[#262626] text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-yellow-500 outline-none transition-all resize-none h-20"
                    placeholder="选填..."
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full bg-yellow-500 text-black py-4 rounded-2xl font-bold hover:bg-yellow-400 transition-all active:scale-[0.98] shadow-xl shadow-yellow-500/10"
                >
                  {editingTrade ? '更新记录' : '保存记录'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add/Edit Sell Modal */}
      <AnimatePresence>
        {(sellingTradeId !== null || editingSell !== null || isBatchSelling) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setSellingTradeId(null);
                setEditingSell(null);
                setIsBatchSelling(false);
              }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-[#141414] rounded-3xl shadow-2xl overflow-hidden border border-[#262626]"
            >
              <div className="p-6 border-b border-[#262626] flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">
                  {isBatchSelling ? `合并卖出 (${selectedTradeIds.length}笔)` : (editingSell ? '编辑卖出记录' : '新增卖出记录')}
                </h3>
                <button onClick={() => {
                  setSellingTradeId(null);
                  setEditingSell(null);
                  setIsBatchSelling(false);
                }} className="text-gray-500 hover:text-white">
                  <Plus className="rotate-45" />
                </button>
              </div>
              <form onSubmit={handleSellSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase">卖出克重 (克)</label>
                    <input 
                      required
                      type="number" 
                      step="0.001"
                      disabled={isBatchSelling}
                      value={sellFormData.quantity}
                      onChange={e => setSellFormData({...sellFormData, quantity: e.target.value})}
                      className={cn(
                        "w-full border border-[#262626] text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-yellow-500 outline-none transition-all",
                        isBatchSelling ? "bg-[#0D0D0D] text-gray-600 cursor-not-allowed" : "bg-[#1A1A1A]"
                      )}
                      placeholder="0.000"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase">卖出单价 (元/克)</label>
                    <input 
                      required
                      type="number" 
                      step="0.01"
                      value={sellFormData.sell_price}
                      onChange={e => setSellFormData({...sellFormData, sell_price: e.target.value})}
                      className="w-full bg-[#1A1A1A] border border-[#262626] text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-yellow-500 outline-none transition-all"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase">
                      {isBatchSelling ? '总手续费 (元)' : '手续费 (元)'}
                    </label>
                    <input 
                      required
                      type="number" 
                      step="0.01"
                      value={sellFormData.fee}
                      onChange={e => setSellFormData({...sellFormData, fee: e.target.value})}
                      className="w-full bg-[#1A1A1A] border border-[#262626] text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-yellow-500 outline-none transition-all"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase">卖出时间</label>
                    <input 
                      required
                      type="datetime-local" 
                      value={sellFormData.sell_date}
                      onChange={e => setSellFormData({...sellFormData, sell_date: e.target.value})}
                      className="w-full bg-[#1A1A1A] border border-[#262626] text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-yellow-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase">备注</label>
                  <textarea 
                    value={sellFormData.notes}
                    onChange={e => setSellFormData({...sellFormData, notes: e.target.value})}
                    className="w-full bg-[#1A1A1A] border border-[#262626] text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-yellow-500 outline-none transition-all resize-none h-20"
                    placeholder="选填..."
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full bg-yellow-500 text-black py-4 rounded-2xl font-bold hover:bg-yellow-400 transition-all active:scale-[0.98] shadow-xl shadow-yellow-500/10"
                >
                  {isBatchSelling ? '确认合并卖出' : (editingSell ? '更新卖出' : '确认卖出')}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmConfig.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-[#1A1A1A] rounded-3xl shadow-2xl overflow-hidden border border-[#333]"
            >
              <div className="p-6 text-center space-y-4">
                <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto">
                  <AlertCircle size={32} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-white">{confirmConfig.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    {confirmConfig.message}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button 
                    onClick={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                    className="px-4 py-3 rounded-2xl bg-[#262626] text-gray-300 font-bold text-sm hover:bg-[#333] transition-all"
                  >
                    取消
                  </button>
                  <button 
                    onClick={confirmConfig.onConfirm}
                    className="px-4 py-3 rounded-2xl bg-rose-500 text-white font-bold text-sm hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20"
                  >
                    确认删除
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

const BatchItem = ({ batch, onDelete, askConfirmation }: { batch: any, onDelete: () => void, askConfirmation: (title: string, message: string, onConfirm: () => void) => void, key?: React.Key }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="group bg-[#141414] rounded-2xl border border-[#262626] shadow-sm hover:border-rose-500/30 transition-all overflow-hidden relative"
    >
      <button 
        type="button"
        onClick={(e) => { 
          e.stopPropagation(); 
          askConfirmation(
            '确认删除合并交易？',
            '确定要删除这笔合并交易记录吗？此操作将删除该批次下所有的买入和卖出记录。此操作不可撤销。',
            () => onDelete()
          );
        }}
        className="absolute top-4 right-4 p-3 text-gray-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-full transition-all z-50 opacity-0 group-hover:opacity-100 cursor-pointer flex items-center justify-center"
      >
        <Trash2 size={20} className="pointer-events-none" />
      </button>

      <div className="p-5 border-b border-[#262626] bg-rose-500/5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-left">
            <div className="w-12 h-12 rounded-xl bg-yellow-500/10 text-yellow-500 flex items-center justify-center shrink-0">
              <Layers size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-white">合并卖出 {batch.totalQuantity.toFixed(3)}g</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-rose-500/20 text-rose-500">
                  已结清
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold px-2 py-0.5 rounded text-yellow-500 bg-yellow-500/10">均价: ¥{batch.buyPrice.toFixed(2)}</span>
                  <span className="text-gray-700">|</span>
                  <span className="font-bold px-2 py-0.5 rounded text-blue-400 bg-blue-400/10">总成本: ¥{(batch.buyPrice * batch.totalQuantity).toFixed(2)}</span>
                </div>
                <span className="text-gray-600">包含 {batch.trades.length} 笔买入记录</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 pr-10">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-gray-500 uppercase">累计净收益</span>
              <span className={cn(
                "font-bold text-lg",
                batch.totalProfit >= 0 ? "text-rose-500" : "text-emerald-500"
              )}>
                {batch.totalProfit >= 0 ? '+' : ''}{batch.totalProfit.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#0D0D0D]">
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-5 py-3 flex items-center justify-between text-[10px] font-bold text-gray-500 uppercase tracking-widest hover:bg-[#1A1A1A] transition-colors"
        >
          <span className="flex items-center gap-2">
            卖出交易详情
            {isExpanded ? <TrendingUp size={12} className="rotate-180" /> : <TrendingUp size={12} />}
          </span>
          <span>{isExpanded ? '收起详情' : '查看详情'}</span>
        </button>
        
        <AnimatePresence>
          {isExpanded && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-5 pt-0 space-y-4">
                {/* Sell Details Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-[#141414] rounded-2xl border border-[#262626]">
                  <div className="space-y-1">
                    <div className="text-[10px] text-gray-500 uppercase font-bold">卖出单价</div>
                    <div className="text-sm font-bold text-white">¥{batch.sellPrice.toFixed(2)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] text-gray-500 uppercase font-bold">卖出时间</div>
                    <div className="text-sm font-bold text-white">{format(new Date(batch.batchDate), 'yyyy-MM-dd HH:mm')}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] text-gray-500 uppercase font-bold">总手续费</div>
                    <div className="text-sm font-bold text-gray-400">¥{batch.totalFee.toFixed(2)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] text-gray-500 uppercase font-bold">卖出总额</div>
                    <div className="text-sm font-bold text-blue-400">¥{(batch.sellPrice * batch.totalQuantity).toFixed(2)}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] text-gray-500 uppercase font-bold px-1">原始买入明细</div>
                  {batch.trades.map((t: Trade) => (
                    <div key={t.id} className="flex items-center justify-between bg-[#141414] p-3 rounded-xl border border-[#262626] text-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded bg-[#1A1A1A] flex items-center justify-center text-gray-500">
                          <Scale size={14} />
                        </div>
                        <div>
                          <div className="font-bold text-gray-300">{t.quantity.toFixed(3)}g @ ¥{t.buy_price.toFixed(2)}</div>
                          <div className="text-[10px] text-gray-600">{format(new Date(t.buy_date), 'yyyy-MM-dd')}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-gray-600 uppercase">买入总价</div>
                        <div className="font-mono text-gray-400">¥{(t.buy_price * t.quantity).toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function StatCard({ label, value, icon, trend }: { label: string, value: string, icon: React.ReactNode, trend?: 'positive' | 'negative' }) {
  return (
    <div className="bg-[#141414] p-6 rounded-2xl border border-[#262626] shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</span>
        <div className="p-2 bg-[#1A1A1A] rounded-lg text-yellow-500">
          {icon}
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-black tracking-tight text-white">{value}</span>
        {trend && (
          <span className={cn("text-xs font-bold", trend === 'positive' ? "text-rose-500" : "text-emerald-500")}>
            {trend === 'positive' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </div>
  );
}

interface TradeItemProps {
  trade: Trade;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onDeleteSell: (sellId: number) => void;
  onDeleteBatchSell: (sellIds: number[]) => void;
  onEditSell: (sell: Sell) => void;
  onSell: () => void;
  askConfirmation: (title: string, message: string, onConfirm: () => void) => void;
  key?: React.Key;
}

const TradeItem = ({ trade, isSelected, onSelect, onDelete, onEdit, onDeleteSell, onDeleteBatchSell, onEditSell, onSell, askConfirmation }: TradeItemProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const soldWeight = trade.sells.reduce((acc, s) => acc + s.quantity, 0);
  const remainingWeight = trade.quantity - soldWeight;
  const isFullySold = remainingWeight < 0.0001;
  
  const totalProfit = trade.sells.reduce((acc, s) => {
    return acc + ((s.sell_price - trade.buy_price) * s.quantity - s.fee);
  }, 0);

  // Group sells by batch_id
  const groupedSells = useMemo(() => {
    const groups: Record<string, Sell[]> = {};
    const individual: Sell[] = [];
    
    trade.sells.forEach(s => {
      if (s.batch_id) {
        if (!groups[s.batch_id]) groups[s.batch_id] = [];
        groups[s.batch_id].push(s);
      } else {
        individual.push(s);
      }
    });
    
    return { groups, individual };
  }, [trade.sells]);
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "group bg-[#141414] rounded-2xl border transition-all overflow-hidden relative",
        isFullySold ? "border-[#262626] opacity-60 grayscale-[0.5]" : "border-[#262626] shadow-sm hover:border-yellow-500/30",
        isSelected && "ring-2 ring-yellow-500 border-yellow-500"
      )}
    >
      {/* Absolute Delete Button for better clickability */}
      <button 
        type="button"
        onClick={(e) => { 
          e.stopPropagation(); 
          askConfirmation(
            '确认删除买入记录？',
            '确定要删除这条买入记录及其所有卖出记录吗？此操作将永久删除数据，不可撤销。',
            () => onDelete()
          );
        }}
        className="absolute top-4 right-4 p-3 text-gray-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-full transition-all z-50 opacity-0 group-hover:opacity-100 cursor-pointer flex items-center justify-center"
        title="删除交易"
      >
        <Trash2 size={20} className="pointer-events-none" />
      </button>

      <div className="p-5 border-b border-[#262626]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {!isFullySold && (
              <button 
                onClick={(e) => { e.stopPropagation(); onSelect(); }}
                className={cn(
                  "w-6 h-6 rounded-md flex items-center justify-center transition-all",
                  isSelected ? "bg-yellow-500 text-black" : "bg-[#262626] text-gray-500 hover:bg-[#333]"
                )}
              >
                {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
              </button>
            )}
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
              isFullySold ? "bg-[#1A1A1A] text-gray-600" : "bg-yellow-500/10 text-yellow-500"
            )}>
              <Scale size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={cn("font-bold text-lg text-white", isFullySold && "text-gray-500")}>买入 {trade.quantity.toFixed(3)}g</span>
                <span className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
                  isFullySold ? "bg-[#262626] text-gray-500" : "bg-yellow-500/20 text-yellow-500"
                )}>
                  {isFullySold ? '已售罄' : `剩余 ${remainingWeight.toFixed(3)}g`}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-0.5">
                <span className="flex items-center gap-1"><Calendar size={12} /> {format(new Date(trade.buy_date), 'yyyy-MM-dd HH:mm')}</span>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "font-bold px-2 py-0.5 rounded",
                    isFullySold ? "bg-[#262626] text-gray-500" : "text-yellow-500 bg-yellow-500/10"
                  )}>单价: ¥{trade.buy_price.toFixed(2)}</span>
                  <span className="text-gray-700">|</span>
                  <span className={cn(
                    "font-bold px-2 py-0.5 rounded",
                    isFullySold ? "bg-[#262626] text-gray-500" : "text-blue-400 bg-blue-400/10"
                  )}>总价: ¥{(trade.buy_price * trade.quantity).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 pr-10">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-gray-500 uppercase">累计净收益</span>
              <span className={cn(
                "font-bold text-lg",
                isFullySold ? "text-gray-500" : (totalProfit >= 0 ? "text-rose-500" : "text-emerald-500")
              )}>
                {totalProfit >= 0 ? '+' : ''}{totalProfit.toFixed(2)}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              {!isFullySold && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onSell(); }}
                  className="bg-yellow-500 text-black px-4 py-2 rounded-xl text-xs font-bold hover:bg-yellow-400 transition-all active:scale-95"
                >
                  卖出操作
                </button>
              )}
              <div className="flex items-center gap-1 bg-[#1A1A1A] p-1 rounded-xl border border-[#262626] relative z-20">
                <button 
                  type="button"
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    onEdit(); 
                  }}
                  className="p-2 text-gray-500 hover:text-white hover:bg-[#262626] rounded-lg transition-all cursor-pointer"
                >
                  <Pencil size={16} className="pointer-events-none" />
                </button>
              </div>
            </div>
          </div>
        </div>
        {trade.notes && (
          <div className="mt-3 text-xs text-gray-500 italic px-5 pb-3">
            备注: {trade.notes}
          </div>
        )}
      </div>

      {/* Sells List */}
      {trade.sells.length > 0 && (
        <div className="bg-[#0D0D0D]">
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full px-5 py-3 flex items-center justify-between text-[10px] font-bold text-gray-500 uppercase tracking-widest hover:bg-[#1A1A1A] transition-colors"
          >
            <span className="flex items-center gap-2">
              卖出记录 ({trade.sells.length})
              {isExpanded ? <TrendingUp size={12} className="rotate-180" /> : <TrendingUp size={12} />}
            </span>
            <span>{isExpanded ? '收起' : '展开'}</span>
          </button>
          
          <AnimatePresence>
            {isExpanded && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 pt-0 space-y-3">
                  {/* Render Grouped Sells */}
                  {(Object.entries(groupedSells.groups) as [string, Sell[]][]).map(([batchId, sells]) => {
                    const totalBatchQuantity = sells.reduce((acc, s) => acc + s.quantity, 0);
                    const totalBatchFee = sells.reduce((acc, s) => acc + s.fee, 0);
                    const avgPrice = sells[0].sell_price; // Batch sells share price
                    const totalBatchProfit = sells.reduce((acc, s) => acc + ((s.sell_price - trade.buy_price) * s.quantity - s.fee), 0);
                    
                    return (
                      <div key={batchId} className="bg-[#141414] p-3 rounded-xl border border-[#262626] shadow-sm text-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center",
                              totalBatchProfit >= 0 ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500"
                            )}>
                              <Layers size={16} />
                            </div>
                            <div>
                              <div className="font-bold flex items-center gap-2 text-white">
                                {totalBatchQuantity.toFixed(3)}g 
                                <span className="text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded text-[10px]">合并卖出</span>
                                <span className="text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded text-[10px] font-bold">总价: ¥{(avgPrice * totalBatchQuantity).toFixed(2)}</span>
                              </div>
                              <div className="text-[10px] text-gray-500 flex items-center gap-2">
                                {format(new Date(sells[0].sell_date), 'yyyy-MM-dd HH:mm')}
                                <span className="text-gray-700">|</span>
                                单价: ¥{avgPrice.toFixed(2)}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="flex flex-col items-end">
                              <span className="text-[10px] text-gray-500 uppercase">总手续费</span>
                              <span className="font-mono text-xs text-gray-300">¥{totalBatchFee.toFixed(2)}</span>
                            </div>
                            <div className="flex flex-col items-end min-w-[80px]">
                              <span className="text-[10px] text-gray-500 uppercase">净收益</span>
                              <span className={cn("font-bold", totalBatchProfit >= 0 ? "text-rose-500" : "text-emerald-500")}>
                                {totalBatchProfit >= 0 ? '+' : ''}{totalBatchProfit.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 relative z-20">
                              <button 
                                type="button"
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  askConfirmation(
                                    '确认删除合并卖出记录？',
                                    '确定要删除这笔合并卖出记录吗？确认删除该合并卖出项下的所有记录？',
                                    () => onDeleteBatchSell(sells.map(s => s.id))
                                  );
                                }}
                                className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center text-gray-600 hover:text-rose-500 transition-all cursor-pointer"
                              >
                                <Trash2 size={14} className="pointer-events-none" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Render Individual Sells */}
                  {groupedSells.individual.map(sell => {
                    const sellProfit = (sell.sell_price - trade.buy_price) * sell.quantity - sell.fee;
                    return (
                      <div key={sell.id} className="flex items-center justify-between bg-[#141414] p-3 rounded-xl border border-[#262626] shadow-sm text-sm">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center",
                            sellProfit >= 0 ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500"
                          )}>
                            {sellProfit >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                          </div>
                          <div>
                            <div className="font-bold flex items-center gap-2 text-white">
                              {sell.quantity.toFixed(3)}g 
                              <span className="text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded text-[10px]">单价: ¥{sell.sell_price.toFixed(2)}</span>
                              <span className="text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded text-[10px] font-bold">总价: ¥{(sell.sell_price * sell.quantity).toFixed(2)}</span>
                            </div>
                            <div className="text-[10px] text-gray-500">{format(new Date(sell.sell_date), 'yyyy-MM-dd HH:mm')}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] text-gray-500 uppercase">手续费</span>
                            <span className="font-mono text-xs text-gray-300">¥{sell.fee.toFixed(2)}</span>
                          </div>
                          <div className="flex flex-col items-end min-w-[80px]">
                            <span className="text-[10px] text-gray-500 uppercase">净收益</span>
                            <span className={cn("font-bold", sellProfit >= 0 ? "text-rose-500" : "text-emerald-500")}>
                              {sellProfit >= 0 ? '+' : ''}{sellProfit.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 relative z-20">
                            <button 
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onEditSell(sell); }}
                              className="p-1.5 text-gray-600 hover:text-white transition-all cursor-pointer"
                            >
                              <Pencil size={14} className="pointer-events-none" />
                            </button>
                            <button 
                              type="button"
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                askConfirmation(
                                  '确认删除卖出记录？',
                                  '确定要删除这条卖出记录吗？确认执行删除操作？',
                                  () => onDeleteSell(sell.id)
                                );
                              }}
                              className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center text-gray-600 hover:text-rose-500 transition-all cursor-pointer"
                            >
                              <Trash2 size={14} className="pointer-events-none" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
