import 'server-only';
import { CHART_MARKET_PRODUCTS } from '@/content/chartMarket';

/**
 * The Pine Script behind a product, and the gate in front of it.
 *
 * `server-only` is the point of the file. The rule the section is built on —
 * anybody may read the catalogue, only a buyer may read the code — is worth
 * exactly as much as the weakest place the code appears, and the weakest place
 * is a React prop that looked private because a `filter: blur()` was painted
 * over it. Blur is a visual effect; the text is still in the document, still in
 * the HTML the server sent, and still one "view source" away.
 *
 * So the source never enters a component's props unless `sourceFor` has already
 * been told the viewer owns the product. Importing this from a client component
 * is a build error rather than a review comment.
 */

/**
 * Sample scripts, matching the sample catalogue.
 *
 * Each is short and real Pine — enough that an unlocked panel shows something
 * worth reading, not so much that the demo pretends to be a shipped product.
 */
const SOURCES: Record<string, string> = {
  'trend-strength-pro': `//@version=6
indicator("Trend Strength Pro", overlay = true)

length    = input.int(20, "Length", minval = 2, maxval = 400)
smoothing = input.string("EMA", "Smoothing", options = ["EMA", "SMA"])
confirm   = input.bool(true, "Require momentum confirmation")

basis    = smoothing == "EMA" ? ta.ema(close, length) : ta.sma(close, length)
strength = ta.rma(math.abs(close - close[1]), length)
momentum = ta.rsi(close, length)

trending = close > basis and strength > ta.sma(strength, length)
agreed   = confirm ? momentum > 50 : true
entry    = ta.crossover(close, basis) and trending and agreed

plot(basis, "Basis", color = color.new(color.purple, 0), linewidth = 2)
plotshape(entry, "Entry", shape.triangleup, location.belowbar,
     color.new(color.green, 0), size = size.tiny)

alertcondition(entry, "Trend entry", "Trend and momentum agree on {{ticker}}")`,

  'rsi-divergence-scanner': `//@version=6
indicator("RSI Divergence Scanner", overlay = false)

length   = input.int(14, "RSI length", minval = 2, maxval = 100)
leftBars = input.int(5, "Pivot left", minval = 1, maxval = 50)
rightBars = input.int(5, "Pivot right", minval = 1, maxval = 50)

osc = ta.rsi(close, length)

pivotLow  = ta.pivotlow(osc, leftBars, rightBars)
pivotHigh = ta.pivothigh(osc, leftBars, rightBars)

regularBull = not na(pivotLow) and osc[rightBars] > ta.valuewhen(not na(pivotLow), osc[rightBars], 1)
     and low[rightBars] < ta.valuewhen(not na(pivotLow), low[rightBars], 1)
hiddenBull  = not na(pivotLow) and osc[rightBars] < ta.valuewhen(not na(pivotLow), osc[rightBars], 1)
     and low[rightBars] > ta.valuewhen(not na(pivotLow), low[rightBars], 1)

plot(osc, "RSI", color = color.new(color.teal, 0))
hline(70, "Upper", color = color.new(color.gray, 60))
hline(30, "Lower", color = color.new(color.gray, 60))

plotshape(regularBull, "Regular bullish", shape.circle, location.bottom,
     color.new(color.green, 0), size = size.tiny)
plotshape(hiddenBull, "Hidden bullish", shape.circle, location.bottom,
     color.new(color.blue, 0), size = size.tiny)`,

  'order-blocks-liquidity': `//@version=6
indicator("Order Blocks & Liquidity", overlay = true, max_boxes_count = 200)

lookback  = input.int(20, "Structure lookback", minval = 5, maxval = 200)
showGaps  = input.bool(true, "Fair value gaps")
expiry    = input.int(120, "Zone lifetime in bars", minval = 10, maxval = 1000)

swingHigh = ta.pivothigh(high, lookback, lookback)
swingLow  = ta.pivotlow(low, lookback, lookback)

sweptHigh = high > ta.highest(high[1], lookback) and close < ta.highest(high[1], lookback)
sweptLow  = low  < ta.lowest(low[1], lookback)   and close > ta.lowest(low[1], lookback)

if showGaps and low > high[2]
    box.new(bar_index[2], low, bar_index, high[2],
         border_color = color.new(color.teal, 40),
         bgcolor = color.new(color.teal, 90))

plotshape(sweptHigh, "Sell-side sweep", shape.triangledown, location.abovebar,
     color.new(color.red, 0), size = size.tiny)
plotshape(sweptLow, "Buy-side sweep", shape.triangleup, location.belowbar,
     color.new(color.green, 0), size = size.tiny)`,

  'mean-reversion-strategy': `//@version=6
strategy("Mean Reversion Strategy", overlay = true,
     default_qty_type = strategy.percent_of_equity, default_qty_value = 10)

length   = input.int(20, "Band length", minval = 5, maxval = 200)
width    = input.float(2.0, "Band width", minval = 0.5, maxval = 5)
riskPct  = input.float(1.0, "Risk per trade %", minval = 0.1, maxval = 5)
atrLen   = input.int(14, "ATR length", minval = 2, maxval = 100)

basis = ta.sma(close, length)
dev   = width * ta.stdev(close, length)
upper = basis + dev
lower = basis - dev
atr   = ta.atr(atrLen)

stopDistance = atr * 1.5
size = (strategy.equity * riskPct / 100) / math.max(stopDistance, syminfo.mintick)

if ta.crossover(close, lower)
    strategy.entry("Long", strategy.long, qty = size)
    strategy.exit("Long stop", "Long", stop = close - stopDistance, limit = basis)

plot(basis, "Basis", color = color.new(color.gray, 0))
plot(upper, "Upper", color = color.new(color.red, 40))
plot(lower, "Lower", color = color.new(color.green, 40))`,

  'vwap-suite': `//@version=6
indicator("VWAP Suite", overlay = true)

mode      = input.string("Session", "Mode", options = ["Session", "Anchored", "Rolling"])
rollLen   = input.int(200, "Rolling length", minval = 10, maxval = 5000)
bands     = input.int(2, "Standard deviation bands", minval = 0, maxval = 3)
anchorBar = input.time(timestamp("2024-01-01"), "Anchor")

src = hlc3
newSession = ta.change(time("D")) != 0

var float cumulativePv = na
var float cumulativeVol = na
cumulativePv  := (mode == "Session" and newSession) or na(cumulativePv) ? src * volume : cumulativePv + src * volume
cumulativeVol := (mode == "Session" and newSession) or na(cumulativeVol) ? volume : cumulativeVol + volume

vwap = mode == "Rolling" ? ta.vwma(src, rollLen) : cumulativePv / cumulativeVol
dev  = ta.stdev(src, mode == "Rolling" ? rollLen : 20)

plot(vwap, "VWAP", color = color.new(color.blue, 0), linewidth = 2)
plot(bands > 0 ? vwap + dev : na, "Upper 1", color = color.new(color.blue, 60))
plot(bands > 0 ? vwap - dev : na, "Lower 1", color = color.new(color.blue, 60))`,

  'session-highs-lows': `//@version=5
indicator("Session Highs & Lows", overlay = true)

asia    = input.session("0000-0800", "Asia")
london  = input.session("0800-1600", "London")
newYork = input.session("1330-2000", "New York")
extend  = input.bool(true, "Extend range into the next session")

inSession(spec) => not na(time(timeframe.period, spec, syminfo.timezone))

var float asiaHigh = na
var float asiaLow  = na

asiaNow = inSession(asia)
if asiaNow and not asiaNow[1]
    asiaHigh := high
    asiaLow  := low
else if asiaNow
    asiaHigh := math.max(asiaHigh, high)
    asiaLow  := math.min(asiaLow, low)

plot(extend or asiaNow ? asiaHigh : na, "Asia high", color = color.new(color.orange, 20))
plot(extend or asiaNow ? asiaLow : na, "Asia low", color = color.new(color.orange, 20))`,

  'breakout-signal-engine': `//@version=6
indicator("Breakout Signal Engine", overlay = true)

rangeLen   = input.int(20, "Range length", minval = 5, maxval = 200)
squeezePct = input.float(60, "Compression percentile", minval = 10, maxval = 100)
waitRetest = input.bool(true, "Wait for retest")

width     = ta.highest(high, rangeLen) - ta.lowest(low, rangeLen)
compressed = width < ta.percentile_linear_interpolation(width, 100, squeezePct)

breakUp = compressed[1] and close > ta.highest(high, rangeLen)[1]
retest  = breakUp[1] and low <= ta.highest(high, rangeLen)[2] and close > ta.highest(high, rangeLen)[2]

signal = waitRetest ? retest : breakUp

plot(ta.highest(high, rangeLen), "Range high", color = color.new(color.gray, 60))
plot(ta.lowest(low, rangeLen), "Range low", color = color.new(color.gray, 60))
plotshape(signal, "Breakout", shape.triangleup, location.belowbar,
     color.new(color.lime, 0), size = size.tiny)

alertcondition(signal, "Breakout", "Breakout confirmed on {{ticker}}")`,

  'position-size-calculator': `//@version=6
indicator("Position Size Calculator", overlay = true)

account = input.float(10000, "Account size", minval = 1)
riskPct = input.float(1.0, "Risk %", minval = 0.05, maxval = 10)
stop    = input.price(0.0, "Stop level")
target1 = input.price(0.0, "Target 1")
fees    = input.float(0.0, "Fees per trade", minval = 0)

distance = math.abs(close - stop)
risk     = account * riskPct / 100
size     = distance > 0 ? (risk - fees) / distance : 0
rMultiple = distance > 0 ? math.abs(target1 - close) / distance : 0

var table panel = table.new(position.top_right, 2, 4, border_width = 1)
if barstate.islast
    table.cell(panel, 0, 0, "Risk",   text_size = size.small)
    table.cell(panel, 1, 0, str.tostring(risk, "#.##"), text_size = size.small)
    table.cell(panel, 0, 1, "Size",   text_size = size.small)
    table.cell(panel, 1, 1, str.tostring(size, "#.####"), text_size = size.small)
    table.cell(panel, 0, 2, "Target R", text_size = size.small)
    table.cell(panel, 1, 2, str.tostring(rMultiple, "#.##"), text_size = size.small)`,

  'multi-timeframe-dashboard': `//@version=6
indicator("Multi-Timeframe Dashboard", overlay = true)

tf1 = input.timeframe("15", "Timeframe 1")
tf2 = input.timeframe("60", "Timeframe 2")
tf3 = input.timeframe("240", "Timeframe 3")
compact = input.bool(false, "Compact layout")

state(simple string tf) =>
    ma  = request.security(syminfo.tickerid, tf, ta.ema(close, 50))
    px  = request.security(syminfo.tickerid, tf, close)
    rsi = request.security(syminfo.tickerid, tf, ta.rsi(close, 14))
    trend = px > ma ? "above 50 EMA" : "below 50 EMA"
    momentum = rsi > 55 ? "rising" : rsi < 45 ? "falling" : "flat"
    trend + " · " + momentum

var table panel = table.new(position.bottom_right, 2, 4, border_width = 1)
if barstate.islast
    table.cell(panel, 0, 0, tf1, text_size = compact ? size.tiny : size.small)
    table.cell(panel, 1, 0, state(tf1), text_size = compact ? size.tiny : size.small)
    table.cell(panel, 0, 1, tf2, text_size = compact ? size.tiny : size.small)
    table.cell(panel, 1, 1, state(tf2), text_size = compact ? size.tiny : size.small)
    table.cell(panel, 0, 2, tf3, text_size = compact ? size.tiny : size.small)
    table.cell(panel, 1, 2, state(tf3), text_size = compact ? size.tiny : size.small)`,
};

/**
 * The source, or null.
 *
 * `owned` is a required argument rather than an option with a default, so a
 * caller cannot get the code by forgetting to say whether it is allowed to.
 */
export function sourceFor(productId: string, owned: boolean): string | null {
  if (!owned) return null;
  return SOURCES[productId] ?? null;
}

/**
 * Every product has a script behind it.
 *
 * A catalogue entry with no source would sell nothing, and the failure would
 * only appear after somebody paid. Called by the section's test so the two
 * lists cannot drift apart quietly.
 */
export function productsMissingSource(): string[] {
  return CHART_MARKET_PRODUCTS.filter((product) => !SOURCES[product.id]).map(
    (product) => product.id
  );
}
