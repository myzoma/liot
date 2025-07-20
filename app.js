class CryptoAPI {
    constructor() {
        this.baseURL = 'https://api.binance.com/api/v3';
        this.requestCount = 0;
        this.lastRequestTime = 0;
        this.rateLimitDelay = 100; // 100ms بين الطلبات
    }

    // إدارة معدل الطلبات
    async rateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.rateLimitDelay) {
            await new Promise(resolve => 
                setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest)
            );
        }
        
        this.lastRequestTime = Date.now();
        this.requestCount++;
    }

    // جلب بيانات الشموع من Binance
    async getKlineData(symbol, interval, limit = 100) {
        try {
            await this.rateLimit();
            
            const url = `${this.baseURL}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
            
            console.log(`جاري جلب البيانات: ${symbol} - ${interval} - ${limit} شمعة`);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!Array.isArray(data) || data.length === 0) {
                throw new Error('لا توجد بيانات متاحة للرمز المحدد');
            }
            
            console.log(`تم جلب ${data.length} شمعة بنجاح`);
            
            return data;
            
        } catch (error) {
            console.error(`خطأ في جلب البيانات لـ ${symbol}:`, error.message);
            throw new Error(`فشل في جلب البيانات: ${error.message}`);
        }
    }

    // جلب معلومات الرمز
    async getSymbolInfo(symbol) {
        try {
            await this.rateLimit();
            
            const url = `${this.baseURL}/ticker/24hr?symbol=${symbol}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }
            
            const data = await response.json();
            
            return {
                symbol: data.symbol,
                price: parseFloat(data.lastPrice),
                change: parseFloat(data.priceChange),
                changePercent: parseFloat(data.priceChangePercent),
                volume: parseFloat(data.volume),
                high24h: parseFloat(data.highPrice),
                low24h: parseFloat(data.lowPrice)
            };
            
        } catch (error) {
            console.error(`خطأ في جلب معلومات ${symbol}:`, error.message);
            return null;
        }
    }

    // جلب بيانات متعددة الرموز
    async getMultipleSymbolsData(symbols, interval, limit = 100) {
        const results = [];
        const errors = [];
        
        for (const symbol of symbols) {
            try {
                console.log(`معالجة ${symbol}...`);
                
                const [klineData, symbolInfo] = await Promise.all([
                    this.getKlineData(symbol, interval, limit),
                    this.getSymbolInfo(symbol)
                ]);
                
                results.push({
                    symbol,
                    klineData,
                    symbolInfo,
                    success: true
                });
                
                // تأخير قصير بين الطلبات
                await new Promise(resolve => setTimeout(resolve, 200));
                
            } catch (error) {
                console.error(`خطأ في معالجة ${symbol}:`, error.message);
                errors.push({
                    symbol,
                    error: error.message
                });
                
                results.push({
                    symbol,
                    success: false,
                    error: error.message
                });
            }
        }
        
        return {
            results,
            errors,
            successCount: results.filter(r => r.success).length,
            totalCount: symbols.length
        };
    }

    // التحقق من صحة الرمز
    validateSymbol(symbol) {
        if (!symbol || typeof symbol !== 'string') {
            return false;
        }
        
        // التحقق من تنسيق الرمز
        const symbolRegex = /^[A-Z]{2,10}USDT?$/;
        return symbolRegex.test(symbol.toUpperCase());
    }

    // التحقق من صحة الفترة الزمنية
    validateInterval(interval) {
        const validIntervals = [
            '1m', '3m', '5m', '15m', '30m',
            '1h', '2h', '4h', '6h', '8h', '12h',
            '1d', '3d', '1w', '1M'
        ];
        
        return validIntervals.includes(interval);
    }

    // الحصول على إحصائيات الاستخدام
    getUsageStats() {
        return {
            requestCount: this.requestCount,
            lastRequestTime: this.lastRequestTime,
            rateLimitDelay: this.rateLimitDelay
        };
    }

    // إعادة تعيين إحصائيات الاستخدام
    resetUsageStats() {
        this.requestCount = 0;
        this.lastRequestTime = 0;
    }
}

// تصدير الكلاس
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CryptoAPI;
} else if (typeof window !== 'undefined') {
    window.CryptoAPI = CryptoAPI;
}
