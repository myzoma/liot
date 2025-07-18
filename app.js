class ElliottWaveRadar {
    constructor() {
        this.symbols = [];
        this.results = [];
        this.chart = null;
        this.isInitialized = false;
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
        this.isInitialized = true;
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
        const closeBtn = document.querySelector('.close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                document.getElementById('recommendationModal').style.display = 'none';
            });
        }

        // Copy recommendation
        const copyBtn = document.getElementById('copyRecommendation');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                this.copyRecommendation();
            });
        }

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
            this.chart = null;
        }

        const canvas = document.getElementById('signalsChart');
        if (!canvas) {
            console.error('Canvas element not found');
            return;
        }

        // التأكد من أن Canvas غير مستخدم
        const existingChart = Chart.getChart(canvas);
        if (existingChart) {
            existingChart.destroy();
        }

        const ctx = canvas.getContext('2d');
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
            entry: currentPrice,
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
        const totalEl = document.getElementById('totalSymbols');
        const bullishEl = document.getElementById('bullishCount');
        const bearishEl = document.getElementById('bearishCount');
        const avgEl = document.getElementById('avgConfidence');

        if (totalEl) totalEl.textContent = this.stats.total;
        if (bullishEl) bullishEl.textContent = this.stats.bullish;
        if (bearishEl) bearishEl.textContent = this.stats.bearish;
        if (avgEl) avgEl.textContent = `${this.stats.avgConfidence}%`;

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
        if (!container) return;

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
            
            <button class="recommendation-btn" data-symbol="${symbol}">
                <i class="fa-solid fa-lightbulb"></i>
                عرض التوصية الكاملة
            </button>
        `;
        
        // إضافة event listener للزر
        const btn = card.querySelector('.recommendation-btn');
        btn.addEventListener('click', () => {
            this.showRecommendation(symbol);
        });
        
        container.appendChild(card);
    }

    showRecommendation(symbol) {
        const result = this.results.find(r => r.symbol === symbol);
        if (!result) return;

        const { pattern, targets, recommendation, wave } = result;
        const modal = document.getElementById('recommendationModal');
        const modalBody = document.getElementById('modalBody');
        
        if (!modal || !modalBody) return;

        // التأكد من أن entry هو رقم
        const entryPrice = typeof recommendation.entry === 'number' ? 
            recommendation.entry : parseFloat(recommendation.entry) || 0;
        
        const recommendationText = this.formatRecommendation(result);
        
        // إضافة header للنافذة مع زر الإغلاق
        let modalHeader = modal.querySelector('.modal-header');
        if (!modalHeader) {
            modalHeader = document.createElement('div');
            modalHeader.className = 'modal-header';
            modal.querySelector('.modal-content').insertBefore(modalHeader, modalBody);
        }
        
        modalHeader.innerHTML = `
            <div class="modal-title">
                <i class="fa-solid fa-coins"></i>
                توصية تداول - ${symbol}
            </div>
            <button class="modal-close-btn" onclick="document.getElementById('recommendationModal').style.display='none'">
                <i class="fa-solid fa-times"></i>
            </button>
        `;
        
        modalBody.innerHTML = `
            <div class="recommendation-content">
                <!-- بطاقة التحليل الفني -->
                <div class="recommendation-card">
                    <div class="card-header">
                        <i class="fa-solid fa-chart-line"></i>
                        <h4>التحليل الفني</h4>
                    </div>
                    <div class="card-content">
                        <p>
                            <strong>النمط:</strong>
                            <span class="value">${this.translatePattern(pattern.type)}</span>
                        </p>
                        <p>
                            <strong>الاتجاه:</strong>
                            <span class="value ${pattern.direction === 'bullish' ? 'bullish' : 'bearish'}">
                                ${pattern.direction === 'bullish' ? 'صاعد 🚀' : 'هابط 📉'}
                            </span>
                        </p>
                        <p>
                            <strong>مستوى الثقة:</strong>
                            <span class="value">${pattern.confidence}%</span>
                        </p>
                        <p>
                            <strong>الموجة الحالية:</strong>
                            <span class="value">${this.translateWave(wave?.currentWave || 'unknown')}</span>
                        </p>
                    </div>
                </div>
                <!-- بطاقة التوصية -->
                <div class="recommendation-card">
                    <div class="card-header">
                        <i class="fa-solid fa-bullseye"></i>
                        <h4>توصية التداول</h4>
                    </div>
                    <div class="card-content">
                        <p>
                            <strong>الإجراء:</strong>
                            <span class="value ${recommendation.action === 'شراء' ? 'bullish' : 'bearish'}">
                                ${recommendation.action}
                            </span>
                        </p>
                        <p>
                            <strong>نقطة الدخول:</strong>
                            <span class="value">$${entryPrice.toFixed(4)}</span>
                        </p>
                        <p>
                            <strong>الإطار الزمني:</strong>
                            <span class="value">${recommendation.timeframe}</span>
                        </p>
                        <p>
                            <strong>مستوى المخاطرة:</strong>
                            <span class="value">${recommendation.riskLevel}</span>
                        </p>
                    </div>
                </div>
                <!-- بطاقة الأهداف -->
                <div class="recommendation-card">
                    <div class="card-header">
                        <i class="fa-solid fa-target"></i>
                        <h4>الأهداف السعرية</h4>
                    </div>
                    <div class="card-content">
                        <p>
                            <strong>🎯 الهدف الأول:</strong>
                            <span class="value bullish">$${targets.target1.toFixed(4)}</span>
                        </p>
                        <p>
                            <strong>🎯 الهدف الثاني:</strong>
                            <span class="value bullish">$${targets.target2.toFixed(4)}</span>
                        </p>
                        <p>
                            <strong>🎯 الهدف الثالث:</strong>
                            <span class="value bullish">$${targets.target3.toFixed(4)}</span>
                        </p>
                        <p>
                            <strong>🛑 وقف الخسارة:</strong>
                            <span class="value bearish">$${targets.stopLoss.toFixed(4)}</span>
                        </p>
                    </div>
                </div>
                <!-- بطاقة تحليل الموجة المفصل -->
                <div class="recommendation-card">
                    <div class="card-header">
                        <i class="fa-solid fa-wave-square"></i>
                        <h4>تحليل الموجة التفصيلي</h4>
                    </div>
                    <div class="card-content">
                        <p>
                            <strong>الموجة الحالية:</strong>
                            <span class="value">${this.translateWave(wave?.currentWave || 'unknown')}</span>
                        </p>
                        <p>
                            <strong>المرحلة:</strong>
                            <span class="value">${this.getWavePhase(wave)}</span>
                        </p>
                        <p>
                            <strong>التوقع القادم:</strong>
                            <span class="value">${this.getWaveExpectation(pattern, wave)}</span>
                        </p>
                        <p>
                            <strong>نوع الدورة:</strong>
                            <span class="value">${this.getWaveCycle(wave, pattern)}</span>
                        </p>
                        <p>
                            <strong>قوة الموجة:</strong>
                            <span class="value ${this.getWaveStrength(pattern) > 75 ? 'bullish' : 'bearish'}">
                                ${this.getWaveStrength(pattern)}%
                            </span>
                        </p>
                        <p>
                            <strong>الموجة المتوقعة التالية:</strong>
                            <span class="value">${this.getNextWave(wave?.currentWave, pattern)}</span>
                        </p>
                    </div>
                </div>
                <!-- بطاقة استراتيجية التداول -->
                <div class="recommendation-card">
                    <div class="card-header">
                        <i class="fa-solid fa-chess"></i>
                        <h4>استراتيجية التداول</h4>
                    </div>
                    <div class="card-content">
                        <p>
                            <strong>نقطة الدخول المثلى:</strong>
                            <span class="value">$${entryPrice.toFixed(4)}</span>
                        </p>
                        <p>
                            <strong>حجم المركز المقترح:</strong>
                            <span class="value">${this.getPositionSize(recommendation.riskLevel)}</span>
                        </p>
                        <p>
                            <strong>نسبة المخاطرة/العائد:</strong>
                            <span class="value bullish">${this.getRiskRewardRatio(entryPrice, targets)}</span>
                        </p>
                        <p>
                            <strong>مدة الصفقة المتوقعة:</strong>
                            <span class="value">${this.getTradeDuration(wave, pattern)}</span>
                        </p>
                        <p>
                            <strong>أفضل وقت للدخول:</strong>
                            <span class="value">${this.getBestEntryTime(pattern)}</span>
                        </p>
                    </div>
                </div>
                <!-- بطاقة التحذيرات -->
                <div class="recommendation-card warning">
                    <div class="card-header">
                        <i class="fa-solid fa-exclamation-triangle"></i>
                        <h4>تحذيرات مهمة</h4>
                    </div>
                    <div class="card-content">
                        <p>• هذا التحليل مبني على نظرية موجات إليوت وليس نصيحة استثمارية</p>
                        <p>• يُنصح بإجراء تحليل إضافي من مصادر متعددة قبل اتخاذ قرار التداول</p>
                        <p>• استخدم إدارة المخاطر المناسبة ولا تخاطر بأكثر من 2% من رأس المال</p>
                        <p>• راقب الأخبار والأحداث التي قد تؤثر على السوق</p>
                        <p>• لا تستثمر أكثر مما يمكنك تحمل خسارته</p>
                        <p>• قم بمراجعة وتحديث استراتيجيتك بانتظام</p>
                    </div>
                </div>
            </div>
        `;

        // إضافة footer إذا لم يكن موجوداً
        let modalFooter = modal.querySelector('.modal-footer');
        if (!modalFooter) {
            modalFooter = document.createElement('div');
            modalFooter.className = 'modal-footer';
            modalFooter.innerHTML = `
                <button id="copyRecommendation" class="copy-btn">
                    <i class="fa-solid fa-copy"></i>
                    نسخ التوصية الكاملة
                </button>
                <button class="close-btn" onclick="document.getElementById('recommendationModal').style.display='none'">
                    <i class="fa-solid fa-times"></i>
                    إغلاق
                </button>
            `;
            modal.querySelector('.modal-content').appendChild(modalFooter);
        }

        modal.style.display = 'block';
        modal.dataset.recommendationText = recommendationText;
    }

    // إضافة الدوال المساعدة الجديدة
    getWaveCycle(wave, pattern) {
        if (!wave || !wave.currentWave) return 'غير محدد';
        
        const currentWave = wave.currentWave;
        if (['wave_1', 'wave_3', 'wave_5'].includes(currentWave)) {
            return 'دورة دافعة (Impulse)';
        } else if (['wave_2', 'wave_4'].includes(currentWave)) {
            return 'دورة تصحيحية (Corrective)';
        } else if (['wave_a', 'wave_b', 'wave_c'].includes(currentWave)) {
            return 'دورة تصحيح ABC';
        }
        return 'دورة انتقالية';
    }

    getWaveStrength(pattern) {
        return pattern.confidence || 0;
    }

    getNextWave(currentWave, pattern) {
        if (!currentWave) return 'غير محدد';
        
        const waveSequence = {
            'wave_1': 'الموجة الثانية (تصحيحية)',
            'wave_2': 'الموجة الثالثة (دافعة قوية)',
            'wave_3': 'الموجة الرابعة (تصحيحية)',
            'wave_4': 'الموجة الخامسة (دافعة نهائية)',
            'wave_5': 'الموجة A (بداية تصحيح)',
            'wave_a': 'الموجة B (ارتداد)',
            'wave_b': 'الموجة C (نهاية تصحيح)',
            'wave_c': 'الموجة الأولى (دورة جديدة)'
        };
        
        return waveSequence[currentWave] || 'موجة انتقالية';
    }

    getPositionSize(riskLevel) {
        const sizes = {
            'منخفض': '3-5% من رأس المال',
            'متوسط': '2-3% من رأس المال',
            'عالي': '1-2% من رأس المال'
        };
        return sizes[riskLevel] || '2% من رأس المال';
    }

    getRiskRewardRatio(entryPrice, targets) {
        const target1 = targets.target1;
        const stopLoss = targets.stopLoss;
        
        const reward = Math.abs(target1 - entryPrice);
        const risk = Math.abs(entryPrice - stopLoss);
        
        if (risk === 0) return '1:1';
        
        const ratio = (reward / risk).toFixed(1);
        return `1:${ratio}`;
    }

    getTradeDuration(wave, pattern) {
        if (!wave || !wave.currentWave) return '1-3 أيام';
        
        const durations = {
            'wave_1': '2-5 أيام',
            'wave_2': '1-3 أيام',
            'wave_3': '3-7 أيام',
            'wave_4': '1-2 أيام',
            'wave_5': '2-4 أيام',
            'wave_a': '1-3 أيام',
            'wave_b': '1-2 أيام',
            'wave_c': '2-5 أيام'
        };
        
        return durations[wave.currentWave] || '1-3 أيام';
    }

    getBestEntryTime(pattern) {
        const times = [
            'عند كسر مستوى المقاومة',
            'عند إعادة اختبار الدعم',
            'عند تأكيد النمط',
            'عند زيادة الحجم',
            'عند إغلاق الشمعة'
        ];
        
        return times[Math.floor(Math.random() * times.length)];
    }

    // تحديث دالة formatRecommendation لتشمل تحليل الموجة
    formatRecommendation(result) {
        const { symbol, pattern, targets, recommendation, wave } = result;
        
        // التأكد من أن entry هو رقم
        const entryPrice = typeof recommendation.entry === 'number' ? 
            recommendation.entry : parseFloat(recommendation.entry) || 0;
        
        return `🔥 توصية تداول - ${symbol}

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

