class ElliottWaveRadar {
    constructor() {
        this.symbols = [];
        this.results = [];
        this.chart = null;
        this.stats = {
            total: 0,
            bullish: 0,
            bearish: 0,
            avgConfidence: 0
        };
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initChart();
        this.runRadar();
    }

    setupEventListeners() {
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.filterResults(e.target.dataset.filter);
            });
        });

        // Modal close
        document.querySelector('.close').addEventListener('click', () => {
            document.getElementById('recommendationModal').style.display = 'none';
        });

        // Copy recommendation
        document.getElementById('copyRecommendation').addEventListener('click', () => {
            this.copyRecommendation();
        });

        // Close modal on outside click
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('recommendationModal');
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    initChart() {
        // تدمير المخطط السابق إذا كان موجوداً
        if (this.chart) {
            this.chart.destroy();
        }

        const ctx = document.getElementById('signalsChart').getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['إشارات صاعدة', 'إشارات هابطة', 'محايد'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: [
                        '#00ff88',
                        '#ff4757',
                        '#ffa502'
                    ],
                    borderColor: '#1a1a2e',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#ffffff',
                            padding: 20,
                            font: {
                                size: 14
                            }
                        }
                    }
                }
            }
        });
    }

    async fetchTopSymbols(limit = 100) {
        try {
            const res = await fetch('https://api.binance.com/api/v3/ticker/24hr');
            const data = await res.json();
            return data
                .filter(d => d.symbol.endsWith('USDT') && 
                           !d.symbol.includes('UP') && 
                           !d.symbol.includes('DOWN'))
                .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
                .slice(0, limit)
                .map(d => d.symbol);
        } catch (error) {
            console.error('خطأ في جلب العملات:', error);
            return [];
        }
    }

    async fetchKlines(symbol, interval = '1h', limit = 120) {
        try {
            const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
            const res = await fetch(url);
            const data = await res.json();
            return data.map(k => [k[0], k[1], k[2], k[3], k[4], k[5]]);
        } catch (error) {
            console.error(`خطأ في جلب بيانات ${symbol}:`, error);
            return null;
        }
    }

    async analyzeSymbol(symbol) {
        try {
            const data = await this.fetchKlines(symbol);
            if (!data) return;

            // استخدام محللك الموجود
            const analyzer = new ElliottWaveAnalyzer();
            const result = analyzer.analyze(data);
            
            if (result.status === 'success' && result.patterns.length > 0) {
                const pattern = result.patterns[0];
                if (pattern.confidence >= 75) {
                    const analysisResult = {
                        symbol,
                        pattern,
                        trend: result.trend,
                        wave: result.currentWaveAnalysis,
                        targets: this.calculateTargets(data, pattern),
                        recommendation: this.generateRecommendation(pattern, result.trend, data)
                    };
                    
                    this.results.push(analysisResult);
                    this.updateStats();
                    this.renderCard(analysisResult);
                }
            }
        } catch (error) {
            console.warn(`❌ خطأ في تحليل ${symbol}:`, error.message);
        }
    }

    calculateTargets(data, pattern) {
        const currentPrice = parseFloat(data[data.length - 1][4]);
        const high = Math.max(...data.slice(-20).map(d => parseFloat(d[2])));
        const low = Math.min(...data.slice(-20).map(d => parseFloat(d[3])));
        
        let targets = {};
        
        if (pattern.direction === 'bullish') {
            targets.target1 = currentPrice * 1.05;
            targets.target2 = currentPrice * 1.10;
            targets.target3 = currentPrice * 1.15;
            targets.stopLoss = low * 0.98;
        } else {
            targets.target1 = currentPrice * 0.95;
            targets.target2 = currentPrice * 0.90;
            targets.target3 = currentPrice * 0.85;
            targets.stopLoss = high * 1.02;
        }
        
        return targets;
    }

    generateRecommendation(pattern, trend, data) {
        const currentPrice = parseFloat(data[data.length - 1][4]);
        const direction = pattern.direction === 'bullish' ? 'شراء' : 'بيع';
        const confidence = pattern.confidence;
        
        return {
            action: direction,
            entry: currentPrice, // تأكد من أنه رقم
            confidence: confidence,
            timeframe: '1h - 4h',
            riskLevel: confidence > 85 ? 'منخفض' : confidence > 75 ? 'متوسط' : 'عالي'
        };
    }

    updateStats() {
        this.stats.total = this.results.length;
        this.stats.bullish = this.results.filter(r => r.pattern.direction === 'bullish').length;
        this.stats.bearish = this.results.filter(r => r.pattern.direction === 'bearish').length;
        this.stats.avgConfidence = this.results.length > 0 ? Math.round(
            this.results.reduce((sum, r) => sum + r.pattern.confidence, 0) / this.results.length
        ) : 0;

        // Update DOM
        document.getElementById('totalSymbols').textContent = this.stats.total;
        document.getElementById('bullishCount').textContent = this.stats.bullish;
        document.getElementById('bearishCount').textContent = this.stats.bearish;
        document.getElementById('avgConfidence').textContent = `${this.stats.avgConfidence}%`;

        // Update chart
        if (this.chart) {
            this.chart.data.datasets[0].data = [
                this.stats.bullish,
                this.stats.bearish,
                this.stats.total - this.stats.bullish - this.stats.bearish
            ];
            this.chart.update();
        }
    }

    renderCard(result) {
        const container = document.getElementById("results");
        const { symbol, pattern, trend, wave, targets, recommendation } = result;
        
        const trendIcon = pattern.direction === 'bullish' ? 'fa-arrow-up text-success' : 'fa-arrow-down text-danger';
        const waveText = wave?.currentWave ? this.translateWave(wave.currentWave) : 'غير محددة';
        const confidenceClass = pattern.confidence >= 85 ? 'text-success' : pattern.confidence >= 75 ? 'text-warning' : 'text-danger';
        
        const card = document.createElement("div");
        card.className = "card fade-in";
        card.dataset.direction = pattern.direction;
        card.dataset.confidence = pattern.confidence >= 85 ? 'high' : 'normal';
        
        card.innerHTML = `
            <h2><i class="fa-solid fa-coins"></i> ${symbol}</h2>
            
            <p><i class="fa-solid fa-chart-line"></i> النمط: ${this.translatePattern(pattern.type)} 
               <span class="${pattern.direction === 'bullish' ? 'text-success' : 'text-danger'}">
                   ${pattern.direction === 'bullish' ? '🚀 صاعد' : '📉 هابط'}
               </span>
            </p>
            
            <p><i class="fa-solid fa-shield-halved"></i> الثقة: 
               <span class="confidence ${confidenceClass}">${pattern.confidence}%</span>
            </p>
            
            <p><i class="fa-solid fa-location-crosshairs"></i> الموجة الحالية: ${waveText}</p>
            
            <p><i class="fa-solid ${trendIcon}"></i> الاتجاه العام: ${this.translateTrend(trend)}</p>
            
            <div class="price-targets">
                <h4><i class="fa-solid fa-bullseye"></i> الأهداف السعرية</h4>
                <p>🎯 الهدف الأول: $${targets.target1.toFixed(4)}</p>
                <p>🎯 الهدف الثاني: $${targets.target2.toFixed(4)}</p>
                <p>🎯 الهدف الثالث: $${targets.target3.toFixed(4)}</p>
                <p>🛑 وقف الخسارة: $${targets.stopLoss.toFixed(4)}</p>
            </div>
            
            <div class="wave-info">
                <h4><i class="fa-solid fa-wave-square"></i> تحليل الموجة</h4>
                <p>المرحلة: ${this.getWavePhase(wave)}</p>
                <p>التوقع: ${this.getWaveExpectation(pattern, wave)}</p>
            </div>
            
            <button class="recommendation-btn" onclick="window.radar.showRecommendation('${symbol}')">
                <i class="fa-solid fa-lightbulb"></i>
                عرض التوصية الكاملة
            </button>
        `;
        
        container.appendChild(card);
    }

    showRecommendation(symbol) {
        const result = this.results.find(r => r.symbol === symbol);
        if (!result) return;

        const { pattern, targets, recommendation, wave } = result;
        const modal = document.getElementById('recommendationModal');
        const modalBody = document.getElementById('modalBody');
        
        // التأكد من أن entry هو رقم
        const entryPrice = typeof recommendation.entry === 'number' ? 
            recommendation.entry : parseFloat(recommendation.entry) || 0;
        
        const recommendationText = this.formatRecommendation(result);
        
        modalBody.innerHTML = `
            <div class="recommendation-content">
                <h3><i class="fa-solid fa-coins"></i> ${symbol}</h3>
                
                <div class="recommendation-section">
                    <h4><i class="fa-solid fa-chart-line"></i> تحليل فني</h4>
                    <p><strong>النمط:</strong> ${this.translatePattern(pattern.type)}</p>
                    <p><strong>الاتجاه:</strong> ${pattern.direction === 'bullish' ? 'صاعد 🚀' : 'هابط 📉'}</p>
                    <p><strong>مستوى الثقة:</strong> ${pattern.confidence}%</p>
                    <p><strong>الموجة الحالية:</strong> ${this.translateWave(wave?.currentWave || 'unknown')}</p>
                </div>
                
                <div class="recommendation-section">
                    <h4><i class="fa-solid fa-bullseye"></i> توصية التداول</h4>
                    <p><strong>الإجراء:</strong> ${recommendation.action}</p>
                    <p><strong>نقطة الدخول:</strong> $${entryPrice.toFixed(4)}</p>
                    <p><strong>الإطار الزمني:</strong> ${recommendation.timeframe}</p>
                    <p><strong>مستوى المخاطرة:</strong> ${recommendation.riskLevel}</p>
                </div>
                
                <div class="recommendation-section">
                    <h4><i class="fa-solid fa-target"></i> الأهداف ووقف الخسارة</h4>
                    <p><strong>🎯 الهدف الأول:</strong> $${targets.target1.toFixed(4)}</p>
                    <p><strong>🎯 الهدف الثاني:</strong> $${targets.target2.toFixed(4)}</p>
                    <p><strong>🎯 الهدف الثالث:</strong> $${targets.target3.toFixed(4)}</p>
                    <p><strong>🛑 وقف الخسارة:</strong> $${targets.stopLoss.toFixed(4)}</p>
                </div>
                
                <div class="recommendation-section">
                    <h4><i class="fa-solid fa-exclamation-triangle"></i> تحذيرات مهمة</h4>
                    <p>• هذا التحليل مبني على نظرية موجات إليوت وليس نصيحة استثمارية</p>
                    <p>• يُنصح بإجراء تحليل إضافي قبل اتخاذ قرار التداول</p>
                    <p>• استخدم إدارة المخاطر المناسبة</p>
                    <p>• لا تستثمر أكثر مما يمكنك تحمل خسارته</p>
                </div>
            </div>
        `;
        modal.style.display = 'block';
        modal.dataset.recommendationText = recommendationText;
    }

    formatRecommendation(result) {
        const { symbol, pattern, targets, recommendation, wave } = result;
        
        // التأكد من أن entry هو رقم
        const entryPrice = typeof recommendation.entry === 'number' ? 
            recommendation.entry : parseFloat(recommendation.entry) || 0;
        
        return `
🔥 توصية تداول - ${symbol}

📊 التحليل الفني:
• النمط: ${this.translatePattern(pattern.type)}
• الاتجاه: ${pattern.direction === 'bullish' ? 'صاعد 🚀' : 'هابط 📉'}
• مستوى الثقة: ${pattern.confidence}%
• الموجة الحالية: ${this.translateWave(wave?.currentWave || 'unknown')}

💡 التوصية:
• الإجراء: ${recommendation.action}
• نقطة الدخول: $${entryPrice.toFixed(4)}
• الإطار الزمني: ${recommendation.timeframe}
• مستوى المخاطرة: ${recommendation.riskLevel}

🎯 الأهداف:
• الهدف الأول: $${targets.target1.toFixed(4)}
• الهدف الثاني: $${targets.target2.toFixed(4)}
• الهدف الثالث: $${targets.target3.toFixed(4)}
• وقف الخسارة: $${targets.stopLoss.toFixed(4)}

⚠️ تحذير: هذا التحليل لأغراض تعليمية وليس نصيحة استثمارية

#ElliottWave #TechnicalAnalysis #Crypto
        `.trim();
    }

    copyRecommendation() {
        const modal = document.getElementById('recommendationModal');
        const text = modal.dataset.recommendationText;
        
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                this.showNotification('تم نسخ التوصية بنجاح! 📋', 'success');
            }).catch(() => {
                this.fallbackCopyText(text);
            });
        } else {
            this.fallbackCopyText(text);
        }
    }

    fallbackCopyText(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            this.showNotification('تم نسخ التوصية بنجاح! 📋', 'success');
        } catch (err) {
            this.showNotification('فشل في نسخ التوصية', 'error');
        }
        
        document.body.removeChild(textArea);
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#00ff88' : type === 'error' ? '#ff4757' : '#00d4aa'};
            color: #000;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            z-index: 3000;
            font-weight: bold;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            animation: slideInRight 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    filterResults(filter) {
        const cards = document.querySelectorAll('.card');
        
        cards.forEach(card => {
            let show = false;
            
            switch (filter) {
                case 'all':
                    show = true;
                    break;
                case 'bullish':
                    show = card.dataset.direction === 'bullish';
                    break;
                case 'bearish':
                    show = card.dataset.direction === 'bearish';
                    break;
                case 'high-confidence':
                    show = card.dataset.confidence === 'high';
                    break;
            }
            
            if (show) {
                card.style.display = 'block';
                card.classList.add('fade-in');
            } else {
                card.style.display = 'none';
            }
        });
    }

    async runRadar() {
        const loadingElement = document.getElementById("loading");
        
        try {
            loadingElement.querySelector('p').textContent = "🔄 جاري جلب قائمة العملات...";
            
            this.symbols = await this.fetchTopSymbols(100);
            
            if (this.symbols.length === 0) {
                loadingElement.innerHTML = `
                    <div class="error-message">
                        <i class="fa-solid fa-exclamation-triangle"></i>
                        <p>❌ فشل في جلب قائمة العملات</p>
                    </div>
                `;
                return;
            }
            
            loadingElement.querySelector('p').textContent = `🔄 جاري تحليل ${this.symbols.length} عملة...`;
            
            // تحليل العملات بشكل متتالي مع تأخير لتجنب حدود API
            for (let i = 0; i < this.symbols.length; i++) {
                setTimeout(() => {
                    this.analyzeSymbol(this.symbols[i]);
                    
                    // تحديث شريط التقدم
                    const progress = Math.round(((i + 1) / this.symbols.length) * 100);
                    const loadingP = loadingElement.querySelector('p');
                    if (loadingP) {
                        loadingP.textContent = 
                            `🔄 تم تحليل ${i + 1} من ${this.symbols.length} عملة (${progress}%)`;
                    }
                    
                    // إخفاء شاشة التحميل عند الانتهاء
                    if (i === this.symbols.length - 1) {
                        setTimeout(() => {
                            loadingElement.style.display = 'none';
                        }, 2000);
                    }
                }, i * 600); // تأخير 600ms بين كل طلب
            }
            
        } catch (error) {
            console.error('خطأ في تشغيل الرادار:', error);
            loadingElement.innerHTML = `
                <div class="error-message">
                    <i class="fa-solid fa-exclamation-triangle"></i>
                    <p>❌ حدث خطأ في تشغيل الرادار</p>
                </div>
            `;
        }
    }

    translatePattern(type) {
        const patterns = {
            'motive': 'دافع',
            'corrective': 'تصحيحي',
            'impulse': 'دفعة',
            'diagonal': 'قطري',
            'zigzag': 'متعرج',
            'flat': 'مسطح',
            'triangle': 'مثلث'
        };
        return patterns[type] || type;
    }

    translateWave(wave) {
        const waves = {
            'extension_or_new_cycle': 'امتداد أو دورة جديدة',
            'corrective_phase': 'مرحلة تصحيحية',
            'correction_completion': 'اكتمال التصحيح',
            'new_impulse_starting': 'بداية دفعة جديدة',
            'wave_1': 'الموجة الأولى',
            'wave_2': 'الموجة الثانية',
            'wave_3': 'الموجة الثالثة',
            'wave_4': 'الموجة الرابعة',
            'wave_5': 'الموجة الخامسة',
            'wave_a': 'الموجة A',
            'wave_b': 'الموجة B',
            'wave_c': 'الموجة C',
            'unknown': 'غير محددة'
        };
        return waves[wave] || wave;
    }

    translateTrend(trend) {
        const trends = {
            'bullish': 'صاعد',
            'bearish': 'هابط',
            'neutral': 'محايد',
            'bullish_correction_end': 'نهاية تصحيح صاعد',
            'bearish_correction_end': 'نهاية تصحيح هابط',
            'strong_bullish': 'صاعد قوي',
            'strong_bearish': 'هابط قوي'
        };
        return trends[trend] || trend;
    }

    getWavePhase(wave) {
        if (!wave || !wave.currentWave) return 'غير محددة';
        
        const phases = {
            'wave_1': 'بداية الاتجاه',
            'wave_2': 'تصحيح أولي',
            'wave_3': 'الدفعة الرئيسية',
            'wave_4': 'تصحيح ثانوي',
            'wave_5': 'الدفعة النهائية',
            'wave_a': 'بداية التصحيح',
            'wave_b': 'ارتداد مؤقت',
            'wave_c': 'نهاية التصحيح'
        };
        
        return phases[wave.currentWave] || 'مرحلة انتقالية';
    }

    getWaveExpectation(pattern, wave) {
        if (!wave || !wave.currentWave) return 'غير محدد';
        
        const direction = pattern.direction;
        const currentWave = wave.currentWave;
        
        if (direction === 'bullish') {
            switch (currentWave) {
                case 'wave_1':
                    return 'توقع تصحيح قبل الارتفاع';
                case 'wave_2':
                    return 'توقع ارتفاع قوي قادم';
                case 'wave_3':
                    return 'أقوى موجة صاعدة';
                case 'wave_4':
                    return 'تصحيح قبل الدفعة الأخيرة';
                case 'wave_5':
                    return 'نهاية الاتجاه الصاعد';
                case 'wave_c':
                    return 'نهاية التصحيح - فرصة شراء';
                default:
                    return 'مراقبة التطورات';
            }
        } else {
            switch (currentWave) {
                case 'wave_1':
                    return 'توقع ارتداد قبل الهبوط';
                case 'wave_2':
                    return 'توقع هبوط قوي قادم';
                case 'wave_3':
                    return 'أقوى موجة هابطة';
                case 'wave_4':
                    return 'ارتداد قبل الهبوط الأخير';
                case 'wave_5':
                    return 'نهاية الاتجاه الهابط';
                case 'wave_c':
                    return 'نهاية التصحيح - فرصة بيع';
                default:
                    return 'مراقبة التطورات';
            }
        }
    }
}

