# Symbol universe

39 instruments — ticker, exchange and instrument name, grouped by asset
class. Facts, not copied content: a ticker is an identifier and the issuer's name
is the issuer's.

**This is the useful remainder, not the whole crawl.** 538 symbol pages were
collected; 499 of them are Euronext and BME sector sub-indices the crawler
enumerated from two European directories. They are dropped. A fixture padded with
"IGBM Water & Others Index" looks broad and returns noise.

**No prices here, deliberately.** The crawl carried quotes frozen at 6 August 2026,
and a second market-data source that is silently months stale is worse than a
narrow one. Anything priced still comes from the live feed.

Intended use: widening the `SYMBOLS` fixture, which is currently too small for
search or comparison to feel real. The spread lines up with our six asset-class
pages, which is what makes it worth having.

Source: crawl of tradingview.com, 6 August 2026.

## Equities (15)

| Symbol | Name |
| --- | --- |
| `NASDAQ:AAPL` | Apple Inc |
| `NASDAQ:ALAR` | Alarum Technologies Ltd. |
| `NASDAQ:ALM` | Almonty Industries Inc. |
| `NASDAQ:AMD` | Advanced Micro Devices Inc |
| `NASDAQ:AMZN` | Amazon.com, Inc. |
| `NASDAQ:AVGO` | Broadcom Inc. |
| `NASDAQ:BWAY` | BrainsWay Ltd. |
| `NASDAQ:CLRO` | ClearOne, Inc. |
| `NASDAQ:CRESY` | Cresud S.A.C.I.F. y A. |
| `NASDAQ:ERIC` | Ericsson |
| `NASDAQ:FRSX` | Foresight Autonomous Holdings Ltd. |
| `NASDAQ:NFLX` | Netflix, Inc. |
| `NASDAQ:NVDA` | NVIDIA Corporation |
| `NASDAQ:SPCX` | Space Exploration Technologies Corp (SpaceX) |
| `NYSE:LLY` | Eli Lilly and Company |

## Indices (9)

| Symbol | Name |
| --- | --- |
| `FOREXCOM:GER40` | Germany 40 CFD |
| `FTSE:UKX` | FTSE 100 Index |
| `IG:NASDAQ` | US Tech 100 Cash |
| `NASDAQ:NDX` | Nasdaq 100 Index |
| `SPX` | S&P 500 Index |
| `SSE:000001` | SSE Composite Index |
| `TVC:NDQ` | US 100 Index |
| `TVC:NI225` | Japan 225 Index |
| `XETR:DAX` | DAX Index |

## Commodities (5)

| Symbol | Name |
| --- | --- |
| `COMEX:GC1` | Gold Futures |
| `COMEX:HG1` | Copper Futures |
| `NYMEX:CL1` | Light Crude Oil Futures |
| `NYMEX:MCL1` | Micro WTI Crude Oil Futures |
| `NYMEX:NG1` | Natural Gas Futures |

## Crypto (3)

| Symbol | Name |
| --- | --- |
| `BTCUSD` | Bitcoin |
| `ETHUSD` | Ethereum |
| `TOTAL` | Crypto Total Market Cap, $ |

## Currencies (4)

| Symbol | Name |
| --- | --- |
| `AUDUSD` | Australian Dollar / U.S. Dollar |
| `CADJPY` | Canadian Dollar / Japanese Yen |
| `NZDJPY` | New Zealand Dollar / Japanese Yen |
| `TVC:DXY` | U.S. Dollar Index |

## Rates and economy (3)

| Symbol | Name |
| --- | --- |
| `ECONOMICS:USINTR` | US interest rate |
| `ECONOMICS:USIRYY` | US inflation rate YoY |
| `TVC:US10Y` | US Government Bonds 10 YR Yield |

