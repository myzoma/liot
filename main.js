class ElliottWaveApp {
    constructor() {
        this.api = new CryptoAPI();
        this.analyzer = new ElliottWaveAnalyzer();
        this.analysisHistory = [];
        this.isAnalyzing = false;
        
        console.log('تم تهيئة تطبيق Elliott Wave بنجاح');
    }

    // تحليل رمز واحد
    async analyzeSingle(symbol, interval, limit = 100) {
        if (this.isAnalyzing) {
            throw new Error('يتم تنفيذ تحليل آخر حالياً، يرجى الانتظار');
        }

        this.isAnalyzing = true;

        try {
            // التحقق من صحة المدخلات
            if (!this.api.validateSymbol(symbol)) {
                throw new Error('رمز العملة غير صحيح');
            }

            if (!this.api.validateInterval(interval)) {
                throw new Error('الفترة الزمنية غير صحيحة');
            }

            if (limit < 50 || limit > 1000) {
                throw new Error('عدد الشموع يجب أن يكون بين 50 و 1000');
            }

            console.log(`بدء تحليل ${symbol} على فترة ${interval}`);

            // جلب البيانات
            const klineData = await this.api.getKlineData(symbol, interval, limit);
            const symbolInfo = await this.api.getSymbolInfo(symbol);

            // تنفيذ التحليل
            const analysis = this.analyzer.analyze(klineData);

            // إنشاء النتيجة النهائية
            const result = {
                symbol,
                interval,
                timestamp: Date.now(),
                currentPrice: symbolInfo ? symbolInfo.price : null,
                change24h: symbolInfo ? symbolInfo.changePercent : null,
                analysis,
                success: analysis.status === 'success'
            };

            // إضافة معلومات إضافية للنتيجة
            if (analysis.status === 'success') {
                result.pattern = this.getMainPatternDescription(analysis);
                result.currentWave = analysis.currentWaveAnalysis ? 
                    this.analyzer.translateWaveType(analysis.currentWaveAnalysis.currentWave) : 'غير محدد';
                result.trend = this.analyzer.translateTrend(analysis.trend);
                result.confidence = analysis.patterns.length > 0 ? 
                    Math.round(analysis.patterns[0].confidence) : 0;
                result.prediction = this.generatePrediction(analysis);
                result.levels = this.extractKeyLevels(analysis);
            }

            // حفظ في التاريخ
            this.analysisHistory.push(result);
            
            // الاحتفاظ بآخر 50 تحليل فقط
            if (this.analysisHistory.length > 50) {
                this.analysisHistory = this.analysisHistory.slice(-50);
            }

            console.log(`تم إكمال تحليل ${symbol} بنجاح`);
            return result;

        } catch (error) {
            console.error(`خطأ في تحليل ${symbol}:`, error.message);
            
            const errorResult = {
                symbol,
                interval,
                timestamp: Date.now(),
                success: false,
                error: error.message,
                analysis: { status: 'error', message: error.message }
            };

            this.analysisHistory.push(errorResult);
            return errorResult;

        } finally {
            this.isAnalyzing = false;
        }
    }

    // تحليل متعدد الرموز
    async analyzeMultiple(symbols, interval, limit = 100) {
        if (this.isAnalyzing) {
            throw new Error('يتم تنفيذ تحليل آخر حالياً، يرجى الانتظار');
        }

        this.isAnalyzing = true;
        const results = [];

        try {
            console.log(`بدء التحليل المتعدد لـ ${symbols.length} رمز`);

            for (let i = 0; i < symbols.length; i++) {
                const symbol = symbols[i];
                
                try {
                    console.log(`تحليل ${symbol} (${i + 1}/${symbols.length})`);
                    
                    const result = await this.analyzeSingleInternal(symbol, interval, limit);
                    results.push(result);
                    
                    // تأخير بين التحليلات لتجنب الضغط على API
                    if (i < symbols.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                    
                } catch (error) {
                    console.error(`خطأ في تحليل ${symbol}:`, error.message);
                    results.push({
                        symbol,
                        interval,
                        timestamp: Date.now(),
                        success: false,
                        error: error.message
                    });
                }
            }

            // ترتيب النتائج حسب مستوى الثقة
            results.sort((a, b) => {
                const confidenceA = a.confidence || 0;
                const confidenceB = b.confidence || 0;
                return confidenceB - confidenceA;
            });

            console.log(`تم إكمال التحليل المتعدد: ${results.filter(r => r.success).length}/${symbols.length} نجح`);
            return results;

        } catch (error) {
            console.error('خطأ في التحليل المتعدد:', error.message);
            throw error;
        } finally {
            this.isAnalyzing = false;
        }
    }

    // تحليل داخلي (بدون قفل)
    async analyzeSingleInternal(symbol, interval, limit) {
        const klineData = await this.api.getKlineData(symbol, interval, limit);
        const symbolInfo = await this.api.getSymbolInfo(symbol);
        const analysis = this.analyzer.analyze(klineData);

        const result = {
            symbol,
            interval,
            timestamp: Date.now(),
            currentPrice: symbolInfo ? symbolInfo.price : null,
            change24h: symbolInfo ? symbolInfo.changePercent : null,
            analysis,
            success: analysis.status === 'success'
        };

        if (analysis.status === 'success') {
            result.pattern = this.getMainPatternDescription(analysis);
            result.currentWave = analysis.currentWaveAnalysis ? 
                this.analyzer.translateWaveType(analysis.currentWaveAnalysis.currentWave) : 'غير محدد';
            result.trend = this.analyzer.translateTrend(analysis.trend);
            result.confidence = analysis.patterns.length > 0 ? 
                Math.round(analysis.patterns[0].confidence) : 0;
            result.prediction = this.generatePrediction(analysis);
            result.levels = this.extractKeyLevels(analysis);
        }

        return result;
    }

    // وصف النمط الرئيسي
    getMainPatternDescription(analysis) {
        if (!analysis.patterns || analysis.patterns.length === 0) {
            return 'لا يوجد نمط واضح';
        }

        const mainPattern = analysis.patterns[0];
        const typeAr = mainPattern.type === 'motive' ? 'دافع' : 'تصحيحي';
        const directionAr = mainPattern.direction === 'bullish' ? 'صاعد' : 'هابط';
        
        return `نمط ${typeAr} ${directionAr}`;
    }

    // توليد التنبؤ
    generatePrediction(analysis) {
        if (!analysis.recommendations || analysis.recommendations.length === 0) {
            return 'لا توجد توصيات واضحة';
        }

        const mainRec = analysis.recommendations[0];
        
        switch (mainRec.type) {
            case 'buy':
                return `توقع صعود - هدف: ${mainRec.targets ? mainRec.targets[0] : 'غير محدد'}`;
            case 'sell':
                return `توقع هبوط - هدف: ${mainRec.targets ? mainRec.targets[0] : 'غير محدد'}`;
            case 'wait':
                return 'انتظار اكتمال النمط الحالي';
            case 'caution':
                return 'حذر - إشارات متضاربة';
            default:
                return mainRec.message || 'غير محدد';
        }
    }

       // استخراج المستويات المهمة
    extractKeyLevels(analysis) {
        const levels = {
            support: [],
            resistance: [],
            targets: []
        };

        if (analysis.dynamicLevels) {
            levels.support = analysis.dynamicLevels.support.slice(0, 3); // أهم 3 مستويات دعم
            levels.resistance = analysis.dynamicLevels.resistance.slice(0, 3); // أهم 3 مستويات مقاومة
            levels.targets = analysis.dynamicLevels.targets.slice(0, 3); // أهم 3 أهداف
        }

        // إضافة مستويات من التوصيات
        if (analysis.recommendations && analysis.recommendations.length > 0) {
            const mainRec = analysis.recommendations[0];
            if (mainRec.targets) {
                levels.targets = [...levels.targets, ...mainRec.targets.slice(0, 2)];
            }
            if (mainRec.stopLoss) {
                if (mainRec.type === 'buy') {
                    levels.support.push(mainRec.stopLoss);
                } else {
                    levels.resistance.push(mainRec.stopLoss);
                }
            }
        }

        // إزالة المكررات وترتيب
        levels.support = [...new Set(levels.support)].sort((a, b) => b - a);
        levels.resistance = [...new Set(levels.resistance)].sort((a, b) => a - b);
        levels.targets = [...new Set(levels.targets)].sort((a, b) => a - b);

        return levels;
    }

    // الحصول على تاريخ التحليلات
    getAnalysisHistory(limit = 10) {
        return this.analysisHistory.slice(-limit).reverse();
    }

    // البحث في التاريخ
    searchHistory(symbol) {
        return this.analysisHistory.filter(analysis => 
            analysis.symbol.toLowerCase().includes(symbol.toLowerCase())
        ).reverse();
    }

    // مسح التاريخ
    clearHistory() {
        this.analysisHistory = [];
        console.log('تم مسح تاريخ التحليلات');
    }

    // إحصائيات التطبيق
    getAppStats() {
        const successfulAnalyses = this.analysisHistory.filter(a => a.success).length;
        const totalAnalyses = this.analysisHistory.length;
        
        return {
            totalAnalyses,
            successfulAnalyses,
            successRate: totalAnalyses > 0 ? (successfulAnalyses / totalAnalyses * 100).toFixed(1) : 0,
            apiStats: this.api.getUsageStats(),
            lastAnalysis: this.analysisHistory.length > 0 ? 
                this.analysisHistory[this.analysisHistory.length - 1].timestamp : null
        };
    }

    // تصدير النتائج إلى JSON
    exportResults(results) {
        const exportData = {
            timestamp: Date.now(),
            exportDate: new Date().toISOString(),
            results: results,
            appStats: this.getAppStats()
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `elliott-wave-analysis-${Date.now()}.json`;
        link.click();
        
        console.log('تم تصدير النتائج بنجاح');
    }

    // تحليل سريع للرموز الشائعة
    async quickAnalysis() {
        const popularSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT'];
        const interval = '4h';
        const limit = 100;

        console.log('بدء التحليل السريع للرموز الشائعة...');
        
        try {
            const results = await this.analyzeMultiple(popularSymbols, interval, limit);
            
            // فلترة النتائج الناجحة فقط
            const successfulResults = results.filter(r => r.success && r.confidence > 60);
            
            console.log(`التحليل السريع مكتمل: ${successfulResults.length} نتيجة عالية الجودة`);
            
            return {
                results: successfulResults,
                summary: this.generateQuickAnalysisSummary(successfulResults),
                timestamp: Date.now()
            };
            
        } catch (error) {
            console.error('خطأ في التحليل السريع:', error.message);
            throw error;
        }
    }

    // ملخص التحليل السريع
    generateQuickAnalysisSummary(results) {
        if (results.length === 0) {
            return 'لا توجد إشارات قوية في الرموز المحللة';
        }

        const bullishCount = results.filter(r => r.trend && r.trend.includes('صاعد')).length;
        const bearishCount = results.filter(r => r.trend && r.trend.includes('هابط')).length;
        const avgConfidence = results.reduce((sum, r) => sum + (r.confidence || 0), 0) / results.length;

        let summary = `تم تحليل ${results.length} رمز بنجاح. `;
        summary += `${bullishCount} إشارات صاعدة، ${bearishCount} إشارات هابطة. `;
        summary += `متوسط مستوى الثقة: ${avgConfidence.toFixed(1)}%.`;

        return summary;
    }

    // مراقبة الرمز (محاكاة)
    async monitorSymbol(symbol, interval, callback, duration = 300000) { // 5 دقائق افتراضي
        console.log(`بدء مراقبة ${symbol} لمدة ${duration / 1000} ثانية`);
        
        const startTime = Date.now();
        const monitorInterval = 60000; // فحص كل دقيقة
        
        const monitor = async () => {
            try {
                const result = await this.analyzeSingle(symbol, interval, 100);
                
                if (callback && typeof callback === 'function') {
                    callback(result);
                }
                
                // التحقق من انتهاء وقت المراقبة
                if (Date.now() - startTime < duration) {
                    setTimeout(monitor, monitorInterval);
                } else {
                    console.log(`انتهت مراقبة ${symbol}`);
                }
                
            } catch (error) {
                console.error(`خطأ في مراقبة ${symbol}:`, error.message);
            }
        };
        
        // بدء المراقبة
        monitor();
    }

    // فحص حالة التطبيق
    getAppStatus() {
        return {
            isAnalyzing: this.isAnalyzing,
            historyCount: this.analysisHistory.length,
            apiStatus: 'متصل', // يمكن تحسينها لفحص حقيقي
            lastActivity: this.analysisHistory.length > 0 ? 
                new Date(this.analysisHistory[this.analysisHistory.length - 1].timestamp).toLocaleString('ar-SA') : 'لا يوجد',
            version: '1.0.0'
        };
    }

    // تحديث إعدادات المحلل
    updateAnalyzerConfig(newConfig) {
        try {
            this.analyzer = new ElliottWaveAnalyzer(newConfig);
            console.log('تم تحديث إعدادات المحلل بنجاح');
            return true;
        } catch (error) {
            console.error('خطأ في تحديث الإعدادات:', error.message);
            return false;
        }
    }

    // الحصول على الإعدادات الحالية
    getCurrentConfig() {
        return this.analyzer.config;
    }

    // تحليل مخصص مع إعدادات محددة
    async customAnalysis(symbol, interval, limit, customConfig) {
        const originalAnalyzer = this.analyzer;
        
        try {
            // إنشاء محلل مؤقت بالإعدادات المخصصة
            this.analyzer = new ElliottWaveAnalyzer(customConfig);
            
            const result = await this.analyzeSingle(symbol, interval, limit);
            
            return result;
            
        } catch (error) {
            throw error;
        } finally {
            // استعادة المحلل الأصلي
            this.analyzer = originalAnalyzer;
        }
    }

    // مقارنة بين فترات زمنية مختلفة
    async compareTimeframes(symbol, intervals = ['1h', '4h', '1d'], limit = 100) {
        console.log(`مقارنة ${symbol} عبر فترات زمنية مختلفة`);
        
        const comparisons = [];
        
        for (const interval of intervals) {
            try {
                const result = await this.analyzeSingleInternal(symbol, interval, limit);
                comparisons.push({
                    interval,
                    ...result
                });
                
                // تأخير قصير بين الطلبات
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                console.error(`خطأ في تحليل ${interval}:`, error.message);
                comparisons.push({
                    interval,
                    success: false,
                    error: error.message
                });
            }
        }
        
        return {
            symbol,
            comparisons,
            summary: this.generateTimeframeComparison(comparisons),
            timestamp: Date.now()
        };
    }

    // ملخص مقارنة الفترات الزمنية
    generateTimeframeComparison(comparisons) {
        const successful = comparisons.filter(c => c.success);
        
        if (successful.length === 0) {
            return 'فشل في تحليل جميع الفترات الزمنية';
        }
        
        const trends = successful.map(c => c.trend).filter(t => t);
        const bullishCount = trends.filter(t => t.includes('صاعد')).length;
        const bearishCount = trends.filter(t => t.includes('هابط')).length;
        
        let summary = `تم تحليل ${successful.length} فترة زمنية. `;
        
        if (bullishCount > bearishCount) {
            summary += 'الاتجاه العام صاعد عبر معظم الفترات.';
        } else if (bearishCount > bullishCount) {
            summary += 'الاتجاه العام هابط عبر معظم الفترات.';
        } else {
            summary += 'اتجاهات متضاربة عبر الفترات المختلفة.';
        }
        
        return summary;
    }
}

// دوال مساعدة عامة
const ElliottWaveUtils = {
    // تنسيق الأرقام
    formatNumber(num, decimals = 2) {
        if (typeof num !== 'number') return 'غير محدد';
        return num.toLocaleString('ar-SA', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    },

    // تنسيق النسبة المئوية
    formatPercentage(num, decimals = 1) {
        if (typeof num !== 'number') return 'غير محدد';
        return `${num.toFixed(decimals)}%`;
    },

    // تنسيق الوقت
    formatTime(timestamp) {
        return new Date(timestamp).toLocaleString('ar-SA');
    },

    // تحديد لون الاتجاه
    getTrendColor(trend) {
        if (!trend) return '#6c757d';
        if (trend.includes('صاعد')) return '#28a745';
        if (trend.includes('هابط')) return '#dc3545';
        return '#ffc107';
    },

    // تحديد أيقونة الاتجاه
    getTrendIcon(trend) {
        if (!trend) return '➡️';
        if (trend.includes('صاعد')) return '📈';
        if (trend.includes('هابط')) return '📉';
        return '⚠️';
    },

    // التحقق من صحة البيانات
    validateAnalysisResult(result) {
        return result && 
               typeof result === 'object' && 
               result.hasOwnProperty('success') &&
               result.hasOwnProperty('symbol') &&
               result.hasOwnProperty('timestamp');
    },

    // حساب الإحصائيات
    calculateStats(results) {
        if (!Array.isArray(results) || results.length === 0) {
            return {
                total: 0,
                successful: 0,
                failed: 0,
                successRate: 0,
                avgConfidence: 0
            };
        }

        const successful = results.filter(r => r.success);
        const avgConfidence = successful.length > 0 ? 
            successful.reduce((sum, r) => sum + (r.confidence || 0), 0) / successful.length : 0;

        return {
            total: results.length,
            successful: successful.length,
            failed: results.length - successful.length,
            successRate: (successful.length / results.length * 100).toFixed(1),
            avgConfidence: avgConfidence.toFixed(1)
        };
    }
};

// تصدير الكلاسات والدوال
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ElliottWaveApp,
        ElliottWaveUtils
    };
} else if (typeof window !== 'undefined') {
    window.ElliottWaveApp = ElliottWaveApp;
    window.ElliottWaveUtils = ElliottWaveUtils;
}