🌊 تحليل الموجة التفصيلي:
• الموجة الحالية: ${this.translateWave(wave?.currentWave || 'unknown')}
• المرحلة: ${this.getWavePhase(wave)}
• التوقع القادم: ${this.getWaveExpectation(pattern, wave)}
• نوع الدورة: ${this.getWaveCycle(wave, pattern)}
• قوة الموجة: ${this.getWaveStrength(pattern)}%
• الموجة المتوقعة التالية: ${this.getNextWave(wave?.currentWave, pattern)}

📈 استراتيجية التداول:
• حجم المركز المقترح: ${this.getPositionSize(recommendation.riskLevel)}
• نسبة المخاطرة/العائد: ${this.getRiskRewardRatio(entryPrice, targets)}
• مدة الصفقة المتوقعة: ${this.getTradeDuration(wave, pattern)}
• أفضل وقت للدخول: ${this.getBestEntryTime(pattern)}
⚠️ تحذيرات مهمة:
• هذا التحليل مبني على نظرية موجات إليوت وليس نصيحة استثمارية
• يُنصح بإجراء تحليل إضافي من مصادر متعددة قبل اتخاذ قرار التداول
• استخدم إدارة المخاطر المناسبة ولا تخاطر بأكثر من 2% من رأس المال
• راقب الأخبار والأحداث التي قد تؤثر على السوق

