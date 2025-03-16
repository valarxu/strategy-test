# 币安BTC K线数据获取工具

该工具用于从币安获取BTC/USDT的K线数据，并保存为本地JSON文件。

## 功能

- 获取币安BTC/USDT的15分钟K线数据
- 一次获取1500条K线记录
- 通过本地代理连接币安API
- 将数据保存为JSON格式

## 安装依赖

```bash
npm install
```

## 使用方法

```bash
npm start
```

或者直接运行:

```bash
node fetchKlines.js
```

## 数据保存

K线数据将被保存在`./data/BTCUSDT_15m_klines.json`文件中。

## 配置

- 代理端口: 默认使用本地4780端口作为代理
- 交易对: BTCUSDT
- K线周期: 15分钟
- 数据量: 1500条

如需修改配置，请直接编辑`fetchKlines.js`文件中的相关常量。 