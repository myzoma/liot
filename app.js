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
        // إضافة تتبع أنواع الموجات
        this.waveTypes = {
            impulse: 0,
            corrective: 0,
            diagonal: 0,
            triangle: 0,
            flat: 0,
            zigzag: 0,
            complex: 0
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

    async runRadar() {
        const loadingElement = document.getElementById("loading");
        try {
            loadingElement.querySelector('p').textContent = "🔄 جاري جلب قائمة العملات...";
            this.symbols = await this.fetchTopSymbols(100);

            if (this.symbols.length === 0) {
                loadingElement.innerHTML = `
                    <div class="error-message">
                        <h3>❌ فشل في جلب قائمة العملات</h3>
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
                        loadingP.textContent = `🔄 تم تحليل ${i + 1} من ${this.symbols.length} عملة (${progress}%)`;
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
                    <h3>❌ حدث خطأ في تشغيل الرادار</h3>
                </div>
            `;
        }
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
            const res = await fetch('https://api1.binance.com/api/v3/ticker/24hr');
            const data = await res.json();
            return data
                .filter(d => d.symbol.endsWith('USDT') && !d.symbol.includes('UP') && !d.symbol.includes('DOWN'))
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
            const url = `https://api1.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
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

            // استخدام محللك الموجود مع تحسينات
            const analyzer = new ElliottWaveAnalyzer();
            const result = analyzer.analyze(data);

            if (result.status === 'success' && result.patterns.length > 0) {
                const pattern = result.patterns[0];
                if (pattern.confidence >= 75) {
                    // تحليل شامل لجميع أنواع الموجات
                    const completeWaveAnalysis = this.performCompleteWaveAnalysis(data, pattern, result);

                    const analysisResult = {
                        symbol,
                        pattern,
                        trend: result.trend,
                        wave: result.currentWaveAnalysis,
                        completeWaveAnalysis, // إضافة التحليل الشامل
                        targets: this.calculateTargets(data, pattern),
                        recommendation: this.generateRecommendation(pattern, result.trend, data, completeWaveAnalysis)
                    };

                    this.results.push(analysisResult);
                    this.updateWaveTypeStats(completeWaveAnalysis);
                    this.updateStats();
                    this.renderCard(analysisResult);
                }
            }
        } catch (error) {
            console.warn(`❌ خطأ في تحليل ${symbol}:`, error.message);
        }
    }

    renderCard(result) {
        const container = document.getElementById("results");
        if (!container) return; // تحقق من وجود العنصر

        const { symbol, pattern, trend, wave, targets, recommendation } = result;

        // تحقق من وجود بيانات الأهداف
        if (!targets || !targets.target1 || !targets.target2 || !targets.target3 || !targets.stopLoss) {
            console.warn('بيانات الأهداف ناقصة لهذه العملة:', symbol, targets);
            return;
        }

        const trendIcon = pattern.direction === 'bullish' ? 'fa-arrow-up text-success' : 'fa-arrow-down text-danger';
        const waveText = wave?.currentWave ? wave.currentWave : 'غير محددة';
        const confidenceClass = pattern.confidence >= 85 ? 'text-success' : pattern.confidence >= 75 ? 'text-warning' : 'text-danger';

        const card = document.createElement("div");
        card.className = "card fade-in";
        card.dataset.direction = pattern.direction;
        card.dataset.confidence = pattern.confidence >= 85 ? 'high' : 'normal';

        card.innerHTML = `
            <div class="card-header">
                <h3>${symbol}</h3>
                <span class="pattern-badge">${pattern.type}</span>
            </div>
            <div class="card-body">
                <div class="signal-info">
                    <i class="fas ${trendIcon}"></i>
                    <span>${pattern.direction === 'bullish' ? '🚀 صاعد' : '📉 هابط'}</span>
                </div>
                <div class="confidence-meter">
                    <span>الثقة: <strong class="${confidenceClass}">${pattern.confidence}%</strong></span>
                </div>
                <div class="wave-info">
                    <p>الموجة الحالية: ${waveText}</p>
                    <p>الاتجاه العام: ${trend}</p>
                </div>
                <div class="targets">
                    <h4>الأهداف السعرية</h4>
                    <p>🎯 الهدف الأول: $${targets.target1.toFixed(4)}</p>
                    <p>🎯 الهدف الثاني: $${targets.target2.toFixed(4)}</p>
                    <p>🎯 الهدف الثالث: $${targets.target3.toFixed(4)}</p>
                    <p>🛑 وقف الخسارة: $${targets.stopLoss.toFixed(4)}</p>
                </div>
                <button class="recommendation-btn" onclick="radar.showRecommendation('${symbol}')">
                    عرض التوصية الكاملة
                </button>
            </div>
        `;

        container.appendChild(card);
    }

    // دالة جديدة للتحليل الشامل لجميع أنواع الموجات
    performCompleteWaveAnalysis(data, pattern, result) {
        const prices = data.map(d => parseFloat(d[4]));
        const highs = data.map(d => parseFloat(d[2]));
        const lows = data.map(d => parseFloat(d[3]));

        return {
            // تحليل الموجات الدافعة (Impulse Waves)
            impulseWaves: this.analyzeImpulseWaves(prices, highs, lows),
            // تحليل الموجات التصحيحية (Corrective Waves)
            correctiveWaves: this.analyzeCorrectiveWaves(prices, highs, lows),
            // تحليل الموجات القطرية (Diagonal Waves)
            diagonalWaves: this.analyzeDiagonalWaves(prices, highs, lows),
            // تحليل أنماط المثلث (Triangle Patterns)
            trianglePatterns: this.analyzeTrianglePatterns(prices, highs, lows),
            // تحليل الأنماط المسطحة (Flat Patterns)
            flatPatterns: this.analyzeFlatPatterns(prices, highs, lows),
            // تحليل الأنماط المتعرجة (Zigzag Patterns)
            zigzagPatterns: this.analyzeZigzagPatterns(prices, highs, lows),
            // تحليل الأنماط المعقدة (Complex Patterns)
            complexPatterns: this.analyzeComplexPatterns(prices, highs, lows),
            // تحليل دورة الموجة الكاملة
            //waveCount: this.getWaveCount(result.currentWaveAnalysis),
            // تحديد نوع الموجة الرئيسي
            primaryWaveType: this.determinePrimaryWaveType(pattern, result),
            // تحليل قوة الموجة
            waveStrength: this.calculateWaveStrength(prices, pattern),
            // تحليل مستويات فيبوناتشي للموجات
            fibonacciLevels: this.calculateWaveFibonacci(prices, highs, lows),
            // تحليل الزمن للموجات
            timeAnalysis: this.analyzeWaveTime(data),
            // تحليل الحجم للموجات
            volumeAnalysis: this.analyzeWaveVolume(data)
        };
    }

    // تحليل الموجات الدافعة
    analyzeImpulseWaves(prices, highs, lows) {
        const waves = [];
        let currentWave = 1;

        for (let i = 5; i < prices.length - 5; i += 10) {
            const segment = prices.slice(i - 5, i + 5);
            const impulsePattern = this.detectImpulsePattern(segment);
            
            if (impulsePattern.detected) {
                waves.push({
                    wave: currentWave,
                    startIndex: i - 5,
                    endIndex: i + 5,
                    strength: impulsePattern.strength,
                    direction: impulsePattern.direction
                });
                currentWave = (currentWave % 5) + 1;
            }
        }

        return {
            detected: waves.length > 0,
            waves: waves,
            totalWaves: waves.length,
            dominantDirection: this.getDominantDirection(waves)
        };
    }

    detectImpulsePattern(segment) {
        const peaks = this.findPeaks(segment);
        const troughs = this.findTroughs(segment);

        if (peaks.length >= 3 && troughs.length >= 2) {
            const wave3Length = Math.abs(segment[peaks[1]] - segment[troughs[0]]);
            const wave1Length = Math.abs(segment[peaks[0]] - segment[0]);
            const wave5Length = Math.abs(segment[segment.length-1] - segment[troughs[1]]);

            const isWave3Longest = wave3Length > wave1Length && wave3Length > wave5Length;
            const strength = isWave3Longest ? 85 : 70;
            return {
                detected: true,
                strength,
                direction: segment[segment.length-1] > segment[0] ? 'bullish' : 'bearish'
            };
        }

        return { detected: false };
    }

    // تحليل الموجات التصحيحية
    analyzeCorrectiveWaves(prices, highs, lows) {
        const corrections = [];

        for (let i = 10; i < prices.length - 10; i += 15) {
            const segment = prices.slice(i - 10, i + 10);
            const correctionPattern = this.detectCorrectivePattern(segment);
            
            if (correctionPattern.detected) {
                corrections.push({
                    startIndex: i - 10,
                    endIndex: i + 10,
                    type: correctionPattern.type,
                    depth: correctionPattern.depth,
                    strength: correctionPattern.strength
                });
            }
        }

        return {
            detected: corrections.length > 0,
            corrections: corrections,
            totalCorrections: corrections.length,
            averageDepth: corrections.length > 0 ? 
                corrections.reduce((sum, c) => sum + c.depth, 0) / corrections.length : 0
        };
    }

    detectCorrectivePattern(segment) {
        const start = segment[0];
        const end = segment[segment.length - 1];
        const peaks = this.findPeaks(segment);
        const troughs = this.findTroughs(segment);

        if (peaks.length >= 1 && troughs.length >= 1) {
            const retracement = Math.abs((end - start) / start) * 100;
            let pattern = 'abc';
            
            if (retracement > 61.8) pattern = 'deep_correction';
            else if (retracement < 23.6) pattern = 'shallow_correction';

            return {
                detected: true,
                type: pattern,
                depth: retracement,
                strength: retracement > 50 ? 80 : 65
            };
        }

        return { detected: false };
    }

    // تحليل الموجات القطرية
    analyzeDiagonalWaves(prices, highs, lows) {
        const diagonals = [];

        for (let i = 15; i < prices.length - 15; i += 20) {
            const segment = prices.slice(i - 15, i + 15);
            const diagonalPattern = this.detectDiagonalPattern(segment);
            
            if (diagonalPattern.detected) {
                diagonals.push({
                    startIndex: i - 15,
                    endIndex: i + 15,
                    type: diagonalPattern.type,
                    angle: diagonalPattern.angle,
                    strength: diagonalPattern.strength
                });
            }
        }

        return {
            detected: diagonals.length > 0,
            diagonals: diagonals,
            totalDiagonals: diagonals.length
        };
    }

    detectDiagonalPattern(segment) {
        const highs = [];
        const lows = [];

        for (let i = 1; i < segment.length - 1; i++) {
            if (segment[i] > segment[i-1] && segment[i] > segment[i+1] && 
                segment[i] > segment[i-2] && segment[i] > segment[i+2]) {
                highs.push({ index: i, value: segment[i] });
            }
            if (segment[i] < segment[i-1] && segment[i] < segment[i+1] && 
                segment[i] < segment[i-2] && segment[i] < segment[i+2]) {
                lows.push({ index: i, value: segment[i] });
            }
        }

        if (highs.length >= 2 && lows.length >= 2) {
            // حساب زاوية التقارب
            const highSlope = (highs[highs.length-1].value - highs[0].value) / (highs[highs.length-1].index - highs[0].index);
            const lowSlope = (lows[lows.length-1].value - lows[0].value) / (lows[lows.length-1].index - lows[0].index);
            const convergence = Math.abs(highSlope - lowSlope);
            const angle = Math.atan(convergence) * (180 / Math.PI);

            if (angle > 10 && angle < 45) {
                return {
                    detected: true,
                    type: 'diagonal',
                    angle: angle,
                    strength: 75
                };
            }
        }

        return { detected: false };
    }

    // تحليل أنماط المثلث
    analyzeTrianglePatterns(prices, highs, lows) {
        const triangles = [];

        for (let i = 20; i < prices.length - 20; i += 25) {
            const segment = prices.slice(i - 20, i + 20);
            const trianglePattern = this.detectTrianglePattern(segment);
            
            if (trianglePattern.detected) {
                triangles.push({
                    startIndex: i - 20,
                    endIndex: i + 20,
                    subtype: trianglePattern.subtype,
                    waves: trianglePattern.waves,
                    breakoutDirection: trianglePattern.breakoutDirection
                });
            }
        }

        return {
            detected: triangles.length > 0,
            triangles: triangles,
            totalTriangles: triangles.length
        };
    }

    detectTrianglePattern(segment) {
        const peaks = this.findPeaks(segment);
        const troughs = this.findTroughs(segment);

        if (peaks.length >= 3 && troughs.length >= 2) {
            // تحليل نمط المثلث - 5 موجات (A, B, C, D, E)
            const range1 = highs[Math.floor(highs.length * 0.2)] - lows[Math.floor(lows.length * 0.2)];
            const range2 = highs[Math.floor(highs.length * 0.8)] - lows[Math.floor(lows.length * 0.8)];
            
            let subtype = 'contracting';
            if (range2 > range1) subtype = 'expanding';

            // تحديد اتجاه الكسر المحتمل
            const recentTrend = segment[segment.length-1] - segment[segment.length-5];
            const breakoutDirection = recentTrend > 0 ? 'upward' : 'downward';

            return {
                detected: true,
                subtype,
                waves: ['A', 'B', 'C', 'D', 'E'],
                breakoutDirection
            };
        }

        return { detected: false };
    }

    // تحليل الأنماط المسطحة
    analyzeFlatPatterns(prices, highs, lows) {
        const flats = [];

        for (let i = 12; i < prices.length - 12; i += 18) {
            const segment = prices.slice(i - 12, i + 12);
            const flatPattern = this.detectFlatPattern(segment);
            
            if (flatPattern.detected) {
                flats.push({
                    startIndex: i - 12,
                    endIndex: i + 12,
                    subtype: flatPattern.subtype,
                    waveA: flatPattern.waveA,
                    waveB: flatPattern.waveB,
                    waveC: flatPattern.waveC,
                    retracement: flatPattern.retracement
                });
            }
        }

        return {
            detected: flats.length > 0,
            flats: flats,
            totalFlats: flats.length
        };
    }

    detectFlatPattern(segment) {
        if (segment.length < 9) return { detected: false };

        const waveA = segment.slice(0, 3);
        const waveB = segment.slice(3, 6);
        const waveC = segment.slice(6, 9);

        const aRange = Math.abs(waveA[waveA.length-1] - waveA[0]);
        const bRange = Math.abs(waveB[waveB.length-1] - waveB[0]);
        const cRange = Math.abs(waveC[waveC.length-1] - waveC[0]);

        const bRetracement = (bRange / aRange) * 100;

        if (bRetracement >= 90) {
            let subtype = 'regular';
            if (bRetracement > 105) subtype = 'expanded';
            else if (cRange < aRange * 0.618) subtype = 'running';

            return {
                detected: true,
                subtype,
                waveA: {
                    range: aRange,
                    direction: waveA[waveA.length-1] > waveA[0] ? 'up' : 'down'
                },
                waveB: {
                    range: bRange,
                    direction: waveB[waveB.length-1] > waveB[0] ? 'up' : 'down'
                },
                waveC: {
                    range: cRange,
                    direction: waveC[waveC.length-1] > waveC[0] ? 'up' : 'down'
                },
                retracement: bRetracement.toFixed(1)
            };
        }

        return { detected: false };
    }

    // تحليل الأنماط المتعرجة
    analyzeZigzagPatterns(prices, highs, lows) {
        const zigzags = [];

        for (let i = 9; i < prices.length - 9; i += 12) {
            const segment = prices.slice(i - 9, i + 9);
            const zigzagPattern = this.detectZigzagPattern(segment);
            
            if (zigzagPattern.detected) {
                zigzags.push({
                    startIndex: i - 9,
                    endIndex: i + 9,
                    subtype: zigzagPattern.subtype,
                    waveA: zigzagPattern.waveA,
                    waveB: zigzagPattern.waveB,
                    waveC: zigzagPattern.waveC,
                    sharpness: zigzagPattern.sharpness
                });
            }
        }

        return {
            detected: zigzags.length > 0,
            zigzags: zigzags,
            totalZigzags: zigzags.length
        };
    }

    detectZigzagPattern(segment) {
        if (segment.length < 9) return { detected: false };

        const waveA = segment.slice(0, 3);
        const waveB = segment.slice(3, 6);
        const waveC = segment.slice(6, 9);

        const aMove = Math.abs(waveA[waveA.length-1] - waveA[0]);
        const bMove = Math.abs(waveB[waveB.length-1] - waveB[0]);
        const cMove = Math.abs(waveC[waveC.length-1] - waveC[0]);

        const bRetracement = (bMove / aMove) * 100;

        if (bRetracement >= 50 && bRetracement <= 78.6) {
            let subtype = 'regular';
            if (cMove > aMove * 1.618) subtype = 'elongated';

            const sharpness = 100 - bRetracement; // كلما قل الارتداد، زادت الحدة

            return {
                detected: true,
                subtype,
                waveA: {
                    move: aMove,
                    direction: waveA[waveA.length-1] > waveA[0] ? 'up' : 'down'
                },
                waveB: {
                    move: bMove,
                    direction: waveB[waveB.length-1] > waveB[0] ? 'up' : 'down'
                },
                waveC: {
                    move: cMove,
                    direction: waveC[waveC.length-1] > waveC[0] ? 'up' : 'down'
                },
                sharpness: sharpness.toFixed(1)
            };
        }

        return { detected: false };
    }

    // تحليل الأنماط المعقدة
    analyzeComplexPatterns(prices, highs, lows) {
        const complexPatterns = [];

        for (let i = 30; i < prices.length - 30; i += 40) {
            const segment = prices.slice(i - 30, i + 30);
            const complexPattern = this.detectComplexPattern(segment, highs, lows);
            
            if (complexPattern.detected) {
                complexPatterns.push({
                    startIndex: i - 30,
                    endIndex: i + 30,
                    subtype: complexPattern.subtype,
                    components: complexPattern.components,
                    linkingWaves: complexPattern.linkingWaves,
                    duration: complexPattern.duration
                });
            }
        }

        return {
            detected: complexPatterns.length > 0,
            patterns: complexPatterns,
            totalPatterns: complexPatterns.length
        };
    }

    detectComplexPattern(segment, highs, lows) {
        if (segment.length < 20) return { detected: false };

        // تقسيم الجزء إلى مكونات
        const components = [];
        const linkingWaves = [];

        for (let i = 0; i < segment.length; i += 7) {
            const component = segment.slice(i, Math.min(i + 7, segment.length));
            if (component.length >= 5) {
                components.push(this.analyzeComponent(component));
            }
        }

        if (components.length >= 3 && linkingWaves.length >= 1) {
            let subtype = 'double_three';
            if (components.length >= 4) subtype = 'triple_three';

            return {
                detected: true,
                subtype,
                components,
                linkingWaves,
                duration: segment.length
            };
        }

        return { detected: false };
    }

    // دوال مساعدة للتحليل
    findPeaks(data) {
        const peaks = [];
        for (let i = 2; i < data.length - 2; i++) {
            if (data[i] > data[i-1] && data[i] > data[i+1] && 
                data[i] > data[i-2] && data[i] > data[i+2]) {
                peaks.push(i);
            }
        }
        return peaks;
    }

    findTroughs(data) {
        const troughs = [];
        for (let i = 2; i < data.length - 2; i++) {
            if (data[i] < data[i-1] && data[i] < data[i+1] && 
                data[i] < data[i-2] && data[i] < data[i+2]) {
                troughs.push(i);
            }
        }
        return troughs;
    }

    analyzeComponent(component) {
        const start = component[0];
        const end = component[component.length - 1];
        const high = Math.max(...component);
        const low = Math.min(...component);

        return {
            type: this.determineComponentType(component),
            direction: end > start ? 'bullish' : 'bearish',
            range: high - low,
            duration: component.length
        };
    }

    determineComponentType(component) {
        const peaks = this.findPeaks(component);
        const troughs = this.findTroughs(component);

        if (peaks.length >= 3 && troughs.length >= 2) return 'impulse';
        if (peaks.length <= 2 && troughs.length <= 2) return 'corrective';
        return 'complex';
    }

    getDominantDirection(waves) {
        const bullishCount = waves.filter(w => w.direction === 'bullish').length;
        const bearishCount = waves.filter(w => w.direction === 'bearish').length;
        return bullishCount > bearishCount ? 'bullish' : 'bearish';
    }

    determinePrimaryWaveType(pattern, result) {
        // تحديد نوع الموجة الرئيسي بناءً على النمط والنتيجة
        if (pattern.type.includes('Impulse')) return 'impulse';
        if (pattern.type.includes('Corrective')) return 'corrective';
        if (pattern.type.includes('Triangle')) return 'triangle';
        if (pattern.type.includes('Flat')) return 'flat';
        if (pattern.type.includes('Zigzag')) return 'zigzag';
        return 'complex';
    }

    calculateWaveStrength(prices, pattern) {
        const priceRange = Math.max(...prices) - Math.min(...prices);
        const recentRange = Math.max(...prices.slice(-10)) - Math.min(...prices.slice(-10));
        const strength = (recentRange / priceRange) * 100;
        
        return {
            overall: Math.min(strength, 100),
            recent: Math.min((recentRange / prices[prices.length-1]) * 100, 100),
            momentum: pattern.confidence
        };
    }

    calculateWaveFibonacci(prices, highs, lows) {
        const currentPrice = prices[prices.length - 1];
        const high = Math.max(...highs.slice(-20));
        const low = Math.min(...lows.slice(-20));
        const range = high - low;

        return {
            retracements: {
                '23.6%': high - (range * 0.236),
                '38.2%': high - (range * 0.382),
                '50.0%': high - (range * 0.5),
                '61.8%': high - (range * 0.618),
                '78.6%': high - (range * 0.786)
            },
            extensions: {
                '127.2%': low + (range * 1.272),
                '161.8%': low + (range * 1.618),
                '261.8%': low + (range * 2.618)
            },
            currentLevel: this.getCurrentFibLevel(currentPrice, high, low)
        };
    }

    getCurrentFibLevel(price, high, low) {
        const range = high - low;
        const retracement = (high - price) / range;
        
        if (retracement <= 0.236) return '23.6%';
        if (retracement <= 0.382) return '38.2%';
        if (retracement <= 0.5) return '50.0%';
        if (retracement <= 0.618) return '61.8%';
        if (retracement <= 0.786) return '78.6%';
        return '100%+';
    }

    analyzeWaveTime(data) {
        const timestamps = data.map(d => d[0]);
        const duration = timestamps[timestamps.length - 1] - timestamps[0];
        
        return {
            totalDuration: duration,
            averageWaveDuration: duration / 5, // افتراض 5 موجات
            timeframe: '1h',
            cycleDuration: Math.round(duration / (1000 * 60 * 60)) // بالساعات
        };
    }

    analyzeWaveVolume(data) {
        const volumes = data.map(d => parseFloat(d[5]));
        const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
        const recentVolume = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
        
        return {
            averageVolume: avgVolume,
            recentVolume: recentVolume,
            volumeTrend: recentVolume > avgVolume ? 'increasing' : 'decreasing',
            volumeRatio: (recentVolume / avgVolume).toFixed(2)
        };
    }

    updateWaveTypeStats(completeWaveAnalysis) {
        if (!completeWaveAnalysis) return;

        // تحديث إحصائيات أنواع الموجات
        if (completeWaveAnalysis.impulseWaves?.detected) this.waveTypes.impulse++;
        if (completeWaveAnalysis.correctiveWaves?.detected) this.waveTypes.corrective++;
        if (completeWaveAnalysis.diagonalWaves?.detected) this.waveTypes.diagonal++;
        if (completeWaveAnalysis.trianglePatterns?.detected) this.waveTypes.triangle++;
        if (completeWaveAnalysis.flatPatterns?.detected) this.waveTypes.flat++;
        if (completeWaveAnalysis.zigzagPatterns?.detected) this.waveTypes.zigzag++;
        if (completeWaveAnalysis.complexPatterns?.detected) this.waveTypes.complex++;
    }

    updateStats() {
        this.stats.total = this.results.length;
        this.stats.bullish = this.results.filter(r => r.pattern.direction === 'bullish').length;
        this.stats.bearish = this.results.filter(r => r.pattern.direction === 'bearish').length;
        
        if (this.results.length > 0) {
            this.stats.avgConfidence = Math.round(
                this.results.reduce((sum, r) => sum + r.pattern.confidence, 0) / this.results.length
            );
        }

        // تحديث واجهة المستخدم
        this.updateStatsDisplay();
        this.updateChart();
    }

    updateStatsDisplay() {
        // تحديث العناصر في الواجهة
        const elements = {
            total: document.querySelector('[data-stat="total"]'),
            bullish: document.querySelector('[data-stat="bullish"]'), 
            bearish: document.querySelector('[data-stat="bearish"]'),
            confidence: document.querySelector('[data-stat="confidence"]')
        };

        if (elements.total) elements.total.textContent = this.stats.total;
        if (elements.bullish) elements.bullish.textContent = this.stats.bullish;
        if (elements.bearish) elements.bearish.textContent = this.stats.bearish;
        if (elements.confidence) elements.confidence.textContent = `${this.stats.avgConfidence}%`;
    }

    updateChart() {
        if (this.chart && this.chart.data) {
            this.chart.data.datasets[0].data = [
                this.stats.bullish,
                this.stats.bearish,
                Math.max(0, this.stats.total - this.stats.bullish - this.stats.bearish)
            ];
            this.chart.update();
        }
    }

    calculateTargets(data, pattern) {
        const prices = data.map(d => parseFloat(d[4]));
        const currentPrice = prices[prices.length - 1];
        const high = Math.max(...prices.slice(-20));
        const low = Math.min(...prices.slice(-20));
        const range = high - low;

        if (pattern.direction === 'bullish') {
            return {
                target1: currentPrice + (range * 0.382),
                target2: currentPrice + (range * 0.618),
                target3: currentPrice + (range * 1.0),
                stopLoss: currentPrice - (range * 0.236)
            };
        } else {
            return {
                target1: currentPrice - (range * 0.382),
                target2: currentPrice - (range * 0.618),
                target3: currentPrice - (range * 1.0),
                stopLoss: currentPrice + (range * 0.236)
            };
        }
    }

    generateRecommendation(pattern, trend, data, completeWaveAnalysis) {
        const direction = pattern.direction === 'bullish' ? 'شراء' : 'بيع';
        const confidence = pattern.confidence;
        
        // تحليل إضافي بناءً على التحليل الشامل
        let riskLevel = 'متوسط';
        let timeframe = '1-4 ساعات';
        
        if (completeWaveAnalysis) {
            if (completeWaveAnalysis.impulseWaves?.detected && confidence >= 85) {
                riskLevel = 'منخفض';
            }
            if (completeWaveAnalysis.trianglePatterns?.detected) {
                timeframe = '2-6 ساعات';
            }
        }
        
        return {
            action: direction,
            confidence: confidence,
            timeframe: timeframe,
            riskLevel: riskLevel,
            waveAnalysis: completeWaveAnalysis
        };
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
            card.style.display = show ? 'block' : 'none';
        });
    }

    copyRecommendation() {
        const modal = document.getElementById('recommendationModal');
        const content = modal.querySelector('.recommendation-content');
        if (content) {
            const text = content.innerText;
            navigator.clipboard.writeText(text).then(() => {
                // إظهار رسالة نجاح
                const btn = document.getElementById('copyRecommendation');
                const originalText = btn.textContent;
                btn.textContent = 'تم النسخ ✓';
                setTimeout(() => {
                    btn.textContent = originalText;
                }, 2000);
            }).catch(err => {
                console.error('فشل في نسخ النص:', err);
            });
        }
    }

    showRecommendation(symbol) {
        const result = this.results.find(r => r.symbol === symbol);
        if (!result) return;

        const modal = document.getElementById('recommendationModal');
        const content = modal.querySelector('.recommendation-content');
        
        const waveAnalysis = result.completeWaveAnalysis;
        let analysisText = '';
        
        if (waveAnalysis) {
            analysisText = `
                <h4>تحليل الموجات المتقدم:</h4>
                <p>• الموجات الدافعة: ${waveAnalysis.impulseWaves?.detected ? 'مكتشفة' : 'غير مكتشفة'}</p>
                <p>• الموجات التصحيحية: ${waveAnalysis.correctiveWaves?.detected ? 'مكتشفة' : 'غير مكتشفة'}</p>
                <p>• أنماط المثلث: ${waveAnalysis.trianglePatterns?.detected ? 'مكتشفة' : 'غير مكتشفة'}</p>
                <p>• قوة الموجة: ${waveAnalysis.waveStrength?.overall?.toFixed(1) || 'N/A'}%</p>
                <p>• مستوى فيبوناتشي الحالي: ${waveAnalysis.fibonacciLevels?.currentLevel || 'N/A'}</p>
            `;
        }

        content.innerHTML = `
            <h3>توصية ${symbol}</h3>
            <div class="recommendation-details">
                <p><strong>الإجراء:</strong> ${result.recommendation.action}</p>
                <p><strong>مستوى الثقة:</strong> ${result.recommendation.confidence}%</p>
                <p><strong>الإطار الزمني:</strong> ${result.recommendation.timeframe}</p>
                <p><strong>مستوى المخاطرة:</strong> ${result.recommendation.riskLevel}</p>
                
                <h4>الأهداف السعرية:</h4>
                <p>🎯 الهدف الأول: $${result.targets.target1.toFixed(4)}</p>
                <p>🎯 الهدف الثاني: $${result.targets.target2.toFixed(4)}</p>
                <p>🎯 الهدف الثالث: $${result.targets.target3.toFixed(4)}</p>
                <p>🛑 وقف الخسارة: $${result.targets.stopLoss.toFixed(4)}</p>
                
                ${analysisText}
                
                <div class="wave-characteristics">
                    <h4>خصائص النمط:</h4>
                    <p>• نوع النمط: ${result.pattern.type}</p>
                    <p>• الاتجاه: ${result.pattern.direction === 'bullish' ? 'صاعد 🚀' : 'هابط 📉'}</p>
                    <p>• الموجة الحالية: ${result.wave?.currentWave || 'غير محددة'}</p>
                    <p>• الاتجاه العام: ${result.trend}</p>
                </div>
            </div>
        `;

        modal.style.display = 'block';
    }

    getImpulseCharacteristics(subtype) {
        const characteristics = {
            'standard': 'موجة دافعة قياسية - 5 موجات',
            'extended': 'موجة دافعة ممتدة - الموجة 3 هي الأطول',
            'truncated': 'موجة دافعة مقطوعة - الموجة 5 أقصر من المتوقع'
        };
        return characteristics[subtype] || 'موجة دافعة';
    }

    getCorrectiveCharacteristics(subtype) {
        const characteristics = {
            'abc': 'تصحيح ABC قياسي',
            'deep_correction': 'تصحيح عميق - أكثر من 61.8%',
            'shallow_correction': 'تصحيح ضحل - أقل من 23.6%',
            'complex_correction': 'تصحيح معقد - WXY أو WXYXZ'
        };
        return characteristics[subtype] || 'تصحيح قياسي';
    }

    getTriangleCharacteristics(subtype) {
        const characteristics = {
            'contracting': 'مثلث متقارب - النطاق يضيق',
            'expanding': 'مثلث متوسع - النطاق يتسع',
            'ascending': 'مثلث صاعد - مقاومة أفقية',
            'descending': 'مثلث هابط - دعم أفقي',
            'symmetrical': 'مثلث متماثل - تقارب متوازن'
        };
        return characteristics[subtype] || 'نمط مثلث';
    }

    getFlatCharacteristics(subtype) {
        const characteristics = {
            'regular': 'مسطح عادي - B = 90-105% من A',
            'expanded': 'مسطح موسع - B > 105% من A',
            'running': 'مسطح جاري - C < 100% من A'
        };
        return characteristics[subtype] || 'نمط مسطح';
    }

    getZigzagCharacteristics(subtype) {
        const characteristics = {
            'regular': 'متعرج عادي - C = A',
            'elongated': 'متعرج ممتد - C > 1.618 × A',
            'truncated': 'متعرج مقطوع - C < A'
        };
        return characteristics[subtype] || 'نمط متعرج';
    }

    getComplexCharacteristics(subtype) {
        const characteristics = {
            'double_three': 'نمط W-X-Y - تصحيح مزدوج',
            'triple_three': 'نمط W-X-Y-X-Z - تصحيح ثلاثي',
            'wxy': 'تسلسل تصحيحي معقد',
            'wxyz': 'تسلسل تصحيحي معقد جداً'
        };
        return characteristics[subtype] || 'نمط معقد';
    }

    // حساب مستويات فيبوناتشي المتقدمة
    calculateAdvancedFibonacci(startPrice, endPrice, waveType = 'impulse') {
        const difference = endPrice - startPrice;
        const fibLevels = {};

        if (waveType === 'impulse') {
            // مستويات فيبوناتشي للموجات الدافعة
            fibLevels.retracements = {
                '23.6%': endPrice - (difference * 0.236),
                '38.2%': endPrice - (difference * 0.382),
                '50.0%': endPrice - (difference * 0.5),
                '61.8%': endPrice - (difference * 0.618),
                '78.6%': endPrice - (difference * 0.786)
            };
            fibLevels.extensions = {
                '127.2%': endPrice + (difference * 0.272),
                '161.8%': endPrice + (difference * 0.618),
                '200.0%': endPrice + (difference * 1.0),
                '261.8%': endPrice + (difference * 1.618),
                '423.6%': endPrice + (difference * 3.236)
            };
        } else {
            // مستويات فيبوناتشي للموجات التصحيحية
            fibLevels.corrections = {
                '38.2%': startPrice + (difference * 0.382),
                '50.0%': startPrice + (difference * 0.5),
                '61.8%': startPrice + (difference * 0.618),
                '78.6%': startPrice + (difference * 0.786),
                '88.6%': startPrice + (difference * 0.886)
            };
        }

        return fibLevels;
    }

    // تحليل العلاقات الزمنية
    analyzeTimeRelationships(data) {
        const timestamps = data.map(d => d[0]);
        const prices = data.map(d => parseFloat(d[4]));
        
        // حساب متوسط مدة الموجات
        const waveDurations = [];
        let currentWaveStart = 0;
        
        for (let i = 1; i < prices.length; i++) {
            if (this.isWaveEnd(prices, i)) {
                waveDurations.push(i - currentWaveStart);
                currentWaveStart = i;
            }
        }
        
        const avgDuration = waveDurations.length > 0 ? 
            waveDurations.reduce((a, b) => a + b, 0) / waveDurations.length : 0;
        
        return {
            averageWaveDuration: avgDuration,
            totalAnalysisPeriod: timestamps.length,
            timeframe: '1h',
            waveCount: waveDurations.length,
            fibonacciTimeRatios: this.calculateTimeRatios(waveDurations)
        };
    }

    isWaveEnd(prices, index) {
        if (index < 2 || index >= prices.length - 2) return false;
        
        // تحديد نهاية الموجة بناءً على تغيير الاتجاه
        const prev2 = prices[index - 2];
        const prev1 = prices[index - 1];
        const current = prices[index];
        const next1 = prices[index + 1];
        
        // قمة محلية
        if (prev1 < current && current > next1 && current > prev2) return true;
        // قاع محلي  
        if (prev1 > current && current < next1 && current < prev2) return true;
        
        return false;
    }

    calculateTimeRatios(durations) {
        if (durations.length < 2) return {};
        
        const ratios = {};
        for (let i = 1; i < durations.length; i++) {
            const ratio = durations[i] / durations[i-1];
            ratios[`Wave${i+1}/Wave${i}`] = ratio.toFixed(2);
        }
        
        return ratios;
    }

    // تحليل قوة الزخم
    analyzeMomentum(data) {
        const prices = data.map(d => parseFloat(d[4]));
        const volumes = data.map(d => parseFloat(d[5]));
        
        // حساب RSI مبسط
        const rsi = this.calculateRSI(prices, 14);
        
        // حساب MACD مبسط
        const macd = this.calculateMACD(prices);
        
        // تحليل الحجم
        const volumeAnalysis = this.analyzeVolumePattern(volumes);
        
        return {
            rsi: rsi,
            macd: macd,
            volume: volumeAnalysis,
            momentum: this.calculateMomentumScore(rsi, macd, volumeAnalysis)
        };
    }

    calculateRSI(prices, period = 14) {
        if (prices.length < period + 1) return 50;
        
        let gains = 0;
        let losses = 0;
        
        for (let i = 1; i <= period; i++) {
            const change = prices[i] - prices[i-1];
            if (change > 0) gains += change;
            else losses += Math.abs(change);
        }
        
        const avgGain = gains / period;
        const avgLoss = losses / period;
        
        if (avgLoss === 0) return 100;
        
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    calculateMACD(prices) {
        if (prices.length < 26) return { macd: 0, signal: 0, histogram: 0 };
        
        const ema12 = this.calculateEMA(prices, 12);
        const ema26 = this.calculateEMA(prices, 26);
        const macd = ema12 - ema26;
        
        // حساب خط الإشارة (EMA 9 للـ MACD)
        const macdLine = [macd];
        const signal = this.calculateEMA(macdLine, 9);
        const histogram = macd - signal;
        
        return {
            macd: macd.toFixed(4),
            signal: signal.toFixed(4),
            histogram: histogram.toFixed(4)
        };
    }

    calculateEMA(prices, period) {
        if (prices.length === 0) return 0;
        
        const multiplier = 2 / (period + 1);
        let ema = prices[0];
        
        for (let i = 1; i < prices.length; i++) {
            ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
        }
        
        return ema;
    }

    analyzeVolumePattern(volumes) {
        const recentVolume = volumes.slice(-5);
        const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
        const recentAvg = recentVolume.reduce((a, b) => a + b, 0) / recentVolume.length;
        
        return {
            trend: recentAvg > avgVolume ? 'increasing' : 'decreasing',
            strength: Math.abs((recentAvg - avgVolume) / avgVolume * 100).toFixed(2),
            ratio: (recentAvg / avgVolume).toFixed(2)
        };
    }

    calculateMomentumScore(rsi, macd, volume) {
        let score = 50; // نقطة البداية
        
        // تأثير RSI
        if (rsi > 70) score += 15;
        else if (rsi > 50) score += 5;
        else if (rsi < 30) score -= 15;
        else if (rsi < 50) score -= 5;
        
        // تأثير MACD
        if (parseFloat(macd.histogram) > 0) score += 10;
        else score -= 10;
        
        // تأثير الحجم
        if (volume.trend === 'increasing') score += 10;
        else score -= 5;
        
        return Math.max(0, Math.min(100, score));
    }

    // دالة لعرض إحصائيات متقدمة
    displayAdvancedStats() {
        const statsContainer = document.getElementById('advanced-stats');
        if (!statsContainer) return;
        
        const waveTypeStats = Object.entries(this.waveTypes)
            .filter(([type, count]) => count > 0)
            .sort(([,a], [,b]) => b - a);
        
        let statsHTML = '<h4>إحصائيات أنواع الموجات:</h4>';
        waveTypeStats.forEach(([type, count]) => {
            const percentage = ((count / this.results.length) * 100).toFixed(1);
            statsHTML += `<p>${this.getWaveTypeLabel(type)}: ${count} (${percentage}%)</p>`;
        });
        
        statsContainer.innerHTML = statsHTML;
    }

    getWaveTypeLabel(type) {
        const labels = {
            impulse: 'موجات دافعة',
            corrective: 'موجات تصحيحية',
            diagonal: 'موجات قطرية',
            triangle: 'أنماط مثلث',
            flat: 'أنماط مسطحة',
            zigzag: 'أنماط متعرجة',
            complex: 'أنماط معقدة'
        };
        return labels[type] || type;
    }

    // دالة لتصدير النتائج
    exportResults() {
        const exportData = {
            timestamp: new Date().toISOString(),
            stats: this.stats,
            waveTypes: this.waveTypes,
            results: this.results.map(r => ({
                symbol: r.symbol,
                pattern: r.pattern,
                trend: r.trend,
                targets: r.targets,
                confidence: r.pattern.confidence
            }))
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `elliott-wave-analysis-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
    }
}

// تهيئة الرادار عند تحميل الصفحة
let radar;
document.addEventListener('DOMContentLoaded', () => {
    radar = new ElliottWaveRadar();
});