// إضافة الأنيميشن للإشعارات
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .error-message {
        text-align: center;
        color: var(--danger-color);
        padding: 2rem;
    }
    
    .error-message i {
        font-size: 3rem;
        margin-bottom: 1rem;
        display: block;
    }
    
    .recommendation-content {
        color: var(--text-primary);
    }
    
    .recommendation-section {
        margin-bottom: 1.5rem;
        padding: 1rem;
        background: rgba(0, 212, 170, 0.05);
        border-radius: 8px;
        border-left: 3px solid var(--primary-color);
    }
    
    .recommendation-section h4 {
        color: var(--primary-color);
        margin-bottom: 0.75rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    
    .recommendation-section p {
        margin-bottom: 0.5rem;
        line-height: 1.6;
    }
    
    .recommendation-section:last-child {
        background: rgba(255, 71, 87, 0.05);
        border-left-color: var(--danger-color);
    }
    
    .recommendation-section:last-child h4 {
        color: var(--danger-color);
    }
`;
document.head.appendChild(style);

// تهيئة التطبيق
let radar;
document.addEventListener('DOMContentLoaded', () => {
    radar = new ElliottWaveRadar();
});

// إضافة وظائف مساعدة للنافذة العامة
window.addEventListener('load', () => {
    if (!window.radar) {
        window.radar = new ElliottWaveRadar();
    }
});
