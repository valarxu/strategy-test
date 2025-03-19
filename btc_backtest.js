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

// 计算ATR (Average True Range)
function calculateATR(highs, lows, closes, period) {
    if (highs.length < period + 1) return [];
    
    // 计算True Range
    const trueRanges = [];
    trueRanges.push(highs[0] - lows[0]); // 第一个柱的TR仅用最高价-最低价
    
    for (let i = 1; i < highs.length; i++) {
        const highLow = highs[i] - lows[i];
        const highPrevClose = Math.abs(highs[i] - closes[i-1]);
        const lowPrevClose = Math.abs(lows[i] - closes[i-1]);
        trueRanges.push(Math.max(highLow, highPrevClose, lowPrevClose));
    }
    
    // 计算ATR
    const atrValues = [];
    let atr = 0;
    
    // 前period个TR的简单平均值作为第一个ATR
    for (let i = 0; i < period; i++) {
        atr += trueRanges[i];
    }
    atr = atr / period;
    atrValues.push(atr);
    
    // 其余ATR采用smoothed方法计算
    for (let i = period; i < trueRanges.length; i++) {
        atr = (atr * (period - 1) + trueRanges[i]) / period;
        atrValues.push(atr);
    }
    
    return atrValues;
}

// 主回测函数
function backtest(klineData, useCompounding = true) {
    // 策略参数 - 与pine脚本保持一致
    const emaLength = 120;
    const atrLength = 14;
    const atrMultiplier = 3;
    const deviationPercent = 5; // 5%
    const takeProfitPercent = 5; // 5%
    
    // 交易状态
    let position = 0; // 0: 无仓位, 1: 多头, -1: 空头
    let entryPrice = 0;
    let fixedTradeAmount = 10000; // 固定交易金额
    let investedAmount = 0; // 实际投资金额
    let capital = 10000; // 初始资金
    const trades = [];
    
    // 提取价格数据
    const closes = klineData.map(kline => parseFloat(kline.close));
    const highs = klineData.map(kline => parseFloat(kline.high));
    const lows = klineData.map(kline => parseFloat(kline.low));
    
    // 计算EMA和ATR
    const emaValues = calculateEMA(closes, emaLength);
    const atrValues = calculateATR(highs, lows, closes, atrLength);
    
    // 计算指标需要的最小K线数量
    const minBars = Math.max(emaLength, atrLength);
    
    // 遍历K线数据进行回测
    for (let i = minBars; i < klineData.length; i++) {
        const close = closes[i];
        const ema = emaValues[i];
        const atr = atrValues[i - atrLength + 1]; // 调整ATR索引
        
        // 计算通道边界
        const atrUpperBand = ema + atr * atrMultiplier;
        const atrLowerBand = ema - atr * atrMultiplier;
        const percentUpperBand = ema * (1 + deviationPercent / 100);
        const percentLowerBand = ema * (1 - deviationPercent / 100);
        
        // 交易信号 - 同时满足ATR和百分比条件
        const longEntry = close < atrLowerBand && close < percentLowerBand;
        const shortEntry = close > atrUpperBand && close > percentUpperBand;
        
        // 计算止盈价格
        const longTakeProfit = entryPrice * (1 + takeProfitPercent / 100);
        const shortTakeProfit = entryPrice * (1 - takeProfitPercent / 100);
        
        // 平仓条件：价格达到止盈目标或价格突破/跌破EMA
        const exitLong = position > 0 && (close >= longTakeProfit || close > ema);
        const exitShort = position < 0 && (close <= shortTakeProfit || close < ema);
        
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
                time: new Date(parseInt(klineData[i].openTime)).toISOString(),
                type: '平多',
                price: close,
                entryPrice: entryPrice,
                profitPercent: (profitPercentage * 100).toFixed(2) + '%',
                investedAmount: (useCompounding ? investedAmount : fixedTradeAmount).toFixed(2),
                profit: profit.toFixed(2),
                reason: close >= longTakeProfit ? '多头止盈' : '多头止损(突破EMA)',
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
                time: new Date(parseInt(klineData[i].openTime)).toISOString(),
                type: '平空',
                price: close,
                entryPrice: entryPrice,
                profitPercent: (profitPercentage * 100).toFixed(2) + '%',
                investedAmount: (useCompounding ? investedAmount : fixedTradeAmount).toFixed(2),
                profit: profit.toFixed(2),
                reason: close <= shortTakeProfit ? '空头止盈' : '空头止损(跌破EMA)',
                capital: capital.toFixed(2),
                mode: useCompounding ? '复利' : '固定金额'
            });
            position = 0;
            investedAmount = 0;
        }
        
        // 执行开仓 - 添加持仓检查，避免重复开仓
        if (longEntry && position <= 0) {
            entryPrice = close;
            position = 1;
            
            if (useCompounding) {
                investedAmount = capital; // 复利模式 - 全部资金开仓
            } else {
                investedAmount = fixedTradeAmount; // 固定金额模式 - 始终使用相同金额
            }
            
            trades.push({
                time: new Date(parseInt(klineData[i].openTime)).toISOString(),
                type: '开多',
                price: close,
                investedAmount: investedAmount.toFixed(2),
                ema: ema.toFixed(2),
                atrLowerBand: atrLowerBand.toFixed(2),
                percentLowerBand: percentLowerBand.toFixed(2),
                capital: capital.toFixed(2),
                mode: useCompounding ? '复利' : '固定金额'
            });
        }
        
        if (shortEntry && position >= 0) {
            entryPrice = close;
            position = -1;
            
            if (useCompounding) {
                investedAmount = capital; // 复利模式 - 全部资金开仓
            } else {
                investedAmount = fixedTradeAmount; // 固定金额模式 - 始终使用相同金额
            }
            
            trades.push({
                time: new Date(parseInt(klineData[i].openTime)).toISOString(),
                type: '开空',
                price: close,
                investedAmount: investedAmount.toFixed(2),
                ema: ema.toFixed(2),
                atrUpperBand: atrUpperBand.toFixed(2),
                percentUpperBand: percentUpperBand.toFixed(2),
                capital: capital.toFixed(2),
                mode: useCompounding ? '复利' : '固定金额'
            });
        }
    }
    
    // 计算回测结果
    const finalCapital = capital;
    const totalProfit = finalCapital - 10000;
    const totalTrades = trades.length / 2; // 一开一平算一笔
    
    // 计算盈亏比和胜率
    let winCount = 0;
    let lossCount = 0;
    let totalWinProfit = 0;
    let totalLossLoss = 0;
    
    for (let i = 0; i < trades.length; i++) {
        if (trades[i].type === '平多' || trades[i].type === '平空') {
            const profit = parseFloat(trades[i].profit);
            if (profit > 0) {
                winCount++;
                totalWinProfit += profit;
            } else {
                lossCount++;
                totalLossLoss += Math.abs(profit);
            }
        }
    }
    
    const winRate = totalTrades > 0 ? (winCount / totalTrades * 100).toFixed(2) + '%' : 'N/A';
    const profitLossRatio = lossCount > 0 ? (totalWinProfit / totalLossLoss).toFixed(2) : 'N/A';
    
    return {
        trades,
        summary: {
            initialCapital: 10000,
            finalCapital,
            totalProfit,
            totalTrades,
            profitPercentage: (totalProfit / 10000 * 100).toFixed(2) + '%',
            winCount,
            lossCount,
            winRate,
            profitLossRatio
        }
    };
}

// 主函数
function main() {
    console.log('开始BTC交易策略回测 (EMA通道策略 - 百分比+ATR)...');
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
    console.log(`回测完成！共执行${compoundingResults.summary.totalTrades}笔交易，最终资金: ${compoundingResults.summary.finalCapital.toFixed(2)}`);
    console.log(`总收益: ${compoundingResults.summary.totalProfit.toFixed(2)} (${compoundingResults.summary.profitPercentage})`);
    console.log(`胜率: ${compoundingResults.summary.winRate}，盈亏比: ${compoundingResults.summary.profitLossRatio}`);
    
    console.log('\n固定金额模式:');
    console.log(`回测完成！共执行${fixedResults.summary.totalTrades}笔交易，最终资金: ${fixedResults.summary.finalCapital.toFixed(2)}`);
    console.log(`总收益: ${fixedResults.summary.totalProfit.toFixed(2)} (${fixedResults.summary.profitPercentage})`);
    console.log(`胜率: ${fixedResults.summary.winRate}，盈亏比: ${fixedResults.summary.profitLossRatio}`);
    
    console.log('\n交易结果已保存到各自的JSON文件');
}

main(); 