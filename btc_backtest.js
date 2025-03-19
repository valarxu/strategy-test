const fs = require('fs');

// 读取K线数据
function loadKlineData(filename) {
    try {
        const data = fs.readFileSync(filename, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('读取文件错误:', err);
        return [];
    }
}

// 计算EMA
function calculateEMA(prices, period) {
    const k = 2 / (period + 1);
    let ema = prices[0];
    const emaValues = [ema];
    
    for (let i = 1; i < prices.length; i++) {
        ema = prices[i] * k + ema * (1 - k);
        emaValues.push(ema);
    }
    
    return emaValues;
}

// 主回测函数
function backtest(klineData, useCompounding = true) {
    // 策略参数
    const emaLength = 120;
    const takeProfit = 0.7; // 百分比
    const deviation = 0.007;
    
    // 交易状态
    let position = 0; // 0: 无仓位, 1: 多头, -1: 空头
    let entryPrice = 0;
    let fixedTradeAmount = 10000; // 固定交易金额
    let investedAmount = 0; // the actual invested amount
    let longPaused = false;
    let shortPaused = false;
    let capital = 10000; // 初始资金
    const trades = [];
    
    // 提取收盘价 - 修改为使用对象格式
    const closes = klineData.map(kline => parseFloat(kline.close));
    
    // 计算EMA
    const emaValues = calculateEMA(closes, emaLength);
    
    // 遍历K线数据进行回测
    for (let i = emaLength; i < klineData.length; i++) {
        const close = closes[i];
        const ema = emaValues[i];
        const prevClose = closes[i-1];
        const prevEma = emaValues[i-1];
        
        // 计算止盈价格
        const longTakeProfitPrice = entryPrice * (1 + takeProfit/100);
        const shortTakeProfitPrice = entryPrice * (1 - takeProfit/100);
        
        // 检测止盈条件
        const longTakeProfitReached = position > 0 && close >= longTakeProfitPrice;
        const shortTakeProfitReached = position < 0 && close <= shortTakeProfitPrice;
        
        // 更新暂停状态
        if (longTakeProfitReached) {
            longPaused = true;
        }
        if (shortTakeProfitReached) {
            shortPaused = true;
        }
        
        // 重置暂停状态条件
        if (close < ema && longPaused) {
            longPaused = false;
        }
        if (close > ema && shortPaused) {
            shortPaused = false;
        }
        
        // 平仓条件
        const exitLong = position > 0 && (close < ema || longTakeProfitReached);
        const exitShort = position < 0 && (close > ema || shortTakeProfitReached);
        
        // 开仓条件
        const goLong = position <= 0 && !longPaused && close > ema * (1 + deviation) && 
                      (prevClose <= prevEma * (1 + deviation) || prevClose < prevEma);
        
        const goShort = position >= 0 && !shortPaused && close < ema * (1 - deviation) && 
                       (prevClose >= prevEma * (1 - deviation) || prevClose > prevEma);
        
        // 执行平仓
        if (exitLong) {
            let profit;
            const profitPercentage = (close - entryPrice) / entryPrice;
            
            if (useCompounding) {
                profit = investedAmount * profitPercentage;
                capital = investedAmount + profit;
            } else {
                profit = fixedTradeAmount * profitPercentage;
                capital += profit;
            }
            
            trades.push({
                time: new Date(klineData[i].openTime).toISOString(),
                type: '平多',
                price: close,
                entryPrice: entryPrice,
                profitPercent: (profitPercentage * 100).toFixed(2) + '%',
                investedAmount: (useCompounding ? investedAmount : fixedTradeAmount).toFixed(2),
                profit: profit.toFixed(2),
                reason: longTakeProfitReached ? '多头止盈' : '多头止损',
                capital: capital.toFixed(2),
                mode: useCompounding ? '复利' : '固定金额'
            });
            position = 0;
            investedAmount = 0;
        }
        
        if (exitShort) {
            let profit;
            const profitPercentage = (entryPrice - close) / entryPrice;
            
            if (useCompounding) {
                profit = investedAmount * profitPercentage;
                capital = investedAmount + profit;
            } else {
                profit = fixedTradeAmount * profitPercentage;
                capital += profit;
            }
            
            trades.push({
                time: new Date(klineData[i].openTime).toISOString(),
                type: '平空',
                price: close,
                entryPrice: entryPrice,
                profitPercent: (profitPercentage * 100).toFixed(2) + '%',
                investedAmount: (useCompounding ? investedAmount : fixedTradeAmount).toFixed(2),
                profit: profit.toFixed(2),
                reason: shortTakeProfitReached ? '空头止盈' : '空头止损',
                capital: capital.toFixed(2),
                mode: useCompounding ? '复利' : '固定金额'
            });
            position = 0;
            investedAmount = 0;
        }
        
        // 执行开仓
        if (goLong) {
            entryPrice = close;
            position = 1;
            
            if (useCompounding) {
                investedAmount = capital; // 复利模式 - 全部资金开仓
            } else {
                investedAmount = fixedTradeAmount; // 固定金额模式 - 始终使用相同金额
            }
            
            trades.push({
                time: new Date(klineData[i].openTime).toISOString(),
                type: '开多',
                price: close,
                investedAmount: investedAmount.toFixed(2),
                capital: capital.toFixed(2),
                mode: useCompounding ? '复利' : '固定金额'
            });
        }
        
        if (goShort) {
            entryPrice = close;
            position = -1;
            
            if (useCompounding) {
                investedAmount = capital; // 复利模式 - 全部资金开仓
            } else {
                investedAmount = fixedTradeAmount; // 固定金额模式 - 始终使用相同金额
            }
            
            trades.push({
                time: new Date(klineData[i].openTime).toISOString(),
                type: '开空',
                price: close,
                investedAmount: investedAmount.toFixed(2),
                capital: capital.toFixed(2),
                mode: useCompounding ? '复利' : '固定金额'
            });
        }
    }
    
    // 计算回测结果
    const finalCapital = capital;
    const totalProfit = finalCapital - 10000;
    const totalTrades = trades.length;
    
    return {
        trades,
        summary: {
            initialCapital: 10000,
            finalCapital,
            totalProfit,
            totalTrades,
            profitPercentage: (totalProfit / 10000 * 100).toFixed(2) + '%'
        }
    };
}

// 主函数
function main() {
    console.log('开始BTC交易策略回测...');
    const klineData = loadKlineData('BTCUSDT_15m_klines.json');
    
    if (!klineData || klineData.length === 0) {
        console.error('数据加载失败或数据为空');
        return;
    }
    
    console.log(`加载了${klineData.length}条K线数据`);
    
    // 运行复利模式
    const compoundingResults = backtest(klineData, true);
    fs.writeFileSync('btc_trade_results_compounding.json', JSON.stringify(compoundingResults, null, 2));
    
    // 运行固定金额模式
    const fixedResults = backtest(klineData, false);
    fs.writeFileSync('btc_trade_results_fixed.json', JSON.stringify(fixedResults, null, 2));
    
    console.log('复利模式:');
    console.log(`回测完成！共执行${compoundingResults.trades.length}笔交易，最终资金: ${compoundingResults.summary.finalCapital.toFixed(2)}`);
    console.log(`总收益: ${compoundingResults.summary.totalProfit.toFixed(2)} (${compoundingResults.summary.profitPercentage})`);
    
    console.log('\n固定金额模式:');
    console.log(`回测完成！共执行${fixedResults.trades.length}笔交易，最终资金: ${fixedResults.summary.finalCapital.toFixed(2)}`);
    console.log(`总收益: ${fixedResults.summary.totalProfit.toFixed(2)} (${fixedResults.summary.profitPercentage})`);
    
    console.log('\n交易结果已保存到各自的JSON文件');
}

main(); 