🕒 وقت التحليل: ${new Date().toLocaleString('ar-SA')}
📱 Elliott Wave Radar - تحليل موجات إليوت المتقدم`;
    }

    // دالة نسخ التوصية
    copyRecommendation() {
        const modal = document.getElementById('recommendationModal');
        const recommendationText = modal.dataset.recommendationText;
        
        if (recommendationText) {
            navigator.clipboard.writeText(recommendationText).then(() => {
                this.showNotification('تم نسخ التوصية بنجاح!', 'success');
            }).catch(err => {
                console.error('خطأ في نسخ النص:', err);
                this.showNotification('فشل في نسخ التوصية', 'error');
            });
        }
    }

    // دالة إضافة الرمز للمفضلة
    addToFavorites(symbol) {
        let favorites = JSON.parse(localStorage.getItem('favoriteSymbols') || '[]');
        
        if (!favorites.includes(symbol)) {
            favorites.push(symbol);
            localStorage.setItem('favoriteSymbols', JSON.stringify(favorites));
            this.showNotification(`تم إضافة ${symbol} للمفضلة`, 'success');
            this.updateFavoritesDisplay();
        } else {
            this.showNotification(`${symbol} موجود بالفعل في المفضلة`, 'info');
        }
    }

    // دالة إزالة الرمز من المفضلة
    removeFromFavorites(symbol) {
        let favorites = JSON.parse(localStorage.getItem('favoriteSymbols') || '[]');
        favorites = favorites.filter(fav => fav !== symbol);
        localStorage.setItem('favoriteSymbols', JSON.stringify(favorites));
        this.showNotification(`تم إزالة ${symbol} من المفضلة`, 'success');
        this.updateFavoritesDisplay();
    }

    // دالة تحديث عرض المفضلة
    updateFavoritesDisplay() {
        const favoritesContainer = document.getElementById('favoritesList');
        if (!favoritesContainer) return;

        const favorites = JSON.parse(localStorage.getItem('favoriteSymbols') || '[]');
        
        if (favorites.length === 0) {
            favoritesContainer.innerHTML = '<p class="no-favorites">لا توجد رموز مفضلة</p>';
            return;
        }

        favoritesContainer.innerHTML = favorites.map(symbol => `
            <div class="favorite-item">
                <span class="symbol">${symbol}</span>
                <div class="favorite-actions">
                    <button onclick="elliottWaveRadar.analyzeSymbol('${symbol}')" class="analyze-btn">
                        <i class="fa-solid fa-chart-line"></i>
                        تحليل
                    </button>
                    <button onclick="elliottWaveRadar.removeFromFavorites('${symbol}')" class="remove-btn">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    // دالة حفظ التحليل
    saveAnalysis(result) {
        const analyses = JSON.parse(localStorage.getItem('savedAnalyses') || '[]');
        const analysis = {
            id: Date.now(),
            symbol: result.symbol,
            timestamp: new Date().toISOString(),
            pattern: result.pattern,
            wave: result.wave,
            recommendation: result.recommendation,
            targets: result.targets
        };
        
        analyses.unshift(analysis);
        // الاحتفاظ بآخر 50 تحليل فقط
        if (analyses.length > 50) {
            analyses.splice(50);
        }
        
        localStorage.setItem('savedAnalyses', JSON.stringify(analyses));
        this.showNotification('تم حفظ التحليل بنجاح', 'success');
        this.updateSavedAnalysesDisplay();
    }

    // دالة تحديث عرض التحاليل المحفوظة
    updateSavedAnalysesDisplay() {
        const container = document.getElementById('savedAnalysesList');
        if (!container) return;

        const analyses = JSON.parse(localStorage.getItem('savedAnalyses') || '[]');
        
        if (analyses.length === 0) {
            container.innerHTML = '<p class="no-analyses">لا توجد تحاليل محفوظة</p>';
            return;
        }

        container.innerHTML = analyses.map(analysis => `
            <div class="saved-analysis-item">
                <div class="analysis-header">
                    <h4>${analysis.symbol}</h4>
                    <span class="timestamp">${new Date(analysis.timestamp).toLocaleString('ar-SA')}</span>
                </div>
                <div class="analysis-summary">
                    <p><strong>النمط:</strong> ${this.translatePattern(analysis.pattern.type)}</p>
                    <p><strong>الاتجاه:</strong> ${analysis.pattern.direction === 'bullish' ? 'صاعد' : 'هابط'}</p>
                    <p><strong>الموجة:</strong> ${this.translateWave(analysis.wave?.currentWave || 'unknown')}</p>
                    <p><strong>التوصية:</strong> ${analysis.recommendation.action}</p>
                </div>
                <div class="analysis-actions">
                    <button onclick="elliottWaveRadar.viewSavedAnalysis(${analysis.id})" class="view-btn">
                        <i class="fa-solid fa-eye"></i>
                        عرض
                    </button>
                    <button onclick="elliottWaveRadar.deleteSavedAnalysis(${analysis.id})" class="delete-btn">
                        <i class="fa-solid fa-trash"></i>
                        حذف
                    </button>
                </div>
            </div>
        `).join('');
    }

    // دالة عرض التحليل المحفوظ
    viewSavedAnalysis(analysisId) {
        const analyses = JSON.parse(localStorage.getItem('savedAnalyses') || '[]');
        const analysis = analyses.find(a => a.id === analysisId);
        
        if (analysis) {
            this.showRecommendationModal({
                symbol: analysis.symbol,
                pattern: analysis.pattern,
                wave: analysis.wave,
                recommendation: analysis.recommendation,
                targets: analysis.targets
            });
        }
    }

    // دالة حذف التحليل المحفوظ
    deleteSavedAnalysis(analysisId) {
        if (confirm('هل أنت متأكد من حذف هذا التحليل؟')) {
            let analyses = JSON.parse(localStorage.getItem('savedAnalyses') || '[]');
            analyses = analyses.filter(a => a.id !== analysisId);
            localStorage.setItem('savedAnalyses', JSON.stringify(analyses));
            this.showNotification('تم حذف التحليل بنجاح', 'success');
            this.updateSavedAnalysesDisplay();
        }
    }

    // دالة تصدير التحاليل
    exportAnalyses() {
        const analyses = JSON.parse(localStorage.getItem('savedAnalyses') || '[]');
        
        if (analyses.length === 0) {
            this.showNotification('لا توجد تحاليل للتصدير', 'warning');
            return;
        }

        const dataStr = JSON.stringify(analyses, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `elliott-wave-analyses-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        this.showNotification('تم تصدير التحاليل بنجاح', 'success');
    }

    // دالة استيراد التحاليل
    importAnalyses(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedAnalyses = JSON.parse(e.target.result);
                const existingAnalyses = JSON.parse(localStorage.getItem('savedAnalyses') || '[]');
                
                // دمج التحاليل المستوردة مع الموجودة
                const mergedAnalyses = [...importedAnalyses, ...existingAnalyses];
                
                // إزالة المكررات والاحتفاظ بآخر 100 تحليل
                const uniqueAnalyses = mergedAnalyses
                    .filter((analysis, index, self) => 
                        index === self.findIndex(a => a.id === analysis.id)
                    )
                    .slice(0, 100);
                
                localStorage.setItem('savedAnalyses', JSON.stringify(uniqueAnalyses));
                this.updateSavedAnalysesDisplay();
                this.showNotification(`تم استيراد ${importedAnalyses.length} تحليل بنجاح`, 'success');
            } catch (error) {
                console.error('خطأ في استيراد التحاليل:', error);
                this.showNotification('فشل في استيراد التحاليل - تأكد من صحة الملف', 'error');
            }
        };
        reader.readAsText(file);
    }

    // دالة إعداد التنبيهات
    setupAlerts() {
        // طلب إذن الإشعارات
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    this.showNotification('تم تفعيل الإشعارات بنجاح', 'success');
                }
            });
        }
    }

    // دالة إرسال إشعار
    sendNotification(title, message, type = 'info') {
        if ('Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification(title, {
                body: message,
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                tag: 'elliott-wave-radar'
            });

            notification.onclick = () => {
                window.focus();
                notification.close();
            };

            // إغلاق الإشعار تلقائياً بعد 5 ثواني
            setTimeout(() => notification.close(), 5000);
        }
    }

    // دالة تحديث الإحصائيات
    updateStatistics() {
        const analyses = JSON.parse(localStorage.getItem('savedAnalyses') || '[]');
        const favorites = JSON.parse(localStorage.getItem('favoriteSymbols') || '[]');
        
        const stats = {
            totalAnalyses: analyses.length,
            favoriteSymbols: favorites.length,
            bullishAnalyses: analyses.filter(a => a.pattern.direction === 'bullish').length,
            bearishAnalyses: analyses.filter(a => a.pattern.direction === 'bearish').length,
            highConfidenceAnalyses: analyses.filter(a => a.pattern.confidence > 80).length
        };

        // تحديث عرض الإحصائيات
        const statsContainer = document.getElementById('statisticsContainer');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon">
                            <i class="fa-solid fa-chart-line"></i>
                        </div>
                        <div class="stat-content">
                            <h3>${stats.totalAnalyses}</h3>
                            <p>إجمالي التحاليل</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">
                            <i class="fa-solid fa-heart"></i>
                        </div>
                        <div class="stat-content">
                            <h3>${stats.favoriteSymbols}</h3>
                            <p>الرموز المفضلة</p>
                        </div>
                    </div>
                    <div class="stat-card bullish">
                        <div class="stat-icon">
                            <i class="fa-solid fa-arrow-trend-up"></i>
                        </div>
                        <div class="stat-content">
                            <h3>${stats.bullishAnalyses}</h3>
                            <p>تحاليل صاعدة</p>
                        </div>
                    </div>
                    <div class="stat-card bearish">
                        <div class="stat-icon">
                            <i class="fa-solid fa-arrow-trend-down"></i>
                        </div>
                        <div class="stat-content">
                            <h3>${stats.bearishAnalyses}</h3>
                            <p>تحاليل هابطة</p>
                        </div>
                    </div>
                    <div class="stat-card high-confidence">
                        <div class="stat-icon">
                            <i class="fa-solid fa-star"></i>
                        </div>
                        <div class="stat-content">
                            <h3>${stats.highConfidenceAnalyses}</h3>
                            <p>تحاليل عالية الثقة</p>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    // دالة تحديث الموضوع (Theme)
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        // تحديث أيقونة الموضوع
        const themeIcon = document.querySelector('#themeToggle i');
        if (themeIcon) {
            themeIcon.className = newTheme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        }
        
        this.showNotification(`تم التبديل إلى الوضع ${newTheme === 'dark' ? 'الليلي' : 'النهاري'}`, 'success');
    }

    // دالة تهيئة الموضوع عند التحميل
    initializeTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        
        const themeIcon = document.querySelector('#themeToggle i');
        if (themeIcon) {
            themeIcon.className = savedTheme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        }
    }

    // دالة البحث المتقدم
    performAdvancedSearch(criteria) {
        const analyses = JSON.parse(localStorage.getItem('savedAnalyses') || '[]');
        
        let filteredAnalyses = analyses.filter(analysis => {
            let matches = true;
            
            // البحث بالرمز
            if (criteria.symbol && !analysis.symbol.toLowerCase().includes(criteria.symbol.toLowerCase())) {
                matches = false;
            }
            
            // البحث بالاتجاه
            if (criteria.direction && analysis.pattern.direction !== criteria.direction) {
                matches = false;
            }
            
            // البحث بنوع النمط
            if (criteria.patternType && analysis.pattern.type !== criteria.patternType) {
                matches = false;
            }
            
            // البحث بمستوى الثقة
            if (criteria.minConfidence && analysis.pattern.confidence < criteria.minConfidence) {
                matches = false;
            }
            
            // البحث بالتاريخ
            if (criteria.dateFrom) {
                const analysisDate = new Date(analysis.timestamp);
                const fromDate = new Date(criteria.dateFrom);
                if (analysisDate < fromDate) {
                    matches = false;
                }
            }
            
            if (criteria.dateTo) {
                const analysisDate = new Date(analysis.timestamp);
                const toDate = new Date(criteria.dateTo);
                if (analysisDate > toDate) {
                    matches = false;
                }
            }
            
            return matches;
        });
        
        return filteredAnalyses;
    }

    // دالة عرض نتائج البحث المتقدم
    showAdvancedSearchResults(results) {
        const modal = document.getElementById('searchResultsModal');
        const resultsContainer = modal.querySelector('.search-results');
        
        if (results.length === 0) {
            resultsContainer.innerHTML = '<p class="no-results">لم يتم العثور على نتائج مطابقة</p>';
        } else {
            resultsContainer.innerHTML = results.map(analysis => `
                <div class="search-result-item">
                    <div class="result-header">
                        <h4>${analysis.symbol}</h4>
                        <span class="result-date">${new Date(analysis.timestamp).toLocaleDateString('ar-SA')}</span>
                    </div>
                    <div class="result-details">
                        <span class="pattern-type">${this.translatePattern(analysis.pattern.type)}</span>
                        <span class="direction ${analysis.pattern.direction}">${analysis.pattern.direction === 'bullish' ? 'صاعد' : 'هابط'}</span>
                        <span class="confidence">${analysis.pattern.confidence}%</span>
                    </div>
                    <div class="result-actions">
                        <button onclick="elliottWaveRadar.viewSavedAnalysis(${analysis.id})" class="view-result-btn">
                            <i class="fa-solid fa-eye"></i>
                            عرض التفاصيل
                        </button>
                    </div>
                </div>
            `).join('');
        }
        
        modal.style.display = 'block';
    }

    // دالة تصدير نتائج البحث
    exportSearchResults(results) {
        if (results.length === 0) {
            this.showNotification('لا توجد نتائج للتصدير', 'warning');
            return;
        }
        
        const csvContent = this.convertToCSV(results);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        link.href = URL.createObjectURL(blob);
        link.download = `search-results-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        
        this.showNotification('تم تصدير النتائج بنجاح', 'success');
    }

    // دالة تحويل البيانات إلى CSV
    convertToCSV(data) {
        const headers = ['الرمز', 'التاريخ', 'النمط', 'الاتجاه', 'مستوى الثقة', 'الموجة', 'التوصية'];
        const csvRows = [headers.join(',')];
        
        data.forEach(analysis => {
            const row = [
                analysis.symbol,
                new Date(analysis.timestamp).toLocaleDateString('ar-SA'),
                this.translatePattern(analysis.pattern.type),
                analysis.pattern.direction === 'bullish' ? 'صاعد' : 'هابط',
                analysis.pattern.confidence + '%',
                this.translateWave(analysis.wave?.currentWave || 'unknown'),
                analysis.recommendation.action
            ];
            csvRows.push(row.join(','));
        });
        
        return csvRows.join('\n');
    }

    // دالة إعداد التحديث التلقائي
    setupAutoRefresh() {
        const interval = localStorage.getItem('autoRefreshInterval') || 300000; // 5 دقائق افتراضياً
        
        if (this.autoRefreshTimer) {
            clearInterval(this.autoRefreshTimer);
        }
        
        this.autoRefreshTimer = setInterval(() => {
            const favorites = JSON.parse(localStorage.getItem('favoriteSymbols') || '[]');
            if (favorites.length > 0) {
                this.refreshFavoriteAnalyses(favorites);
            }
        }, parseInt(interval));
    }

    // دالة تحديث تحاليل المفضلة تلقائياً
    async refreshFavoriteAnalyses(favorites) {
        try {
            for (const symbol of favorites.slice(0, 5)) { // تحديث أول 5 رموز فقط لتجنب الحمل الزائد
                const result = await this.analyzeSymbol(symbol, false); // false = عدم إظهار النتائج
                if (result && this.shouldNotifyUser(result)) {
                    this.sendNotification(
                        `تحديث ${symbol}`,
                        `تم اكتشاف فرصة جديدة: ${result.recommendation.action}`,
                        'info'
                    );
                }
            }
        } catch (error) {
            console.error('خطأ في التحديث التلقائي:', error);
        }
    }

    // دالة تحديد ما إذا كان يجب إشعار المستخدم
    shouldNotifyUser(result) {
        // إشعار المستخدم إذا كان مستوى الثقة عالي أو إذا كانت هناك فرصة قوية
        return result.pattern.confidence > 80 || 
               (result.pattern.direction === 'bullish' && result.recommendation.action === 'شراء') ||
               (result.pattern.direction === 'bearish' && result.recommendation.action === 'بيع');
    }

    // دالة إعداد الاختصارات
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            // Ctrl + Enter: تحليل سريع
            if (event.ctrlKey && event.key === 'Enter') {
                event.preventDefault();
                const symbolInput = document.getElementById('symbolInput');
                if (symbolInput && symbolInput.value.trim()) {
                    this.analyzeSymbol(symbolInput.value.trim().toUpperCase());
                }
            }
            
            // Ctrl + S: حفظ التحليل الحالي
            if (event.ctrlKey && event.key === 's') {
                event.preventDefault();
                if (this.lastAnalysisResult) {
                    this.saveAnalysis(this.lastAnalysisResult);
                }
            }
            
            // Ctrl + D: تبديل الموضوع
            if (event.ctrlKey && event.key === 'd') {
                event.preventDefault();
                this.toggleTheme();
            }
            
            // Escape: إغلاق النوافذ المنبثقة
            if (event.key === 'Escape') {
                const modals = document.querySelectorAll('.modal[style*="block"]');
                modals.forEach(modal => modal.style.display = 'none');
            }
        });
    }

    // دالة تهيئة التطبيق
    initialize() {
        console.log('🚀 تهيئة Elliott Wave Radar...');
        
        // تهيئة الموضوع
        this.initializeTheme();
        
        // تهيئة الإشعارات
        this.setupAlerts();
        
        // تهيئة الاختصارات
        this.setupKeyboardShortcuts();
        
        // تحديث العروض
        this.updateFavoritesDisplay();
        this.updateSavedAnalysesDisplay();
        this.updateStatistics();
        
        // إعداد التحديث التلقائي
        this.setupAutoRefresh();
        
        // إعداد مستمعي الأحداث
        this.setupEventListeners();
        
        console.log('✅ تم تهيئة Elliott Wave Radar بنجاح');
    }

    // دالة إعداد مستمعي الأحداث
    setupEventListeners() {
        // زر نسخ التوصية
        document.addEventListener('click', (event) => {
            if (event.target.id === 'copyRecommendation' || event.target.closest('#copyRecommendation')) {
                this.copyRecommendation();
            }
        });
        
        // زر تبديل الموضوع
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }
        
        // إغلاق النوافذ المنبثقة عند النقر خارجها
        document.addEventListener('click', (event) => {
            if (event.target.classList.contains('modal')) {
                event.target.style.display = 'none';
            }
        });
        
        // منع إغلاق النافذة عند النقر على المحتوى
        document.addEventListener('click', (event) => {
            if (event.target.classList.contains('modal-content')) {
                event.stopPropagation();
            }
        });
    }

    // دالة تنظيف الموارد
    cleanup() {
        if (this.autoRefreshTimer) {
            clearInterval(this.autoRefreshTimer);
        }
    }
}

// إنشاء مثيل من التطبيق
const elliottWaveRadar = new ElliottWaveRadar();

// تهيئة التطبيق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    elliottWaveRadar.initialize();
});

// تنظيف الموارد عند إغلاق الصفحة
window.addEventListener('beforeunload', () => {
    elliottWaveRadar.cleanup();
});

// تصدير للاستخدام العام
window.elliottWaveRadar = elliottWaveRadar;
